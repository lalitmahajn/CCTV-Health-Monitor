# Tabler UI Enterprise Redesign - Architectural Specification

**Date:** 2026-09-28  
**Status:** In Review  
**Author:** Pair Programming Session  
**Target:** Frontend SPA Redesign (`static/index.html`, `static/styles.css`, `static/app.js`, `static/vendor/tabler/`)

---

## 1. Executive Summary & Goals

The **CCTV Health Monitor** oversees 270 physical camera channels distributed across 12 enterprise NVRs/DVRs in an industrial manufacturing plant. The current UI uses custom, basic HTML/CSS. 

This specification defines a comprehensive architectural redesign using **[Tabler UI](https://tabler.io)** (MIT-licensed, Bootstrap 5-based enterprise dashboard toolkit). The objective is to elevate the frontend from a basic list of boxes into a **true 24/7 Network Operations Center (NOC) Command Console** without creating a 1:1 replica of the current layout.

### Core Objectives:
1. **Enterprise NOC Aesthetic**: Native dark theme (`data-bs-theme="dark"`) optimized for 24/7 control room monitors with low eye fatigue, crisp vector icons (Tabler Icons), and clear visual status hierarchy.
2. **High-Density Multi-Panel Architecture**: Restructure navigation and layouts so plant operators can view fleet health, drill into NVR rack bays, and inspect individual channels without losing overall context.
3. **Sliding Inspection Drawer (Tabler Offcanvas)**: Replace disruptive centered popups with a smooth right-hand sliding drawer for live snapshots, latency diagnostics, and camera actions.
4. **Zero-Build, Pure Python Deployment**: Maintain the project's zero-npm/zero-bundler architecture. All Tabler assets are self-contained in `static/vendor/tabler/` and served directly by FastAPI, ensuring out-of-the-box operation on isolated plant LAN servers.
5. **100% Backend API Compatibility**: Preserve all existing FastAPI REST endpoints (`/api/cameras`, `/api/incidents`, `/api/cameras/{id}/snapshot`, `/api/cameras/{id}/check`, `/api/cameras/{id}/toggle-no-cam`, `/api/export-excel`, etc.).

---

## 2. Information Architecture & Layout Structure

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TABLER NAVBAR / COMMAND BAR                                                          │
│  [Logo] CCTV Watchdog  |  🟢 98.2% Operational (256/270 Active)  |  [🔍 Omnisearch]    │
│  [🔊 Chime Toggle]  [⚡ Scan All Now]  [📥 Export Dropdown]                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TABLER SUB-NAVBAR                                                                    │
│  [📊 Fleet Overview]   [🗺️ Visual Heatmap]   [🚨 Incidents (3)]   [📹 Inventory]  [⚙️]  │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  PAGE BODY (DYNAMIC TAB CONTAINER)                                                     │
│                                                                                        │
│  Tab 1: Fleet Overview                                                                 │
│  - Top KPI Metric Cards with progress ribbons (Online, Outages, Latency, Spares)       │
│  - Critical Outage Alert Banner (dynamic when offline > 0)                             │
│  - Recorder Health Grid (NVR cards with channel capacity, diagnostics & rename actions)│
│                                                                                        │
│  Tab 2: Visual Rack Bays & Heatmap                                                     │
│  - Enterprise Legend: [● Online] [● Warning] [● Offline] [--- No Cam (Spare)]          │
│  - Modular NVR Rack Cards with mini channel matrix strips                             │
│                                                                                        │
│  Tab 3: Incident Command Feed                                                          │
│  - Tabler Activity Timeline (`.timeline`) with MTTR, error codes, and quick-check btns │
│                                                                                        │
│  Tab 4: Camera Inventory & Channel Management                                         │
│  - Tabler Data Table with inline search, recorder filter, status pills, and actions    │
│                                                                                        │
│  Tab 5: System & Watchdog Settings                                                     │
│  - Watchdog thresholds, ping intervals, Telegram alerts, and sound preferences         │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┬──────────────────────────────┐
│                                                         │ TABLER OFFCANVAS DRAWER      │
│  Background: Heatmap or Overview                        │ (Slides in from right)       │
│                                                         │ - Camera Title & NVR Ch info │
│                                                         │ - Status Pill & Ping Latency │
│                                                         │ - Live Stream Snapshot (JPG) │
│                                                         │ - OSD Inspection Notes       │
│                                                         │ - Direct Action Buttons:     │
│                                                         │   [📷 Snap] [⚡ Check]        │
│                                                         │   [🚫 No Cam] [📋 Copy RTSP]  │
│                                                         │ - Recent Channel Outages     │
└─────────────────────────────────────────────────────────┴──────────────────────────────┘
```

---

## 3. Component Details & Visual Specifications

### 3.1. Top Command Header
- **Brand & Live Beacon**: Includes camera glyph and pulsing dot representing active polling. Displays real-time uptime percentage (e.g. `256/266 active online • 96.2%`).
- **Omnisearch Input**: Quick filter input in the navbar (`Ctrl + K`) allowing instant filtering of cameras by name, channel, location, or IP address.
- **Action Buttons**:
  - `Scan All Now`: Tabler button with spinning loader icon during scan cycles.
  - `Sound Chimes`: Interactive button showing speaker icon state (`🔊 Sound: ON` / `🔇 Sound: OFF`).
  - `Export`: Dropdown button offering `Export Formatted Excel (.xlsx)` and `Export Standard CSV`.

### 3.2. Tab 1: Fleet Overview & Telemetry
- **Row of 4 Metric Cards (`.card` + `.card-body`)**:
  1. **Online Fleet**: Bold number of active healthy cameras, green sub-badge, and inline progress bar showing plant uptime percentage.
  2. **Active Outages**: Red accent card displaying offline cameras. If > 0, includes a quick link button to filter directly to down units.
  3. **Average Network Latency**: Average roundtrip ping across all recorders in milliseconds with color-coded status (<50ms normal, >100ms warning).
  4. **Spare / Empty Channels**: Total designated "No Cam" ports across all recorders, clearly indicating unused recorder capacity.
- **Dynamic Critical Outage Banner**:
  - If 1 or more cameras drop offline, an alert banner (`.alert .alert-danger`) renders at the top of the Overview, listing affected units with an instant `Check Now` button.
- **Recorder / NVR Registry Cards**:
  - Table or card grid displaying each recorder (Admin DVR 1, Aspirin 1, Maintenance DVR 5, etc.), its IP address, online/total channel fraction, a mini progress bar, and action buttons (`Port Diagnostics`, `Rename`).

### 3.3. Tab 2: Visual Rack Bays & Bird's-Eye Heatmap
- **Status Legend**:
  - `• Online (Green)` | `• Warning (Amber)` | `• Offline (Red)` | `[---] No Cam / Spare (Muted Dashed)`.
- **Modular NVR Rack Bays**:
  - Each NVR is housed in an individual Tabler card.
  - Card Header: Recorder name, host IP, online ratio badge (`14/16 Online`), and a quick audit action icon.
  - Rack Bay Strip: High-contrast rectangular tiles representing channels 01 to 32.
  - **Tile Interaction**: Clicking any tile opens the right-hand **Sliding Offcanvas Drawer** (no sudden modal pops).
  - **Tile Hover**: Shows native Tabler popover/tooltip with camera name, channel, location, latency, and status.

### 3.4. Sliding Inspection Drawer (Tabler Offcanvas: `#camera-offcanvas`)
- Replaces the old centered modal dialogs.
- Features:
  1. **Header**: Camera display name, Channel number (e.g., `Ch 04`), Recorder badge, and close button.
  2. **Status Banner**: Live monitoring badge (`ONLINE`, `OFFLINE`, `WARNING`, or `SPARE / NO CAM`) with latency diagnostic.
  3. **Live Snapshot Preview**:
     - Large, crisp JPEG frame captured via RTSP with OSD timestamp inspection.
     - "Retake Snapshot" button with inline loading spinner.
  4. **Network Telemetry Grid**:
     - Host IP, Port, RTSP Stream URI (with one-click "Copy URL" button).
     - Diagnostic details, ping latency, and last checked timestamp.
  5. **Direct Actions Toolbar**:
     - `⚡ Test Connection` (runs instantaneous ping probe).
     - `📷 Retake Snapshot`.
     - `🚫 Mark as "No Cam"` / `✓ Restore to Active` (clearly toggles spare port status).
     - `✏️ Edit Camera Details` (opens metadata form).
  6. **Channel Incident History**:
     - Shows the last 3 outages or health status changes for this specific camera.

### 3.5. Tab 3: Incident Command (Timeline Activity Feed)
- Uses Tabler’s native `.timeline` component.
- Each event shows:
  - Timestamp (e.g., `10:42 AM Today`).
  - Severity Icon (Red exclamation for offline, green check for recovery).
  - Camera name, recorder, location, and reason (`RTSP Handshake Timeout`, `Packet Loss`).
  - Outage duration counter (e.g., `Down for 18 mins` or `Recovered after 4 mins`).
  - Action button: `Test Now` to verify recovery immediately.

### 3.6. Tab 4: Camera Inventory Table
- Tabler table with `.table-vcenter .table-hover`:
  - Columns: Status, Channel, Camera Name, Recorder, Location, IP Target, Latency, Actions.
  - Search box with real-time keystroke filtering.
  - Action buttons: Snapshot, Check, Edit, No Cam toggle, Delete.

---

## 4. Technical Architecture & File Organization

### 4.1. Directory Structure
```
static/
├── vendor/
│   └── tabler/
│       ├── css/
│       │   ├── tabler.min.css         # Tabler Core v1.0.0-beta20 (Dark mode built-in)
│       │   └── tabler-icons.min.css   # Tabler Vector Icons
│       └── js/
│           └── tabler.min.js          # Tabler Core JS (Offcanvas, Tooltips, Dropdowns)
├── app.js                             # SPA controller (modular logic, API bindings)
├── styles.css                         # CCTV custom CSS overrides & heatmap matrix styles
└── index.html                         # Tabler enterprise single-page layout
```

### 4.2. Zero-Build Asset Strategy
- Tabler's compiled distribution CSS and JS are stored directly in `static/vendor/tabler/`.
- No Node.js runtime, npm install, or bundler build steps are required.
- The entire system runs directly from Python:
  ```bash
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- Works seamlessly in offline, air-gapped factory networks.

---

## 5. Implementation Stages

| Stage | Scope | Deliverables |
| :--- | :--- | :--- |
| **Stage 1: Assets & Core Shell** | Download & verify Tabler vendor assets; set up `index.html` with dark theme shell, command header, and sub-nav. | `static/vendor/tabler/*`, Tabler shell in `static/index.html`. |
| **Stage 2: Fleet Overview & KPI Telemetry** | Build Tabler metric cards, progress ribbons, and dynamic outage banner. | Overview tab with live plant health stats. |
| **Stage 3: Rack Bays & Heatmap** | Redesign NVR Bay Cards with Tabler styling, status dots, and spare channel styling. | High-density visual heatmap tab. |
| **Stage 4: Tabler Offcanvas Drawer** | Implement `#camera-offcanvas` for live snapshot preview, telemetry, and quick actions. | Sliding inspection drawer replacing center modals. |
| **Stage 5: Incident Timeline & Inventory** | Rebuild Incident feed using Tabler `.timeline` and inventory table with Tabler classes. | Modern incident feed and camera table. |
| **Stage 6: Verification & Test Suite** | Run full `pytest` suite and Playwright browser verification across all tabs and offcanvas interactions. | Passing tests, zero regressions, browser screenshots. |

---

## 6. Verification & Acceptance Criteria

1. **Dark Theme Quality**: `<html data-bs-theme="dark">` renders with proper contrast, crisp vector icons, and no visual glare.
2. **Offcanvas Interaction**: Clicking any heatmap square or table row slides open the right-side inspection drawer; closing it leaves the background view intact.
3. **No Cam Legend & Interaction**: The legend clearly shows `[---] No Cam (Spare)` and users can toggle spare status with explicit feedback.
4. **Live Actions Verified**: Snapshot capture, single camera check, and scan-all execute properly with feedback toasts and status updates.
5. **Automated Tests**: All 14 existing pytest unit/API/scanner tests pass without any modification to backend endpoints.
6. **Air-gapped Readiness**: Application loads completely and functions with zero external internet access.
