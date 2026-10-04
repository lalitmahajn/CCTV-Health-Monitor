# Two-Tier (NVR Hardware + Camera Stream) Health Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the monitoring architecture into a Two-Tier Hierarchical Engine where Tier 1 tests NVR/DVR hardware liveness via TCP ping, and Tier 2 tests physical camera feed health via lightweight RTSP DESCRIBE probes, preventing false alarms and isolating root causes.

**Architecture:** 
1. **Tier 1 (NVR / Recorder Level):** Groups cameras by recorder IP and sends a rapid TCP ping to `NVR_IP:port`. If the NVR fails, short-circuits channel checks, marks the bay `OFFLINE`, and logs a single consolidated NVR incident.
2. **Tier 2 (Camera / Channel Level):** For active channels on healthy NVRs, probes the specific stream via lightweight RTSP `DESCRIBE`. Disconnected field cables and video loss are caught immediately without decoding video frames.

**Tech Stack:** Python 3.11, FastAPI, aiosqlite, asyncio (TCP & RTSP sockets), React 19, Tailwind CSS, Vite, Lucide icons.

**Spec:** Two-Tier CCTV Health Monitoring Architecture (Root-cause separation: Recorder Outage vs. Field Cable/Camera Video Loss).

---

## Global Constraints

- **Non-disruptive DB Migration:** Existing SQLite database tables must migrate cleanly without wiping existing camera fleet or historical incidents.
- **Fast Execution:** A full fleet check (154+ channels) must complete in under 5 seconds by leveraging per-host concurrency semaphores (2-3 simultaneous requests per NVR).
- **Zero Video Decoding Overhead:** Routine background health checks MUST NOT decode H.264/H.265 video packets; only lightweight RTSP headers (DESCRIBE/200 OK or 404/Video Loss) are exchanged.
- **Strict NVR Anti-Overload Protection:**
  - **Per-Host Throttling:** Never send more than `max_concurrency_per_host` (default: 2) simultaneous requests to any physical NVR IP.
  - **Inter-Probe Pacing:** Insert a 25ms-50ms breather pause between channel checks on the same NVR to allow embedded socket buffers to flush.
  - **Immediate Socket Closure:** Explicitly close reader/writer immediately after reading headers; no hanging sockets left in `ESTABLISHED` or `TIME_WAIT` on the NVR.
  - **Fast Timeouts:** Probe timeout capped at 2.0s; hung sockets are terminated fast so NVR thread pools never exhaust.
  - **Host Down Short-Circuit:** If Tier 1 TCP ping fails, exactly ZERO channel probes are sent to that NVR.
- **No Alert Storms:** A single NVR power outage must produce exactly ONE NVR incident and ONE consolidated notification, never 16 or 32 separate camera alerts.
- **Backward Compatibility:** Standalone IP cameras without an NVR or cameras without RTSP URLs must gracefully fallback to TCP ping.

---

## Review Focus

1. **NVR Outage Short-Circuiting:** When an NVR drops offline, ensure 16 separate RTSP socket timeouts do not occur; the bay and channels must fail fast in < 50ms.
2. **NVR Recovery Cascade:** When an NVR boots back up, its cameras must cleanly transition back through the state machine from `OFFLINE` to `ONLINE` with accurate latency.
3. **Field Cable Disconnection:** When NVR is alive but Channel 4 camera cable is unplugged, Channel 4 must transition to `OFFLINE` with error `"Video Loss / Channel Unavailable"` while the remaining 15 channels stay `ONLINE`.
4. **Digest Authentication Handling:** Dahua and Hikvision RTSP streams requiring MD5 Digest auth in `DESCRIBE` must authenticate successfully and return `200 OK`.
5. **UI Bay Alignment:** The Rack Matrix Bay view must visually differentiate between an entire NVR recorder being dead vs an individual camera channel having video loss.

---

## Deep Architectural Analysis Across All Layers

### 1. Database Layer (`app/database.py` & `app/models.py`)
- **`nvrs` Table Upgrade:**
  Add health telemetry columns so NVRs are monitored entities:
  - `status TEXT DEFAULT 'UNKNOWN'` (`ONLINE`, `OFFLINE`, `WARNING`, `UNKNOWN`)
  - `latency_ms REAL DEFAULT 0.0`
  - `last_checked DATETIME`
  - `last_seen DATETIME`
  - `consecutive_failures INTEGER DEFAULT 0`
  - `last_error TEXT`
- **`cameras` Table:**
  - `last_error TEXT`: Standardize error messages:
    - `"NVR_OFFLINE"`: Parent recorder is unreachable.
    - `"VIDEO_LOSS"`: NVR is reachable, but channel returned 404/503/No signal.
    - `"STREAM_TIMEOUT"`: RTSP handshake timed out.
    - `"AUTH_FAILED"`: Invalid credentials for channel.
