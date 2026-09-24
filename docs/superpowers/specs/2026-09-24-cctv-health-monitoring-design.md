# CCTV Health Monitoring System - Architectural Design Specification

**Date:** 2026-09-24  
**Status:** Approved  
**Author:** Pair Programming Session  

---

## 1. Executive Summary & Objective

In an enterprise environment with approximately 270+ CCTV cameras connected through various NVRs and DVRs, manual verification of camera feeds is labor-intensive, error-prone, and slow to detect blind spots.

The **CCTV Health Monitoring System** is an automated, 24/7 lightweight monitoring solution designed to:
1. Continuously verify camera reachability and stream health without overloading physical NVRs/DVRs.
2. Maintain a 24/7 audit log of all downtime incidents, durations, and error causes.
3. Provide instantaneous web UI alerts (visual badges, toast notifications, audio chimes).
4. Provide a rich Single-Page Application (SPA) with dedicated tabs for live dashboards, incident logs, single camera management, CSV bulk import/export, and settings.
5. Provide extensible notification stubs for future integrations (Email/SMTP, Telegram bot).

---

## 2. Key Constraints & Guiding Principles

1. **Zero / Minimal Load on NVRs & DVRs:**
   - Many RTSP URLs share the same physical NVR IP via channel paths.
   - Continuous 24/7 stream decoding of 270 feeds would cripple recorder CPUs and flood network switches.
   - **Solution:** Hybrid probe strategy with host-level concurrency limits.
2. **Flapping Prevention:**
   - Network jitter must not cause false alarms. Cameras require configurable consecutive failures (default: 2) before transitioning to `OFFLINE`.
   - Automatic recovery logging when healthy again.
3. **Operational Security:**
   - Passwords inside RTSP URLs must be masked in web dashboard views to prevent credential exposure on monitoring displays.
4. **Offline / Standalone Capable:**
   - Built on Python + SQLite + self-contained web assets so it can run entirely inside an isolated local network (LAN) without external cloud dependencies.

---

## 3. System Architecture & Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      CCTV Health Monitoring System                       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     Web Frontend (Responsive SPA)                  │  │
│  │  Tabs: [📊 Dashboard] [⚠️ Incidents] [⚙️ Cameras] [📥 CSV] [🔧 Settings]  │
│  └──────────────────────────────────▲─────────────────────────────────┘  │
│                                     │ REST APIs + SSE (Live Updates)     │
│  ┌──────────────────────────────────▼─────────────────────────────────┐  │
│  │                    FastAPI Application Server                      │  │
│  │  - Camera CRUD & CSV Parser                                        │  │
│  │  - Incident History & Export APIs                                  │  │
│  │  - Real-time Event Broadcaster (SSE)                               │  │
│  │  - On-Demand Probe Trigger API                                     │  │
│  └──────────────────┬───────────────────────────────▲─────────────────┘  │
│                     │                               │                    │
│                     ▼                               │ Status & Incidents │
│  ┌─────────────────────────────────────┐            │                    │
│  │           SQLite Database           │            │                    │
│  │  - cameras                          │            │                    │
│  │  - incidents                        │            │                    │
│  │  - system_settings                  │            │                    │
│  └──────────────────▲──────────────────┘            │                    │
│                     │                               │                    │
│  ┌──────────────────┴───────────────────────────────┴─────────────────┐  │
│  │                      Monitoring Engine Service                     │  │
│  │                                                                    │  │
│  │  1. Fast Liveness Loop (TCP Socket Ping, e.g., every 30-60s)       │  │
│  │  2. Staggered Frame Probe Worker (Substream grab, e.g., 5-15m)     │  │
│  │  3. Host-Grouping Concurrency Throttler (Semaphore: max 1-2/host)  │  │
│  │  4. State Transition & Incident Engine                             │  │
│  └──────────────────┬─────────────────────────────────────────────────┘  │
│                     │                                                    │
│                     ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        Alert Dispatcher                            │  │
│  │  - Active UI Event Stream (SSE notifications & audio trigger)      │  │
│  │  - [Stub] Email / SMTP Notification Handler                        │  │
│  │  - [Stub] Telegram Bot Notification Handler                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ RTSP (Port 554) / TCP Ping
                                      ▼
             [270+ Cameras across multiple NVRs / DVRs / Direct IPs]
