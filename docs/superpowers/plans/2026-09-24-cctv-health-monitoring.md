# CCTV Health Monitoring System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated, lightweight, 24/7 CCTV Health Monitoring system in Python (FastAPI + SQLite + OpenCV/AsyncIO) with a multi-tab SPA web interface, configurable failure criteria, host-aware NVR rate-limiting, incident logging, audio/visual alerts, bulk CSV import/export, and extensible notification stubs.

**Architecture:** A lightweight FastAPI single-service app with an embedded asynchronous worker engine. Liveness is tested via fast non-blocking TCP socket handshakes (near-zero load on NVRs) and staggered substream frame snapshots with a per-host semaphore (max 1-2 concurrent connections per physical NVR). State transitions feed into SQLite incident logs and broadcast live updates via Server-Sent Events (SSE) to an interactive SPA web interface.

**Tech Stack:** Python 3.11, FastAPI, Uvicorn, SQLite (via standard sqlite3 / async aiosqlite), OpenCV-headless / Pillow, Vanilla Modern JS + Tailwind CSS (bundled via CDN or local static assets, no node build-step needed for pure zero-dependency simplicity).

**Spec:** [`docs/superpowers/specs/2026-09-24-cctv-health-monitoring-design.md`](file:///d:/Learning/CCTV%20Health%20Monitoring/docs/superpowers/specs/2026-09-24-cctv-health-monitoring-design.md)

## Global Constraints
- Minimal resource consumption: CPU and network footprint must be low so physical NVRs are never overwhelmed.
- Zero external database installation required (uses embedded SQLite database file).
- Mask RTSP credentials (passwords) in all web UI displays and API summary listings.
- No Node.js build pipeline required: Frontend is structured as clean modern HTML/JS/CSS served directly by FastAPI.
- Configurable failure criteria: Failure thresholds, timeouts, and warning thresholds must be dynamically loaded from settings.

## Review Focus
1. **Host-Aware Concurrency under Scale:** When 50+ channels point to the same NVR IP, requests must be throttled per host without deadlocking or starving other cameras.
2. **Credential Masking:** URLs with `rtsp://user:password@host...` must never expose cleartext passwords in UI responses.
3. **Flapping Prevention:** A camera must require $N$ consecutive failures before transitioning from `ONLINE` to `OFFLINE`.
4. **Graceful Frame Capture Timeouts:** If an RTSP stream hangs, the frame grab worker must abort after $N$ seconds without hanging the thread pool.
5. **CSV Format Edge Cases:** Malformed CSV rows, missing headers, or duplicate IPs/channels must be reported with actionable line numbers rather than crashing the import.

---

### Task 1: Project Setup, Dependencies & Database Models

**Files:**
- Create: `requirements.txt`
- Create: `app/__init__.py`
- Create: `app/database.py`
- Create: `app/models.py`
- Test: `tests/test_database.py`

**Interfaces:**
- Consumes: Python standard library, `pytest`, `aiosqlite`, `pydantic`
- Produces: `init_db()`, `get_db_connection()`, `Camera`, `Incident`, `SystemSettings` models

- [ ] **Step 1: Write the failing test for database initialization and CRUD**

```python
# tests/test_database.py
import pytest
import os
import asyncio
from app.database import init_db, get_db_path
from app.models import CameraRepository, IncidentRepository, SettingsRepository

@pytest.mark.asyncio
async def test_database_initialization_and_default_settings(tmp_path):
    test_db = str(tmp_path / "test_cctv.db")
    await init_db(test_db)
    
    settings_repo = SettingsRepository(test_db)
    settings = await settings_repo.get_all()
    assert "failure_threshold" in settings
    assert int(settings["failure_threshold"]) == 2
    assert "socket_timeout_ms" in settings

@pytest.mark.asyncio
async def test_camera_crud_and_masking(tmp_path):
    test_db = str(tmp_path / "test_cctv.db")
    await init_db(test_db)
    
    repo = CameraRepository(test_db)
    cam_id = await repo.create(
        name="Gate Cam",
        dvr_nvr_name="NVR-01",
        location="Front Gate",
        ip_address="192.168.1.100",
        port=554,
        channel_no="01",
        rtsp_url="rtsp://admin:mypassword123@192.168.1.100:554/ch1"
    )
    assert cam_id > 0
    
    cam = await repo.get_by_id(cam_id)
    assert cam["name"] == "Gate Cam"
    assert cam["masked_url"] == "rtsp://admin:*****@192.168.1.100:554/ch1"
    assert cam["rtsp_url"] == "rtsp://admin:mypassword123@192.168.1.100:554/ch1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_database.py`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement dependencies and database layer**

Create `requirements.txt`:
```
fastapi>=0.110.0
uvicorn>=0.28.0
aiosqlite>=0.20.0
pydantic>=2.6.0
python-multipart>=0.0.9
opencv-python-headless>=4.9.0.80
pillow>=10.2.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

Create `app/database.py` and `app/models.py` implementing SQLite table schemas (`cameras`, `incidents`, `settings`), url masking helper `mask_rtsp_url(url: str) -> str`, and async repository methods.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_database.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add requirements.txt app/ tests/test_database.py
git commit -m "feat: setup database layer, models, and masking logic"
```

---

### Task 2: Monitoring Engine - Fast Liveness & Host-Throttled Probes

**Files:**
- Create: `app/scanner.py`
- Test: `tests/test_scanner.py`

**Interfaces:**
- Consumes: `CameraRepository`, `SettingsRepository`
- Produces: `check_liveness(host, port, timeout_ms) -> (bool, latency_ms, error_msg)`, `HostThrottler` (concurrency semaphore per host), `ProbeWorker`

- [ ] **Step 1: Write the failing test for liveness checking & host throttler**

```python
# tests/test_scanner.py
import pytest
import asyncio
from app.scanner import check_tcp_liveness, HostThrottler

@pytest.mark.asyncio
async def test_tcp_liveness_success_and_failure():
    # Start a dummy server
    server = await asyncio.start_server(lambda r, w: w.close(), '127.0.0.1', 0)
    port = server.sockets[0].getsockname()[1]
    
    # Test valid open port
    success, latency, err = await check_tcp_liveness('127.0.0.1', port, timeout_ms=1000)
    assert success is True
    assert latency >= 0.0
    assert err is None
    
    server.close()
    await server.wait_closed()
    
    # Test closed port
    fail_success, _, fail_err = await check_tcp_liveness('127.0.0.1', port, timeout_ms=500)
    assert fail_success is False
    assert fail_err is not None

@pytest.mark.asyncio
async def test_host_throttler_concurrency():
    throttler = HostThrottler(max_per_host=2)
    active_counts = []
    
    async def worker(host):
        async with throttler.acquire(host):
            active_counts.append(throttler.get_active(host))
            await asyncio.sleep(0.05)
            
    await asyncio.gather(*(worker("192.168.1.10") for _ in range(5)))
    assert max(active_counts) <= 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_scanner.py`
Expected: FAIL (`app.scanner` does not exist)

- [ ] **Step 3: Implement `app/scanner.py`**

Implement:
- `check_tcp_liveness(host: str, port: int, timeout_ms: int) -> tuple[bool, float, str | None]`
- `HostThrottler`: maintains a dictionary of `asyncio.Semaphore` keyed by `host_ip`.
- `grab_rtsp_snapshot(rtsp_url: str, output_path: str, timeout_sec: int = 4)` using OpenCV `VideoCapture` executed in `asyncio.to_thread` with thread timeout.
- Frame validation: checks width/height, optional black-frame detection (mean pixel intensity check).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_scanner.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/scanner.py tests/test_scanner.py
git commit -m "feat: implement tcp liveness check and host throttler"
```

---

### Task 3: State Machine, Incident Logger & Configurable Failure Engine

**Files:**
- Create: `app/engine.py`
- Test: `tests/test_engine.py`

**Interfaces:**
- Consumes: `app/scanner.py`, `app/models.py`, `app/database.py`
- Produces: `MonitoringService`, `StateTransitionResult`, `process_camera_result(camera, success, latency, error)`

- [ ] **Step 1: Write the failing test for state machine and incident lifecycles**

```python
# tests/test_engine.py
import pytest
from app.database import init_db
from app.models import CameraRepository, IncidentRepository, SettingsRepository
from app.engine import StateMachine

@pytest.mark.asyncio
async def test_state_transitions_and_incidents(tmp_path):
    test_db = str(tmp_path / "test_engine.db")
    await init_db(test_db)
    
    cam_repo = CameraRepository(test_db)
    inc_repo = IncidentRepository(test_db)
    settings_repo = SettingsRepository(test_db)
    
    cam_id = await cam_repo.create(
        name="Corridor", dvr_nvr_name="NVR-01", location="1F",
        ip_address="192.168.1.50", port=554, channel_no="02",
        rtsp_url="rtsp://192.168.1.50:554/ch2"
    )
    
    sm = StateMachine(cam_repo, inc_repo, settings_repo)
    
    # 1st failure -> WARNING, no incident opened yet
    res1 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res1.new_status == "WARNING"
    assert res1.consecutive_failures == 1
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0
    
    # 2nd failure -> OFFLINE, incident opened
    res2 = await sm.process_check_result(cam_id, success=False, latency_ms=0, error="Timeout")
    assert res2.new_status == "OFFLINE"
    assert res2.consecutive_failures == 2
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 1
    assert active_incidents[0]["error_reason"] == "Timeout"
    
    # Recovery -> ONLINE, incident closed with duration
    res3 = await sm.process_check_result(cam_id, success=True, latency_ms=15.2, error=None)
    assert res3.new_status == "ONLINE"
    assert res3.consecutive_failures == 0
    active_incidents = await inc_repo.get_active(cam_id)
    assert len(active_incidents) == 0
    resolved = await inc_repo.get_by_id(res2.incident_id)
    assert resolved["resolved_at"] is not None
    assert resolved["duration_seconds"] >= 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_engine.py`
Expected: FAIL (`app.engine` not found)

- [ ] **Step 3: Implement `app/engine.py`**

Implement:
- `StateMachine` evaluating `failure_threshold`, `latency_warning_threshold_ms`, and `consecutive_failures`.
- Automated incident opening on reaching threshold and closing on recovery.
- Background task loops (`start_monitoring_loop`, `start_snapshot_loop`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_engine.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/engine.py tests/test_engine.py
git commit -m "feat: implement state machine, failure thresholding, and incident logging"
```

---

### Task 4: Alert Manager & Extensible Notification Stubs

**Files:**
- Create: `app/alerts.py`
- Test: `tests/test_alerts.py`

**Interfaces:**
- Consumes: `Incident`, `Camera`
- Produces: `AlertManager`, `BaseAlertNotifier`, `WebAlertNotifier` (SSE broadcaster), `EmailAlertNotifier` (stub), `TelegramAlertNotifier` (stub)

- [ ] **Step 1: Write failing test for alert dispatcher and SSE queues**

```python
# tests/test_alerts.py
import pytest
import asyncio
from app.alerts import AlertManager, WebAlertNotifier, EmailAlertNotifier, TelegramAlertNotifier

@pytest.mark.asyncio
async def test_alert_manager_sse_broadcast():
    alert_mgr = AlertManager()
    web_notifier = WebAlertNotifier()
    alert_mgr.register(web_notifier)
    
    queue = web_notifier.subscribe()
    
    await alert_mgr.dispatch_outage(
        camera={"id": 1, "name": "Entrance", "location": "Gate"},
        incident={"id": 10, "error_reason": "Connection Refused"}
    )
    
    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert msg["type"] == "CAMERA_DOWN"
    assert msg["camera"]["name"] == "Entrance"
    
    web_notifier.unsubscribe(queue)

@pytest.mark.asyncio
async def test_stubs_are_callable():
    email_notifier = EmailAlertNotifier()
    tg_notifier = TelegramAlertNotifier()
    assert hasattr(email_notifier, "send_alert")
    assert hasattr(tg_notifier, "send_alert")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_alerts.py`
Expected: FAIL

- [ ] **Step 3: Implement `app/alerts.py`**

Implement the pub/sub event broadcaster for live SSE updates to the web interface and modular stubs for email/Telegram.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_alerts.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/alerts.py tests/test_alerts.py
git commit -m "feat: implement alert manager with sse and notification stubs"
```

---

### Task 5: Bulk CSV Import, Export & Validation

**Files:**
- Create: `app/csv_utils.py`
- Test: `tests/test_csv_utils.py`

**Interfaces:**
- Consumes: Python standard `csv`, `io`
- Produces: `parse_and_validate_csv(csv_content: str) -> (list[dict], list[str])`, `generate_csv_template() -> str`, `export_cameras_to_csv(cameras: list[dict]) -> str`

- [ ] **Step 1: Write failing test for CSV validation and import/export**

```python
# tests/test_csv_utils.py
import pytest
from app.csv_utils import parse_and_validate_csv, generate_csv_template, export_cameras_to_csv

def test_csv_template_and_parsing():
    template = generate_csv_template()
    assert "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled" in template
    
    sample_csv = (
        "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled\n"
        "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://192.168.1.10:554/ch1,true\n"
        "Cam 2,NVR-A,Lobby,192.168.1.10,554,2,,true\n"  # missing rtsp_url
    )
    valid_rows, errors = parse_and_validate_csv(sample_csv)
    assert len(valid_rows) == 1
    assert len(errors) == 1
    assert "Row 3: rtsp_url is required" in errors[0]

def test_export_cameras_to_csv():
    cameras = [{
        "name": "Cam 1", "dvr_nvr_name": "NVR-A", "location": "Gate",
        "ip_address": "192.168.1.10", "port": 554, "channel_no": "1",
        "rtsp_url": "rtsp://192.168.1.10:554/ch1", "is_enabled": 1
    }]
    output = export_cameras_to_csv(cameras)
    assert "Cam 1" in output
    assert "rtsp://192.168.1.10:554/ch1" in output
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_csv_utils.py`
Expected: FAIL

- [ ] **Step 3: Implement `app/csv_utils.py`**

Implement parsing, clean error reporting per line number, header flexibility, and CSV generator.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_csv_utils.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/csv_utils.py tests/test_csv_utils.py
git commit -m "feat: implement robust CSV parser, validation, and export"
```

---

### Task 6: FastAPI REST API Endpoints & Simulation Mode

**Files:**
- Create: `app/main.py`
- Create: `app/routes.py`
- Create: `app/simulator.py` (generates 270 mock cameras and simulated outages for offline verification)
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: `app/models.py`, `app/engine.py`, `app/alerts.py`, `app/csv_utils.py`
- Produces: FastAPI app with routes:
  - `GET /api/cameras`, `POST /api/cameras`, `PUT /api/cameras/{id}`, `DELETE /api/cameras/{id}`
  - `POST /api/cameras/{id}/check` (manual trigger)
  - `POST /api/cameras/bulk-import`, `GET /api/cameras/export-csv`, `GET /api/cameras/template-csv`
  - `GET /api/incidents`, `GET /api/incidents/export-csv`, `POST /api/incidents/{id}/ack`
  - `GET /api/settings`, `POST /api/settings`
  - `GET /api/events` (SSE stream)
  - `POST /api/simulator/seed-270` (creates 270 mock cameras across 10 NVRs)

- [ ] **Step 1: Write failing test for API endpoints**

```python
# tests/test_api.py
import pytest
from httpx import AsyncClient
from app.main import create_app

@pytest.mark.asyncio
async def test_api_camera_endpoints(tmp_path):
    test_db = str(tmp_path / "test_api.db")
    app = create_app(db_path=test_db)
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Settings
        res = await client.get("/api/settings")
        assert res.status_code == 200
        assert "failure_threshold" in res.json()
        
        # Add Camera
        payload = {
            "name": "Test Cam", "dvr_nvr_name": "NVR-01", "location": "Yard",
            "ip_address": "127.0.0.1", "port": 554, "channel_no": "01",
            "rtsp_url": "rtsp://admin:secret@127.0.0.1:554/ch1"
        }
        res_post = await client.post("/api/cameras", json=payload)
        assert res_post.status_code == 201
        
        # List Cameras - password should be masked
        res_get = await client.get("/api/cameras")
        assert res_get.status_code == 200
        cams = res_get.json()
        assert len(cams) == 1
        assert "secret" not in cams[0]["masked_url"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api.py`
Expected: FAIL

- [ ] **Step 3: Implement `app/routes.py`, `app/simulator.py`, and `app/main.py`**

Wire the repositories, engine, background scheduler, and API endpoints together with proper error handling and status codes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/main.py app/routes.py app/simulator.py tests/test_api.py
git commit -m "feat: implement FastAPI endpoints, SSE event stream, and simulation seeder"
```

---

### Task 7: Multi-Tab Web Frontend (SPA)

**Files:**
- Create: `static/index.html`
- Create: `static/app.js`
- Create: `static/styles.css`
- Create: `static/audio/alert.mp3` (or synthetic web-audio beep fallback)
- Test: `tests/test_frontend_serving.py`

**Interfaces:**
- Consumes: `/api/*` REST endpoints & `/api/events` SSE stream
- Produces: Interactive SPA with:
  - Tab 1: **📊 Live Dashboard** (cards/table, stats counters, search, NVR/status filters, manual re-check, snapshot preview modal)
  - Tab 2: **⚠️ Incidents & Outages** (live outage timer, historical log, CSV download)
  - Tab 3: **⚙️ Camera Inventory** (add/edit modal with live "Test Connection" button, delete, toggle enabled)
  - Tab 4: **📥 Bulk CSV Import/Export** (template download, drag & drop CSV, validation table, export)
  - Tab 5: **🔧 System Settings & Alerts** (failure thresholds, timeouts, sound mute toggle, email & telegram stubs UI, 270 mock cameras generator)

- [ ] **Step 1: Write test to verify static files and SPA route are served**

```python
# tests/test_frontend_serving.py
import pytest
from httpx import AsyncClient
from app.main import create_app

@pytest.mark.asyncio
async def test_frontend_serving(tmp_path):
    app = create_app(db_path=str(tmp_path / "frontend.db"))
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/")
        assert res.status_code == 200
        assert "CCTV Health Monitor" in res.text
        assert "tab-dashboard" in res.text
        assert "tab-incidents" in res.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_frontend_serving.py`
Expected: FAIL

- [ ] **Step 3: Implement `static/index.html`, `static/app.js`, `static/styles.css`**

Build a clean, high-performance UI using Tailwind styling and modular Vanilla JS:
- Tab navigation system without page reloads.
- Audio synthesis via Web Audio API (`AudioContext`) for zero-dependency sound chimes (works without external mp3 files).
- SSE listener for auto-updating status pills, badge counts, and toasts.
- Real-time client-side search and multi-filtering across 270 cameras with zero lag.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_frontend_serving.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add static/ tests/test_frontend_serving.py
git commit -m "feat: implement multi-tab SPA dashboard, live alerts, and CSV UI"
```

---

### Task 8: End-to-End System Verification & 270-Camera Simulation

**Files:**
- Create: `tests/test_e2e_simulation.py`
- Create: `run.py` (convenience launcher)

**Interfaces:**
- Consumes: Whole application stack
- Produces: Fully verified 270-camera stress test, incident lifecycle verification, and executable launcher.

- [ ] **Step 1: Write failing E2E simulation test**

```python
# tests/test_e2e_simulation.py
import pytest
from httpx import AsyncClient
from app.main import create_app

@pytest.mark.asyncio
async def test_270_camera_simulation_lifecycle(tmp_path):
    app = create_app(db_path=str(tmp_path / "simulation.db"))
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Seed 270 mock cameras
        res_seed = await client.post("/api/simulator/seed-270")
        assert res_seed.status_code == 200
        assert res_seed.json()["count"] == 270
        
        # Verify listing
        res_list = await client.get("/api/cameras")
        assert len(res_list.json()) == 270
        
        # Simulate an outage on Camera #1
        res_fail = await client.post("/api/simulator/simulate-outage", json={"camera_id": 1})
        assert res_fail.status_code == 200
        
        # Check that incident is recorded
        res_inc = await client.get("/api/incidents")
        assert len(res_inc.json()["active"]) >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_e2e_simulation.py`
Expected: FAIL

- [ ] **Step 3: Implement launcher and simulation helper logic**

Create `run.py` with CLI flags:
- `python run.py --port 8000`
- `python run.py --seed-demo` (pre-seeds 270 cameras across 10 NVRs for immediate demo)

- [ ] **Step 4: Run all tests to verify entire suite passes**

Run: `pytest -v`
Expected: All tests pass across the entire test suite.

- [ ] **Step 5: Commit**

```bash
git add run.py tests/test_e2e_simulation.py
git commit -m "feat: add application launcher, seed demo, and e2e verification"
```