- **`incidents` Table:**
  - Add optional `nvr_name TEXT`: Allows opening a single NVR-level incident (`incident_type = 'NVR'` vs `'CAMERA'`). When an NVR goes down, 1 NVR incident is opened instead of 16 camera incidents.

### 2. Backend Engine (`app/engine.py` & `app/scanner.py`)
- **Refactor `_monitoring_loop()`:**
  ```python
  # Step 1: Query active cameras and active NVRs
  # Step 2: Group cameras by host IP
  # Step 3: Run Tier 1 (TCP Ping on NVR IP)
  #         - If NVR fails: Mark NVR OFFLINE, cascade cameras to OFFLINE ("NVR_OFFLINE"), open NVR incident, skip Tier 2.
  # Step 4: Run Tier 2 (RTSP DESCRIBE per channel) for online NVRs
  #         - If 200 OK: Camera ONLINE
  #         - If 404/503/Video Loss: Camera OFFLINE ("VIDEO_LOSS")
  #         - If no RTSP URL: Fallback to TCP ping
  ```

### 3. Alerting & Notifications (`app/alerts.py`)
- Distinguish between **NVR Hardware Failure** (Critical) and **Individual Camera Loss** (Warning/Error):
  - **NVR Alert:** *"🚨 CRITICAL: NVR-Building-A is UNREACHABLE (Host TCP Timeout). 16 cameras impacted."*
  - **Camera Alert:** *"⚠️ CAMERA OUTAGE: Gate 1 (Ch 01) - Video Loss. NVR is healthy."*

### 4. UI & Frontend (`frontend/src/`)
- **Fleet Dashboard (`FleetDashboardView.tsx`):**
  - Add NVR Hardware health status indicator widget (`Recorders: 10/10 Online`).
- **Rack Matrix Bay (`RackMatrixBay.tsx`):**
  - Bay header receives an NVR status badge: `🟢 Recorder Online (1.8ms)` or `🔴 Recorder Unreachable`.
  - When recorder is unreachable, entire bay displays a subtle amber/red warning header.
- **Incidents View (`IncidentsView.tsx`):**
  - Displays NVR incidents prominently with an `"NVR Hardware"` tag versus `"Field Camera"` tag.

---

## Implementation Tasks

### Task 1: Database Schema Migration & Model Upgrades
**Files:**
- Modify: `app/database.py`
- Modify: `app/models.py`
- Test: `tests/test_database.py`

- [ ] **Step 1: Write failing test in `tests/test_database.py`**
  Assert that `nvrs` table supports `status`, `latency_ms`, `last_checked`, `last_seen`, `consecutive_failures`, `last_error`.
  Assert that `NvrRepository` has `update_status()` and `get_all()`.
- [ ] **Step 2: Run test to confirm failure**
  ```powershell
  python -m pytest tests/test_database.py
  ```
- [ ] **Step 3: Update `app/database.py` with migration**
  Add `ALTER TABLE nvrs ADD COLUMN ...` migrations inside `init_db()`.
- [ ] **Step 4: Update `NvrRepository` in `app/models.py`**
  Add `update_status(name, status, latency_ms, consecutive_failures, last_error)` and ensure `get_all()` returns health fields.
- [ ] **Step 5: Run tests and verify pass**
  ```powershell
  python -m pytest tests/test_database.py
  ```
- [ ] **Step 6: Commit changes**
  ```powershell
  git commit -m "feat(db): add health telemetry columns and repository methods for NVRs"
  ```

---

### Task 2: Robust RTSP Channel Prober (`probe_rtsp_url`) Refinement
**Files:**
- Modify: `app/scanner.py`
- Test: `tests/test_scanner.py`

- [ ] **Step 1: Write tests in `tests/test_scanner.py`**
  Test `probe_rtsp_url` for:
  - 200 OK (SDP session returned -> `STREAMING`)
  - 404 Not Found (Channel unassigned/disconnected -> `EMPTY` / `VIDEO_LOSS`)
  - 401 Unauthorized with Digest Auth challenge resolution
  - Host connection failure (TCP timeout / refused)
- [ ] **Step 2: Run tests to observe behavior**
  ```powershell
  python -m pytest tests/test_scanner.py
  ```
- [ ] **Step 3: Refine `probe_rtsp_url` in `app/scanner.py`**
  Ensure connection timeout is fast (1.5s - 2s), cleanly handles socket cleanup, extracts latency, and formats standardized error strings (`VIDEO_LOSS`, `AUTH_FAILED`, `TIMEOUT`).
- [ ] **Step 4: Run tests and verify pass**
  ```powershell
  python -m pytest tests/test_scanner.py
  ```
- [ ] **Step 5: Commit changes**
  ```powershell
  git commit -m "feat(scanner): standardize RTSP probe return codes for two-tier monitoring"
  ```

