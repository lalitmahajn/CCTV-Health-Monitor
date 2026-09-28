# Vite + React + Shadcn UI Enterprise Frontend Specification

- **Date**: 2026-09-28
- **Status**: Draft (Pending Review)
- **System**: CCTV Health Monitoring Watchdog
- **Stack**: React 19 / Vite / TypeScript / Tailwind CSS / Shadcn UI / Radix UI / Recharts
- **Backend Integration**: Python FastAPI (endpoints unchanged at `/api/`)

---

## 1. Executive Summary

This specification outlines the architecture and design of a clean-slate modern frontend for the CCTV Health Monitoring Watchdog system. Built in a dedicated `frontend/` directory using **Vite, React, TypeScript, Tailwind CSS, and Shadcn UI**, this frontend provides high-density operational telemetry, zero-latency feedback, interactive channel matrixes with `HoverCard` previews, and sliding inspection drawers.

All existing backend FastAPI routes, models, SQLite databases, and Server-Sent Events (SSE) streaming mechanisms remain 100% backward-compatible and untouched.

---

## 2. Navigation & Layout Architecture

The application adopts a **Top Navigation Bar** architecture spanning the full width of the screen, maximizing horizontal real estate for wide data tables and dense 27-to-32-port camera rack matrixes.

### 2.1 Top Command Header
- **Branding & Beacon**:
  - CCTV Watchdog brand icon and title.
  - **Live Plant Health Beacon**: Live status badge (`🟢 100% Operational • 218/218 Active` or `🚨 2 Outages Detected`).
- **4 Core Navigation Tabs**:
  1. **Dashboard**: Real-time fleet KPI metrics, interactive telemetry charts, and NVR recorder bays with instant Matrix Grid vs Table View switcher.
  2. **Incidents**: Real-time active outage feed with continuous downtime counters and root-cause diagnostic badges, plus historical incident logs. Dynamically displays a red count badge when active outages exist (`Incidents [2]`).
  3. **Inventory**: Comprehensive searchable and filterable table of all cameras with CRUD actions, one-click formatted Excel export (`.xlsx`), and CSV import/template downloads.
  4. **Settings**: Threshold configurations (consecutive failure attempts, socket timeout ms, ping check interval, latency warning threshold) and NVR channel audit diagnostic probe tool.
- **Header Actions**:
  - `Ctrl+K` Global Omnisearch input (search camera by name, IP, channel, or location).
  - `Scan All Now` button with animated scanning state.
  - Audio Chime toggle (`Sound: ON / OFF`) using zero-dependency Web Audio API.
  - Light / Dark Theme toggle (defaults to Dark Slate).

---

## 3. Detailed Views & Visualizations

### 3.1 Tab 1: Dashboard & Visual Matrix
- **Metric Cards (Top Strip)**:
  - **Online Fleet**: Count & percentage of active cameras responding to socket probes (e.g. `218 / 218 Active`).
  - **Critical Outages**: Number of offline cameras and latency warnings.
  - **Avg Socket Ping**: Real-time average response time in ms with status pill (`Normal`, `Elevated`, `High`).
  - **Spare Ports (No Cam)**: Number of designated spare channels isolated from outage statistics (`48 Channels Unused`).
- **Critical Outage Alert Banner**:
  - Conditional banner that renders only when outages are detected, identifying affected recorders with quick actions: `Re-Check Outages` and `View Incidents Feed`.
- **Telemetry Charts (Shadcn Charts / Recharts)**:
  - **NVR Channel Allocation**: Horizontal stacked bar chart displaying active online vs outages vs spare port capacity across each of the 10 NVRs.
  - **Network Latency Histogram**: Smooth area chart plotting response latency distribution across all responding cameras (<20ms, 20-50ms, 50-100ms, >150ms).
  - **Physical Zone Availability**: Visual breakdown of camera health across plant zones (Admin, Warehouse, Production Lines, Perimeter, IT Server Rooms).
- **NVR Grouped Recorder Bays**:
  - View switcher: Toggle between **Matrix View** and **Table View**.
  - Header per recorder: NVR Name, Host IP, port capacity ratio badge (`14/18 Online`), and NVR Rename / Port Audit actions.
  - **Matrix View (High Density)**:
    - Grid of tiles (01-32) color-coded:
      - 🟢 Emerald: Online & responding.
      - 🟡 Amber: Latency warning.
      - 🔴 Crimson: Offline outage (with subtle alert pulse).
      - ◻️ Dashed Slate: "No Cam" spare port (muted, non-distracting).
    - **Shadcn HoverCard**: Hovering any tile presents an instant floating inspection card showing camera name, location, current latency ms, last checked time, and prompt to slide open inspection drawer.
  - **Table View**:
    - Compact rows displaying channel, name, location, IP:port, latency, and action buttons.

### 3.2 Tab 2: Incident Command
- **Active Outages Section**:
  - Table of currently unreachable channels.
  - Columns: Camera Name, NVR / DVR Name (`bg-azure-lt` badge), Channel (`bg-purple-lt` monospace badge), Location, Outage Started Timestamp, Root Cause / Error Message, and `Acknowledge` action button.
  - Real-time client-side downtime duration counter (e.g., `Down for 4m 12s`).
