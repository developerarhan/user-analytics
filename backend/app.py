"""
app.py — User Analytics API
 
Endpoints
---------
POST   /api/events                     Ingest a tracking event
GET    /api/sessions                   List all sessions (aggregated)
GET    /api/sessions/<session_id>      Full event timeline for one session
GET    /api/pages                      Distinct tracked page URLs
GET    /api/heatmap?page_url=<url>     Click coordinates for one page
 
Design notes
------------
- All ObjectId values are serialised to strings before leaving this process;
  pymongo returns bson.ObjectId objects which are not JSON-serialisable by
  default, so every route that touches _id converts it explicitly.
- Indexes are created with create_index(..., background=True) so that a
  restart against a large existing collection does not block the event loop.
- CORS is locked to the single origin that the React dev/prod server uses.
  Expand ALLOWED_ORIGINS for multi-domain deployments.
- Every route wraps its logic in try/except and returns a machine-readable
  {"error": "..."} body with an appropriate HTTP status code so the frontend
  can surface useful messages rather than a raw 500 page.
"""
 
from __future__ import annotations
 
import logging
import os
from datetime import datetime, timezone
 
from bson import ObjectId
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import ASCENDING, MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
 
# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)
 
# Configuration
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://database:27017/analytics")
ALLOWED_ORIGINS: list[str] = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
 
# Flask application factory
 
