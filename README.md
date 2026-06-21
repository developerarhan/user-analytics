# User Analytics & Event Tracking System

A lightweight, real-time web analytics tracking platform and monitoring dashboard. This system captures user interaction data (page views and coordinate-relative clicks) across target web pages via an embedded tracker script, ingests them through a high-throughput Flask API, and displays session timelines and click-heatmaps on a centralized React dashboard.

---

## 🌐 Live Demo

| Service             | URL                                            |
| ------------------- | ---------------------------------------------- |
| Analytics Dashboard | https://user-analytics-theta.vercel.app        |
| Backend API         | https://user-analytics-xjqc.onrender.com       |
| API Health Check    | https://user-analytics-xjqc.onrender.com/health|

> **Note:** The demo tracking pages (`demo.html`, `pricing.html`, etc.) are accessible through the deployed frontend application.

## 🛠️ Tech Stack

### Frontend & Analytics Client

* **React (Vite)** – Single Page Application framework used to build the operational analytics dashboard.
* **Vanilla JavaScript (`tracker.js`)** – Lightweight, non-blocking asynchronous event tracking script injected into target client-side HTML pages.
* **Nginx** – Employed as a web server to host production static frontend builds and reverse-proxy backend traffic.

### Backend & Database

* **Flask (Python)** – Production-ready RESTful API built using the application factory pattern, incorporating strict JSON body verification and CORS handling.
* **MongoDB & PyMongo** – Distributed document-oriented NoSQL database optimized for high-write loads and flexible, polymorphic analytics schemas.

### Infrastructure & Deployment

* **Docker & Docker Compose** – Containerization tools ensuring seamless local service orchestration and cross-environment predictability.
* **Vercel & Render** – Production hosting architecture for the React client application and containerized backend respectively.

---

## 📁 Repository Structure

```text
USER-ANALYTICS/
│
├── docker-compose.yml          # Multi-container local production orchestration orchestrator
│
├── backend/
│   ├── app.py                  # Flask Application Factory, endpoints & indexing routines
│   ├── Dockerfile              # Multi-stage container definition for Python runtime
│   └── requirements.txt        # Backend package pins (Flask, Flask-CORS, PyMongo)
│
└── frontend/
    ├── Dockerfile              # Container workflow configuration for frontend assets
    ├── index.html              # Core single-page template root for dashboard UI
    ├── nginx.conf              # Nginx server mapping for production builds & proxy targets
    ├── package-lock.json       # Locked dependency tree for Node packages
    ├── package.json            # Vite, React, and layout plugin configurations
    ├── vite.config.js          # Asset compiler bundling adjustments
    │
    ├── public/                 # Static assets and target integration test spaces
    │   ├── contact.html        # Mock target tracking subpage
    │   ├── demo.html           # Live interactive site sandbox for analytics verification
    │   ├── features.html       # Mock target tracking subpage
    │   ├── pricing.html        # Mock target tracking subpage
    │   ├── products.html       # Mock target tracking subpage
    │   └── tracker.js          # Injected event capture logic monitoring client hooks
    │
    └── src/                    # Reactive analytical dashboard modules
        ├── main.jsx            # React document entry node mapping
        ├── App.jsx             # Top-tier view component wrapper
        └── components/
            ├── HeatmapView.jsx    # Relative percentage coordinate matrix renderer
            ├── SessionDetail.jsx  # Individual user chronological timeline tracer
            └── SessionsView.jsx   # Aggregated historical sessions master grid
```

---

## ⚙️ Environment Configuration

Proper variable assignment is critical to avoid connection faults (`ERR_CONNECTION_REFUSED`), cross-origin restrictions (CORS errors), or structural path mismatches.

### 1. Local Configuration (Docker Development Loop)

#### Backend Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
MONGO_URI=mongodb://database:27017/analytics
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Variable Purpose**

* `MONGO_URI` → Directs Flask to the local containerized MongoDB service.
* `ALLOWED_ORIGINS` → Permits local Vite development servers to communicate with the API.

Alternatively, these variables may be injected directly via `docker-compose.yml`.

#### Frontend Environment Variables

Create a `frontend/.env.local` file:

```env
VITE_API_URL=http://localhost:5000
```

This variable instructs the React dashboard to target the locally running Flask API.