```

---

## 4. Multi-Stage Monitoring Strategy

### 4.1 Stage 1: Fast Liveness Probe (Every 30–60 Seconds)
- Performs a non-blocking asynchronous TCP socket handshake to the camera/NVR host and RTSP port (default 554).
- Measures round-trip network latency in milliseconds.
- CPU and network overhead is negligible (bytes per check).

### 4.2 Stage 2: Staggered RTSP Frame Grab (Every 5–15 Minutes)
- Runs in a low-priority background queue.
- Selects cameras one by one with a host-aware semaphore (maximum 1–2 simultaneous stream handshakes per physical NVR/DVR IP).
- Connects to the RTSP stream with a strict 4-second timeout.
- Grabs a single keyframe (preferably from the camera's substream), verifies frame dimensions $> 0$ (confirming non-corrupt video stream), generates a small preview thumbnail, and immediately closes the RTSP stream.

### 4.3 Configurable Failure Definition & Thresholds
The criteria for declaring a check or camera as **FAILED** or **OFFLINE** is fully configurable in the Settings UI and per camera override:
1. **Consecutive Failure Threshold:** (Default: `2` attempts, configurable from `1` to `5`) before an outage incident is opened and alerts are fired.
2. **Ping / Socket Timeout:** (Default: `3000ms`, configurable from `500ms` to `10000ms`).
3. **High Latency / Slow Response Warning Threshold:** (Default: `1500ms` - marks camera as `WARNING` if ping response exceeds this).
4. **RTSP Frame Verification Failure Criteria (Toggleable):**
   - *TCP Connection Failure / Port Closed* (Always active)
   - *RTSP Handshake / Auth Error (401/403/404)* (Always active)
   - *Frame Read Timeout:* Exceeding $N$ seconds (Default: `4s`)
   - *Black / Blank Screen Detection (Optional Toggle):* Flag as failure/warning if mean pixel intensity is below a configurable threshold (e.g. $< 10$).
   - *Frozen Feed Detection (Optional Toggle):* Flag if consecutive snapshots remain identical beyond $N$ frames.

### 4.4 State Transition Model
- **`ONLINE`:** Check passes. Consecutive failures reset to 0.
- **`WARNING`:** 1 failure observed, or latency exceeds warning threshold, or minor stream anomaly detected. No alarm sounded yet; logged for tracking.
- **`OFFLINE`:** Consecutive failures reach or exceed the configured `failure_threshold`.
  - Open new record in `incidents`.
  - Push immediate critical alert to the Web UI via SSE.
  - Set camera status to `OFFLINE`.
- **`RECOVERY`:** If status was `OFFLINE` and a subsequent check passes:
  - Close the active incident with `resolved_at` timestamp and compute `duration_seconds`.
  - Push recovery notification to the Web UI via SSE.
  - Reset status back to `ONLINE`.

---

## 5. Data Models & Database Schema

SQLite database (`cctv_monitor.db`):

### 5.1 `cameras` Table
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Unique ID |
| `name` | TEXT NOT NULL | Friendly camera name (e.g. "Main Gate Entrance") |
| `dvr_nvr_name` | TEXT | Recorder identifier (e.g. "NVR-Building-A") |
| `location` | TEXT | Physical location (e.g. "Ground Floor Lobby") |
| `ip_address` | TEXT NOT NULL | Host IP of camera or NVR |
| `port` | INTEGER DEFAULT 554 | RTSP port |
| `channel_no` | TEXT | Channel identifier (e.g. "Ch 04", "102") |
| `rtsp_url` | TEXT NOT NULL | Full RTSP URL with credentials |
| `status` | TEXT DEFAULT 'UNKNOWN'| `ONLINE`, `WARNING`, `OFFLINE`, `DISABLED` |
| `consecutive_failures` | INTEGER DEFAULT 0 | Count of sequential errors |
| `latency_ms` | REAL DEFAULT 0.0 | Most recent ping latency |
| `last_checked` | DATETIME | Timestamp of last probe |
| `last_seen` | DATETIME | Timestamp when last verified healthy |
| `last_error` | TEXT | Most recent error reason |
| `thumbnail_path` | TEXT | Path to latest preview image |
| `is_enabled` | BOOLEAN DEFAULT 1 | Whether monitoring is active |

### 5.2 `incidents` Table
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Unique incident record ID |
| `camera_id` | INTEGER REFERENCES cameras(id) | Camera foreign key |
| `started_at` | DATETIME NOT NULL | When the camera went down |
| `resolved_at` | DATETIME | When camera recovered (NULL while active) |
| `duration_seconds`| INTEGER | Total outage duration in seconds |
| `error_reason` | TEXT | Reason for failure |
| `acknowledged` | BOOLEAN DEFAULT 0 | Marked by operator in UI |

### 5.3 `settings` Table
Key-value configuration store for:
- `ping_interval_seconds` (default: 30)
- `snapshot_interval_seconds` (default: 600)
- `failure_threshold` (default: 2 consecutive failures)
- `socket_timeout_ms` (default: 3000)
- `latency_warning_threshold_ms` (default: 1500)
- `enable_black_screen_detection` (default: false)
- `enable_frozen_frame_detection` (default: false)
- `max_concurrency_per_host` (default: 2)
- `enable_audio_alert` (default: true)
- `simulation_mode` (default: false)

---

## 6. Web Interface (SPA) Design & Tab Structure

A modern, responsive, dark/light theme web application served directly from FastAPI:

1. **Top Navigation Bar:**
   - System title & live clock.
   - Quick counters: Total, Online 🟢, Warning 🟡, Offline 🔴.
   - Audio Alert Toggle (Mute / Unmute chime).
   - Global Manual Trigger button ("Scan All Now").
   - Navigation Tabs:
     - **📊 Live Dashboard**
     - **⚠️ Incidents & Outages**
     - **⚙️ Camera Inventory**
     - **📥 Bulk CSV Import / Export**
     - **🔧 System Settings**

2. **Tab 1: Live Dashboard:**
   - Filter bar: Search by camera name, IP, DVR/NVR, location, or channel.
   - Quick filter buttons: `All`, `Offline Only`, `Warning Only`, `Online Only`.
   - Grid / Table toggle view.
   - Card displays: Camera name, Location badge, DVR/NVR name & Channel, Status pill, Latency meter, Last checked time, and thumbnail preview with click-to-enlarge.
   - Quick "Re-test" button per camera.

3. **Tab 2: Incidents & Outages:**
   - Active Incidents panel (currently down cameras with live elapsed downtime counter).
   - Historical Incident Log table: Camera, DVR/NVR, Location, Start time, End time, Duration, Error details.
   - "Export Incidents to CSV" button.

4. **Tab 3: Camera Inventory:**
   - Complete list of configured cameras with full details.
   - "Add Single Camera" modal with built-in "Test Connection & Grab Snapshot" verification before saving.
   - Edit, delete, and enable/disable toggle.
   - RTSP password masking with toggle to show/hide.

5. **Tab 4: Bulk CSV Import / Export:**
   - "Download Sample CSV Template" button.
   - File drag-and-drop upload for importing up to 270+ cameras simultaneously.
   - Pre-import validation table showing errors or duplicate URLs before confirming database commit.
   - "Export All Cameras to CSV" button for backup.

6. **Tab 5: System Settings & Alert Stubs:**
   - Intervals and failure thresholds configuration.
   - Notification Stubs panel:
     - Email (SMTP) Configuration UI & Test button (ready for activation).
     - Telegram Bot Token & Chat ID Configuration UI (ready for activation).
   - Mock / Simulation Mode toggle for safe offline testing.

---

## 7. Extensibility & Alert Stubs

An abstract `BaseAlertNotifier` class will be implemented:
```python
class BaseAlertNotifier(ABC):
    @abstractmethod
    async def send_alert(self, camera: Camera, incident: Incident) -> bool:
        pass

    @abstractmethod
    async def send_recovery(self, camera: Camera, incident: Incident) -> bool:
        pass
```
Implementations:
- `WebAlertNotifier`: Dispatches live SSE events to connected UI clients. (Active)
- `EmailAlertNotifier`: SMTP client stub. (Configurable stub)
- `TelegramAlertNotifier`: Bot API stub. (Configurable stub)

---

## 8. Development & Verification Strategy

1. **Unit & Integration Tests:**
   - Test TCP socket liveness check with mock servers.
   - Test State Machine (transitions from Online $\to$ Warning $\to$ Offline $\to$ Recovery).
   - Test CSV parser with valid and malformed rows.
   - Test REST API endpoints (Cameras, Incidents, Settings).
2. **Simulation Mode for 270 Cameras:**
   - Built-in simulation generator to populate 270 realistic cameras across ~10 NVRs to verify UI responsiveness, sorting, search, and batch check performance.
3. **End-to-End Verification:**
   - Start the service, load the dashboard, import sample CSV, trigger simulated outages, verify audio/visual alerts and incident logging.