- **Incident History Section**:
  - Table of the last 100 resolved outages.
  - Columns: Camera, Recorder, Channel, Location, Started At, Resolved At, Total Downtime Duration, Error Details.

### 3.3 Tab 3: Camera Inventory
- Search input with real-time debounce for filtering by name, NVR, location, IP address, or channel.
- Action toolbar: `+ Add Camera` button and `Export Excel (.xlsx)` download button.
- Comprehensive table with columns:
  - Camera Name
  - Recorder & Channel
  - Location
  - Endpoint (`IP:Port`)
  - RTSP Stream URL (masked with one-click copy button)
  - Status Badge (with glowing status dot)
  - Action Buttons: `Inspect` (opens Sheet), `Edit`, `Toggle Spare (No Cam)`, `Delete`.
- **Bulk CSV & Excel Operations Card**:
  - Formatted Excel spreadsheet export.
  - Raw CSV export & CSV template download.
  - File upload input for importing cameras in bulk.

### 3.4 Tab 4: Settings & Diagnostics
- **Threshold Settings Card**:
  - Consecutive Failure Threshold (attempts before marking OFFLINE).
  - Socket Ping Timeout in ms.
  - Ping Check Interval in seconds.
  - High Latency Warning Threshold in ms.
  - Max Concurrency Per Host (NVR Overload Protection).
- **NVR Channel Audit Diagnostic Card**:
  - Trigger RTSP DESCRIBE audit sweeps on any recorder to probe physical hardware streaming ports.

---

## 4. Sliding Inspection Drawer (Shadcn Sheet)

Clicking any camera in the matrix tiles, dashboard table, or inventory table smoothly slides open a 480px right-side drawer (`Sheet` component) without losing the user's scroll position:

1. **Header**:
   - Camera name, physical channel number, recorder name, and location.
2. **Monitoring State & Telemetry Card**:
   - Live status badge (`ONLINE`, `WARNING`, `OFFLINE`, `NO CAM`).
   - Roundtrip socket ping latency display.
   - Diagnostic message / last error details.
3. **Live RTSP Stream Frame (Snapshot)**:
   - Live JPEG frame captured via `/api/cameras/{id}/snapshot`.
   - Auto aspect-ratio correction (16:9).
   - "Retake Frame" button with loading spinner.
   - OSD overlay indicator (Camera name and timestamp).
4. **Network Endpoint & Stream URI**:
   - Host IP & RTSP port.
   - RTSP Stream URL input with one-click `Copy` button.
5. **Direct Operations**:
   - `Test Connection` button (triggers immediate live TCP probe).
   - `Edit Metadata` button (opens edit modal).
   - `Toggle Spare (No Cam)` button with informative explainer text describing how spare channels are isolated from outage statistics.

---

## 5. State Management & Real-Time SSE Stream

- **Query / Fetch Layer**: Typed API client interacting with FastAPI backend routes.
- **Server-Sent Events (`useSSELiveStream`)**:
  - Connects to `/api/events` via `EventSource`.
  - Dispatches Web Audio API sound chimes on state transitions:
    - Urgent dual-tone alert on `CAMERA_DOWN`.
    - Harmonious upward chime on `CAMERA_RECOVERED`.
  - Automatically triggers queries to refresh cameras, stats, and active incidents upon incoming event.
  - Displays non-intrusive floating toasts (`sonner` / Shadcn Toast).

---

## 6. Build Pipeline & Deployment

### 6.1 Directory Structure
```
d:\Learning\CCTV Health Monitoring\
├── app/                  # FastAPI backend (untouched)
├── frontend/             # New Vite + React application
│   ├── package.json
│   ├── vite.config.ts    # Configured with proxy: /api -> http://localhost:8000
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   └── dist/             # Production build artifacts
```

### 6.2 Development Mode
- Running `npm run dev` in `frontend/` starts Vite on port 5173.
- All `/api` requests are proxied seamlessly to `http://localhost:8000`.

### 6.3 Production Mode
- Running `npm run build` bundles the app into `frontend/dist/`.
- `app/main.py` is configured with a fallback check:
  - If `frontend/dist` exists, mount static assets and serve `frontend/dist/index.html` as the root frontend.
  - Preserves 100% pure Python deployment without requiring Node.js to be running in production.

---

## 7. Verification & Acceptance Criteria

1. **Build Verification**: `npm run build` succeeds in `frontend/` with zero TypeScript or bundling errors.
2. **Backend Serving**: FastAPI serves the production build at `http://localhost:8000/`.
3. **Telemetry & Real Data**: The dashboard accurately displays all 218 active cameras, 48 spare channels, and real ping latencies from the production database.
4. **Interactive Matrix**: Clicking any tile in the 270-port rack bay slides open the Shadcn Sheet with the live snapshot frame and telemetry.
5. **Real-Time Alerting**: SSE events correctly update the UI and trigger audio chimes.
6. **Backend Tests**: All 15 existing pytest tests continue to pass.