> **ℹ️ Tracker Logic Note**
>
> `tracker.js` includes adaptive routing behavior. When the script detects that it is executing on `localhost` or `127.0.0.1`, it automatically bypasses production endpoints and redirects analytics events to `http://localhost:5000`.

---

### 2. Live Deployment Configuration (Vercel + Render)

#### Render Environment Variables (Flask API)

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/analytics?retryWrites=true&w=majority

ALLOWED_ORIGINS=https://user-analytics-theta.vercel.app
```

> **Important:** Do not include a trailing slash (`/`) in `ALLOWED_ORIGINS`. The value must exactly match the browser origin string.

#### Vercel Environment Variables (React Dashboard)

```env
VITE_API_URL=https://user-analytics-api.onrender.com
```

---

## 🚀 Local Setup & Orchestration

### Prerequisites

* Docker Desktop installed and running.
* On Windows, it is recommended to execute the project inside a **WSL2 Linux filesystem** for reliable file watching and symlink behavior.

### Build & Run

Navigate to the project root:

```bash
cd USER-ANALYTICS
```

Build and start all services:

```bash
docker-compose up --build
```

### Local Access Points

| Service                 | URL                             |
| ----------------------- | ------------------------------- |
| Analytics Dashboard     | http://localhost:5173           |
| Demo Tracking Website   | http://localhost:5173/demo.html |
| Backend Health Endpoint | http://localhost:5000/health    |

### Stopping Services & Removing Persistent Data

```bash
docker-compose down -v
```

The command above:

* Stops all containers.
* Removes associated volumes.
* Clears local analytics data stored in MongoDB.

---

## 📡 Core API Definitions

| Endpoint             | Method | Purpose                                                              |
| -------------------- | ------ | -------------------------------------------------------------------- |
| `/api/events`        | `POST` | Processes and ingests analytics interaction events.                  |
| `/api/sessions`      | `GET`  | Returns aggregated visitor session summaries and computed durations. |
| `/api/sessions/<id>` | `GET`  | Returns chronological event streams for a specific session.          |
| `/api/pages`         | `GET`  | Returns distinct tracked page URLs for dashboard filtering.          |
| `/api/heatmap`       | `GET`  | Returns coordinate data filtered by `page_url`.                      |

### Example Event Payload

```json
{
  "session_id": "abc123",
  "event_type": "click",
  "page_url": "/pricing",
  "timestamp": "2026-06-21T12:00:00Z",
  "x_per": 42.7,
  "y_px": 914
}
```

---

## ⚖️ Assumptions & Trade-offs

### 1. Schema-Less Analytics Storage (MongoDB)

**Rationale**

Analytics events are inherently polymorphic.

A `page_view` event only requires:

* Page URL
* Session identifier
* Timestamp

Whereas a `click` event additionally requires:

* X coordinate
* Y coordinate

Using MongoDB enables new event attributes to be introduced without performing database migrations.

**Trade-off**

Validation responsibility shifts from the database layer to the application layer through dedicated payload verification routines.

---

### 2. Coordinate Normalization Strategy

**Problem**

Users access applications from vastly different screen sizes.

**Design Choice**

Horizontal coordinates are normalized:

```text
x_per = (click_x / viewport_width) × 100
```

Vertical coordinates remain absolute pixel values:

```text
y_px = distance from top of document
```

This approach ensures heatmaps remain accurate on responsive layouts while preserving meaningful vertical page positioning.

---

### 3. Self-Healing Tracker Initialization

**Problem**

Production environments often load scripts asynchronously.

Consequently, `tracker.js` may execute before frontend frameworks initialize global configuration values.

**Design Choice**

The tracker derives routing information directly from:

```javascript
window.location.hostname
```

This eliminates initialization race conditions and removes dependencies on externally injected runtime variables.

---

### 4. Background Database Index Creation

**Problem**

Large analytics collections degrade query performance when indexes are absent.

**Design Choice**

Indexes are verified during application startup:

```python
create_index(..., background=True)
```

This permits the API to remain responsive while MongoDB builds indexes asynchronously.

---

## ✨ Key Features

* Real-time event ingestion.
* Session timeline visualization.
* Interactive click heatmaps.
* Automatic tracker endpoint routing.
* Containerized local development workflow.
* Production-ready deployment architecture.
* High-write optimized analytics storage.
* CORS-secured API communication.
* Scalable schema-less event model.

---
