(function CausalFunnelTracker() {
  "use strict";
 
  // ── Configuration ─────────────────────────────────────────────────────────
  // Centralised in one place so ops/devs can patch without reading the whole
  // file. Override API_BASE_URL via a global before loading this script:
  //   <script>window.CF_API_BASE = "https://api.yourhost.com";</script>
  //   <script src="tracker.js"></script>
 
  var CONFIG = {
    API_BASE_URL:       (window.CF_API_BASE || "http://localhost:5000"),
    EVENTS_ENDPOINT:    "/api/events",
    STORAGE_KEY:        "cf_session_id",
    // Maximum number of events to hold in the beacon queue at any one time.
    // Prevents unbounded memory growth if the page stays open for a very long
    // time and the user clicks thousands of elements.
    MAX_QUEUE_SIZE:     50,
    // Log internal diagnostics to the browser console when true.
    // Set window.CF_DEBUG = true before loading this script to enable.
    DEBUG:              (window.CF_DEBUG === true),
  };
 
  var ENDPOINT = CONFIG.API_BASE_URL + CONFIG.EVENTS_ENDPOINT;
 
  // ── Internal state ────────────────────────────────────────────────────────
 
  // Flag flipped to true inside the beforeunload / visibilitychange handlers.
  // When true, the click handler routes new events to the beacon queue instead
  // of fetch() so they are flushed atomically on the way out.
  var _isUnloading = false;
 
  // Array of serialised event JSON strings waiting to be sent via sendBeacon.
  // Kept as pre-serialised strings so sendBeacon can receive a Blob directly
  // without any synchronous JSON.stringify work in the unload handler.
  var _beaconQueue = [];
 
  // ── Utilities ─────────────────────────────────────────────────────────────
 
  function log() {
    if (CONFIG.DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[CausalFunnel]");
      console.log.apply(console, args);
    }
  }
 
  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[CausalFunnel]");
    console.warn.apply(console, args);
  }
 
  // ── Session management ────────────────────────────────────────────────────
 
  /**
   * Return the existing session_id from localStorage, or generate and persist
   * a new UUID v4. Falls back to a timestamp-based ID in the unlikely event
   * that crypto.randomUUID() is not available (e.g. non-HTTPS in very old
   * browsers), so tracking still functions rather than silently breaking.
   */
  function resolveSessionId() {
    try {
      var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (stored && stored.length > 0) {
        log("Existing session_id:", stored);
        return stored;
      }
    } catch (e) {
      // localStorage is blocked (e.g. Safari private mode, iframe sandbox).
      warn("localStorage unavailable, session will not persist:", e.message);
    }
 
    var newId;
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      newId = crypto.randomUUID();
    } else {
      // Fallback: pseudo-UUID constructed from Math.random and a timestamp.
      // Not cryptographically random, but sufficient for session correlation.
      newId =
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = (Math.random() * 16) | 0;
          var v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }) +
        "-" +
        Date.now().toString(36);
    }
 
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, newId);
    } catch (e) {
      warn("Could not persist session_id:", e.message);
    }
 
    log("New session_id generated:", newId);
    return newId;
  }
 
  // Resolve once at script load time; all event builders close over this.
  var SESSION_ID = resolveSessionId();
 
  // ── Event payload builder ─────────────────────────────────────────────────
 
  /**
   * Build a complete event payload object.
   *
   * @param {string} eventType   "page_view" | "click"
   * @param {object} [coords]    Optional { x_per, y_px } for click events.
   * @returns {object}           The full payload ready for JSON serialisation.
   */
  function buildPayload(eventType, coords) {
    var payload = {
      session_id:  SESSION_ID,
      event_type:  eventType,
      page_url:    window.location.href,
      timestamp:   new Date().toISOString(),
    };
 
    if (coords) {
      // 🌟 FIX: Updated mapping key to match backend requirement (x_per instead of x_px)
      payload.x_per = coords.x_per;
      payload.y_px  = coords.y_px;
    }
 
    return payload;
  }
 
  // ── Transport: fetch (primary) ────────────────────────────────────────────
 
  /**
   * Send an event payload to the API using the Fetch API.
   * Used for all events that are NOT caught during page unload.
   *
   * @param {object} payload   The event object from buildPayload().
   */
  function sendWithFetch(payload) {
    fetch(ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive: true allows the browser to keep the request alive even if
      // the page is navigating away — acts as a lightweight complement to
      // sendBeacon for smaller payloads. It has a 64 KB body limit.
      keepalive: true,
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) {
          warn("API rejected event (HTTP " + res.status + "):", payload.event_type);
        } else {
          log("Event sent via fetch:", payload.event_type, payload);
        }
      })
      .catch(function (err) {
        warn("fetch() failed for event '" + payload.event_type + "':", err.message);
      });
  }
 
  // ── Transport: sendBeacon (unload fallback) ───────────────────────────────
 
  /**
   * Flush every event in _beaconQueue using navigator.sendBeacon().
   */
  function flushBeaconQueue() {
    if (_beaconQueue.length === 0) return;
 
    if (typeof navigator.sendBeacon !== "function") {
      warn("sendBeacon unavailable; " + _beaconQueue.length + " queued event(s) lost.");
      _beaconQueue = [];
      return;
    }
 
    log("Flushing beacon queue:", _beaconQueue.length, "event(s)");
 
    while (_beaconQueue.length > 0) {
      var serialised = _beaconQueue.shift();
      var blob = new Blob([serialised], { type: "application/json" });
      var queued = navigator.sendBeacon(ENDPOINT, blob);
      if (!queued) {
        warn("sendBeacon returned false — browser may have rejected the payload.");
      }
    }
  }
 
  /**
   * Add a pre-serialised event string to the beacon queue.
   */
  function enqueueBeacon(serialised) {
    if (_beaconQueue.length >= CONFIG.MAX_QUEUE_SIZE) {
      warn("Beacon queue at capacity; dropping oldest entry.");
      _beaconQueue.shift();
    }
    _beaconQueue.push(serialised);
    log("Event queued for beacon flush:", serialised);
  }
 
  // ── Unload detection ──────────────────────────────────────────────────────
 
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      log("Page hidden — switching to beacon mode and flushing queue.");
      _isUnloading = true;
      flushBeaconQueue();
    }
  });
 
  window.addEventListener("beforeunload", function () {
    log("beforeunload — switching to beacon mode and flushing queue.");
    _isUnloading = true;
    flushBeaconQueue();
  });
 
  // ── Page view tracking ────────────────────────────────────────────────────
 
  function trackPageView() {
    var payload = buildPayload("page_view");
    log("Tracking page_view:", payload);
    sendWithFetch(payload);
  }
 
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    trackPageView();
  } else {
    document.addEventListener("DOMContentLoaded", trackPageView);
  }
 
  // ── Click tracking ────────────────────────────────────────────────────────
 
  document.addEventListener(
    "click",
    function (e) {
      var scrollWidth = document.documentElement.scrollWidth || 1;
 
      var x_per = parseFloat(
        Math.min((e.pageX / scrollWidth) * 100, 100).toFixed(4)
      );
      var y_px = Math.round(e.pageY);
 
      var payload = buildPayload("click", { x_per: x_per, y_px: y_px });
 
      if (_isUnloading) {
        enqueueBeacon(JSON.stringify(payload));
      } else {
        log("Tracking click:", payload);
        sendWithFetch(payload);
      }
    },
    true
  );
 
  // ── Public API ────────────────────────────────────────────────────────────
 
  window.CausalFunnel = {
    sessionId: SESSION_ID,
 
    trackEvent: function (eventType, extras) {
      if (!eventType || typeof eventType !== "string") {
        warn("trackEvent() requires a non-empty string eventType.");
        return;
      }
      var payload = buildPayload(eventType, extras || null);
      if (_isUnloading) {
        enqueueBeacon(JSON.stringify(payload));
      } else {
        sendWithFetch(payload);
      }
    },
 
    resetSession: function () {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      } catch (e) {}
 
      SESSION_ID = resolveSessionId();
      window.CausalFunnel.sessionId = SESSION_ID;
      log("Session reset. New session_id:", SESSION_ID);
      return SESSION_ID;
    },
  };
 
  log("Tracker initialised. Session:", SESSION_ID, "| Endpoint:", ENDPOINT);
})();