---

### Task 3: Two-Tier Monitoring Engine Implementation
**Files:**
- Modify: `app/engine.py`
- Test: `tests/test_engine.py`

- [ ] **Step 1: Write comprehensive test in `tests/test_engine.py`**
  Test two-tier flow:
  1. Simulated NVR TCP failure -> NVR marked OFFLINE, all its channels marked OFFLINE ("NVR_OFFLINE"), no RTSP attempts made.
  2. Simulated NVR TCP success + Channel RTSP DESCRIBE 200 OK -> Channel ONLINE.
  3. Simulated NVR TCP success + Channel RTSP DESCRIBE 404 Video Loss -> Channel OFFLINE ("VIDEO_LOSS"), NVR stays ONLINE.
- [ ] **Step 2: Run test to confirm failure**
  ```powershell
  python -m pytest tests/test_engine.py
  ```
- [ ] **Step 3: Implement Two-Tier Loop in `app/engine.py`**
  Refactor `_monitoring_loop()`:
  - Extract unique NVR host IPs from active cameras and `nvrs` table.
  - Step 1: Probe NVRs via `check_tcp_liveness(nvr_ip, nvr_port)`. Update NVR status in DB.
  - Step 2: For failed NVRs, cascade state change to all child cameras with reason `NVR_OFFLINE`.
  - Step 3: For alive NVRs, run throttled RTSP DESCRIBE (`probe_rtsp_url`) across child channels. Transition camera state via `state_machine.process_check_result()`.
- [ ] **Step 4: Run tests and verify pass**
  ```powershell
  python -m pytest tests/test_engine.py
  ```
- [ ] **Step 5: Commit changes**
  ```powershell
  git commit -m "feat(engine): implement two-tier hierarchical monitoring loop"
  ```

---

### Task 4: NVR Incident Management & Alerting
**Files:**
- Modify: `app/models.py` (IncidentRepository)
- Modify: `app/alerts.py`
- Modify: `app/routes.py`
- Test: `tests/test_alerts.py`

- [ ] **Step 1: Write tests in `tests/test_alerts.py`**
  Test that NVR outage triggers single consolidated alert with affected channel count.
- [ ] **Step 2: Update IncidentRepository & Alerts**
  - Allow `create_nvr_incident()` and `resolve_nvr_incident()` or group camera incidents by NVR.
  - Format distinct email subjects and HTML templates for NVR Power/Network outages vs Camera video loss.
- [ ] **Step 3: Run tests and verify pass**
  ```powershell
  python -m pytest tests/test_alerts.py
  ```
- [ ] **Step 4: Commit changes**
  ```powershell
  git commit -m "feat(alerts): add consolidated NVR hardware outage notifications"
  ```

---

### Task 5: UI Enhancements (Rack Bay Headers & Dashboard Telemetry)
**Files:**
- Modify: `frontend/src/components/matrix/RackMatrixBay.tsx`
- Modify: `frontend/src/components/dashboard/FleetDashboardView.tsx`
- Modify: `frontend/src/lib/types.ts`
- Modify: `app/routes.py` (ensure `/api/nvrs` returns live health fields)

- [ ] **Step 1: Update API types in `frontend/src/lib/types.ts`**
  Add `status`, `latency_ms`, `last_error` to `Nvr` interface.
- [ ] **Step 2: Update `/api/nvrs` endpoint in `app/routes.py`**
  Return complete NVR health telemetry.
- [ ] **Step 3: Enhance `RackMatrixBay.tsx`**
  Render NVR hardware status pill in the bay header:
  - `🟢 Recorder Online (2ms)`
  - `🔴 Recorder Unreachable` (highlights entire bay with alert banner)
- [ ] **Step 4: Enhance `FleetDashboardView.tsx`**
  Add "Recorders / NVRs" summary metric card (e.g. `10/10 Online`).
- [ ] **Step 5: Build frontend and verify no compilation errors**
  ```powershell
  cd frontend; npm run build; cd ..
  ```
- [ ] **Step 6: Commit changes**
  ```powershell
  git commit -m "feat(ui): display NVR hardware health badges and recorder capacity metrics"
  ```

---

### Task 6: Full System Integration & Regression Testing
**Files:**
- Run full suite: `tests/`
- Build Windows Installer: `installer.iss`

- [ ] **Step 1: Run complete automated test suite**
  ```powershell
  python -m pytest tests/
  ```
- [ ] **Step 2: Run End-to-End Simulation**
  Verify simulation mode correctly exercises NVR outage and channel video loss scenarios.
- [ ] **Step 3: Recompile PyInstaller & Inno Setup packages**
  Build production `CCTV_Health_Monitor_Setup_v1.0.2.exe`.
- [ ] **Step 4: Commit & push to main**
  ```powershell
  git push origin main
  ```