def create_app() -> Flask:
    """Construct and configure the Flask application.
 
    Separated into a factory so the app can be instantiated cleanly in tests
    or alternative entry-points without triggering side-effects at import time.
    """
    app = Flask(__name__)
 
    # ── CORS
    # Allow the React frontend (Nginx on :5173 → built bundle, or Vite dev
    # server) to call every /api/* route.  Credentials support is enabled so
    # cookie-based session_ids work if you add auth later.
    CORS(
        app,
        resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
        supports_credentials=True,
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    log.info("CORS enabled for origins: %s", ALLOWED_ORIGINS)
 
    # ── MongoDB connection
    try:
        client: MongoClient = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5_000,
            connectTimeoutMS=5_000,
            socketTimeoutMS=10_000,
        )
        # Force a round-trip to verify the connection is usable before
        # registering routes — better to crash here than on the first request.
        client.admin.command("ping")
        log.info("MongoDB connection established → %s", MONGO_URI)
    except ConnectionFailure as exc:
        log.critical("Cannot connect to MongoDB at %s: %s", MONGO_URI, exc)
        raise SystemExit(1) from exc
 
    db = client.get_default_database()   # reads the db name from the URI path
    events_col = db["events"]
 
    # ── Index initialisation
    # Compound index on (session_id, timestamp) accelerates the session-detail
    # query which filters by session_id and sorts by timestamp in one scan.
    # The single-field page_url index accelerates both the heatmap and
    # the pages endpoint.
    try:
        events_col.create_index(
            [("session_id", ASCENDING), ("timestamp", ASCENDING)],
            background=True,
            name="idx_session_time",
        )
        events_col.create_index(
            [("page_url", ASCENDING)],
            background=True,
            name="idx_page_url",
        )
        log.info("MongoDB indexes verified / created.")
    except OperationFailure as exc:
        # Non-fatal: log and continue.  The app is still usable; queries will
        # just perform collection scans until the index is created manually.
        log.warning("Index creation failed (non-fatal): %s", exc)
 
    # Utility helpers
 
    def _serialise(doc: dict) -> dict:
        """Convert BSON types that are not natively JSON-serialisable.
 
        Mutates and returns the document dict for convenience.
        Handles: ObjectId → str, datetime → ISO-8601 string.
        """
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, datetime):
                # Ensure UTC timezone marker is present in the output string.
                if value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc)
                doc[key] = value.isoformat()
        return doc
 
    def _now_utc() -> datetime:
        """Return the current UTC time as a timezone-aware datetime."""
        return datetime.now(timezone.utc)
 
    def _validate_event_payload(data: dict) -> tuple[bool, str]:
        required = {"session_id", "event_type", "page_url", "timestamp"}
        missing = required - data.keys()
        if missing:
            return False, f"Missing required fields: {sorted(missing)}"
 
        valid_event_types = {"page_view", "click"}
        if data["event_type"] not in valid_event_types:
            return False, f"event_type must be one of {sorted(valid_event_types)}"
 
        if data["event_type"] == "click":
            # Check for relative percentage x coordinate and absolute y pixel coordinate
            if data.get("x_per") is None or data.get("y_px") is None:
                return False, "click events must include x_per and y_px coordinates"
 
        return True, ""
     
    # Routes
 
    # ── POST /api/events
    @app.route("/api/events", methods=["POST"])
    def ingest_event():
        """Receive and persist a single tracking event.
 
        Expected JSON body
        ------------------
        {
            "session_id" : "uuid-v4-string",
            "event_type" : "page_view" | "click",
            "page_url"   : "https://example.com/path",
            "timestamp"  : "2024-01-15T10:30:00.000Z",   // ISO-8601
            "x_per"      : 45.1234, // click events only (percentage float)
            "y_px"       : 540      // click events only (pixel integer)
        }
 
        Returns 201 with the inserted document's _id on success.
        Returns 400 for validation errors, 500 for storage errors.
        """
        try:
            data: dict = request.get_json(silent=True) or {}
 
            # ── Validation
            ok, error_msg = _validate_event_payload(data)
            if not ok:
                return jsonify({"error": error_msg}), 400
 
            # ── Normalise timestamp
            # Accept an ISO-8601 string from the client and store a proper
            # datetime object so MongoDB date operators work correctly.
            raw_ts = data.get("timestamp")
            try:
                if isinstance(raw_ts, str):
                    # Python 3.11+ fromisoformat handles 'Z' suffix natively.
                    parsed_ts = datetime.fromisoformat(
                        raw_ts.replace("Z", "+00:00")
                    )
                elif isinstance(raw_ts, (int, float)):
                    # Accept milliseconds-since-epoch as a fallback.
                    parsed_ts = datetime.fromtimestamp(raw_ts / 1000, tz=timezone.utc)
                else:
                    raise ValueError("unsupported timestamp format")
            except (ValueError, TypeError) as exc:
                return jsonify({"error": f"Invalid timestamp: {exc}"}), 400
 
            # ── Build the document
            document: dict = {
                "session_id": str(data["session_id"]).strip(),
                "event_type": data["event_type"],
                "page_url":   str(data["page_url"]).strip(),
                "timestamp":  parsed_ts,
                "ingested_at": _now_utc(),   # server-side audit trail
            }
 
            # 🌟 FIXED: Pulling x_per instead of x_px, and processing it as a float percentage
            if data["event_type"] == "click":
                document["x_per"] = float(data["x_per"])
                document["y_px"] = int(data["y_px"])
 
            # Optional enrichment fields the tracker may send.
            if data.get("user_agent"):
                document["user_agent"] = str(data["user_agent"])[:512]
 
            # ── Persist
            result = events_col.insert_one(document)
            log.info(
                "Event ingested: _id=%s session=%s type=%s",
                result.inserted_id,
                document["session_id"],
                document["event_type"],
            )
 
            return jsonify({
                "status": "ok",
                "_id": str(result.inserted_id),
            }), 201
 
        except Exception as exc:
            log.exception("Unexpected error in POST /api/events")
            return jsonify({"error": "Internal server error", "detail": str(exc)}), 500
 
    # ── GET /api/sessions
    @app.route("/api/sessions", methods=["GET"])
    def list_sessions():
        """Aggregate and return a summary row for every unique session."""
        try:
            pipeline = [
                {
                    "$group": {
                        "_id":          "$session_id",
                        "event_count":  {"$sum": 1},
                        "first_seen":   {"$min": "$timestamp"},
                        "last_seen":    {"$max": "$timestamp"},
                        "event_types":  {"$addToSet": "$event_type"},
                        "first_page":   {"$first": "$page_url"},
                    }
                },
                {
                    "$addFields": {
                        "duration_secs": {
                            "$divide": [
                                {
                                    "$subtract": [
                                        "$last_seen",
                                        "$first_seen",
                                    ]
                                },
                                1000,
                            ]
                        }
                    }
                },
                {
                    "$project": {
                        "_id":           0,
                        "session_id":    "$_id",
                        "event_count":   1,
                        "first_seen":    1,
                        "last_seen":     1,
                        "duration_secs": 1,
                        "event_types":   1,
                        "first_page":    1,
                    }
                },
                {"$sort": {"first_seen": ASCENDING}},
            ]
 
            sessions = list(events_col.aggregate(pipeline))
 
            for session in sessions:
                for field in ("first_seen", "last_seen"):
                    if isinstance(session.get(field), datetime):
                        dt = session[field]
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        session[field] = dt.isoformat()
                if isinstance(session.get("duration_secs"), float):
                    session["duration_secs"] = round(session["duration_secs"], 2)
 
            log.info("GET /api/sessions → %d sessions returned", len(sessions))
            return jsonify({"sessions": sessions, "count": len(sessions)}), 200
 
        except OperationFailure as exc:
            log.exception("Aggregation error in GET /api/sessions")
            return jsonify({"error": "Database aggregation failed", "detail": str(exc)}), 500
        except Exception as exc:
            log.exception("Unexpected error in GET /api/sessions")
            return jsonify({"error": "Internal server error", "detail": str(exc)}), 500
 
    # ── GET /api/sessions/<session_id>
    @app.route("/api/sessions/<string:session_id>", methods=["GET"])
    def get_session_events(session_id: str):
        """Return the full, ordered event timeline for a single session."""
        try:
            session_id = session_id.strip()
            if not session_id:
                return jsonify({"error": "session_id path parameter is required"}), 400
 
            cursor = events_col.find(
                {"session_id": session_id},
                {"ingested_at": 0},
            ).sort("timestamp", ASCENDING)
 
            events = [_serialise(doc) for doc in cursor]
 
            if not events:
                return jsonify({
                    "error": f"No events found for session '{session_id}'",
                }), 404
 
            log.info(
                "GET /api/sessions/%s → %d events returned",
                session_id,
                len(events),
            )
            return jsonify({
                "session_id": session_id,
                "events": events,
                "count": len(events),
            }), 200
 
        except OperationFailure as exc:
            log.exception("Query error in GET /api/sessions/<session_id>")
            return jsonify({"error": "Database query failed", "detail": str(exc)}), 500
        except Exception as exc:
            log.exception("Unexpected error in GET /api/sessions/<session_id>")
            return jsonify({"error": "Internal server error", "detail": str(exc)}), 500
 
    # ── GET /api/pages
    @app.route("/api/pages", methods=["GET"])
    def list_pages():
        """Return every distinct page URL that has received at least one event."""
        try:
            pages: list[str] = events_col.distinct("page_url")
            pages.sort()
 
            log.info("GET /api/pages → %d distinct pages returned", len(pages))
            return jsonify({"pages": pages, "count": len(pages)}), 200
 
        except OperationFailure as exc:
            log.exception("Query error in GET /api/pages")
            return jsonify({"error": "Database query failed", "detail": str(exc)}), 500
        except Exception as exc:
            log.exception("Unexpected error in GET /api/pages")
            return jsonify({"error": "Internal server error", "detail": str(exc)}), 500
 
    # ── GET /api/heatmap
    @app.route("/api/heatmap", methods=["GET"])
    def get_heatmap():
        """Return click coordinates for a specific page URL."""
        try:
            page_url: str = request.args.get("page_url", "").strip()
            if not page_url:
                return jsonify({
                    "error": "Query parameter 'page_url' is required",
                }), 400
 
            cursor = events_col.find(
                {
                    "event_type": "click",
                    "page_url":   page_url,
                    "x_per": {"$exists": True},
                    "y_px": {"$exists": True},
                },
                {"_id": 0, "x_per": 1, "y_px": 1},
            )
 
            clicks = [{"x_per": doc["x_per"], "y_px": doc["y_px"]} for doc in cursor]
 
            log.info(
                "GET /api/heatmap?page_url=%s → %d click points returned",
                page_url,
                len(clicks),
            )
            return jsonify({
                "page_url": page_url,
                "clicks": clicks,
                "count": len(clicks),
            }), 200
        except OperationFailure as exc:
            log.exception("Query error in GET /api/heatmap")
            return jsonify({"error": "Database query failed", "detail": str(exc)}), 500
        except Exception as exc:
            log.exception("Unexpected error in GET /api/heatmap")
            return jsonify({"error": "Internal server error", "detail": str(exc)}), 500
 
    # Generic error handlers
    @app.errorhandler(404)
    def not_found(_err):
        return jsonify({"error": "Route not found"}), 404
 
    @app.errorhandler(405)
    def method_not_allowed(_err):
        return jsonify({"error": "Method not allowed"}), 405
 
    @app.errorhandler(400)
    def bad_request(_err):
        return jsonify({"error": "Bad request"}), 400
 
    # Health-check
    @app.route("/health", methods=["GET"])
    def health():
        """Lightweight liveness + readiness probe."""
        try:
            client.admin.command("ping")
            return jsonify({"status": "ok", "db": "reachable"}), 200
        except Exception as exc:
            log.error("Health check failed: %s", exc)
            return jsonify({"status": "error", "db": "unreachable", "detail": str(exc)}), 503
 
    return app
 
# Entry point

# Gunicorn imports this module and calls create_app() via the `app` name below.
# Running `python app.py` directly starts Flask's built-in development server —
# useful for quick local iteration outside Docker.
app = create_app()
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)