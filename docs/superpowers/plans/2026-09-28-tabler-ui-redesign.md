# Tabler UI Enterprise Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CCTV Health Monitor frontend into an enterprise 24/7 NOC command console using Tabler UI while preserving zero-build Python deployment and 100% backend API compatibility.

**Architecture:** Integrate precompiled Tabler core CSS/JS into `static/vendor/tabler/` for zero-build, air-gapped readiness. Rebuild the single-page interface into an enterprise command header with live plant status beacon, modular NVR rack bay cards with custom high-contrast matrix tiles, an interactive Tabler activity timeline for incidents, and a right-sliding offcanvas drawer (`#camera-offcanvas`) replacing centered modals.

**Tech Stack:** Tabler UI v1.0.0-beta20 (Bootstrap 5 dark theme), Tabler Icons, Vanilla ES6 JavaScript, HTML5, CSS3, Python FastAPI backend, Playwright / Pytest for verification.

**Spec:** `docs/superpowers/specs/2026-09-28-tabler-ui-redesign.md`

## Global Constraints
- Native dark theme (`data-bs-theme="dark"`) on `<html>`.
- Zero Node.js / npm build step: Tabler distribution assets served directly from `static/vendor/tabler/`.
- 100% backward compatibility with existing FastAPI backend endpoints.
- High data density: Bird's-eye rack bay matrix tiles must remain compact, responsive, and clearly distinguish online, warning, offline, and spare (`No Cam`) ports.
- Inspection offcanvas sliding drawer (`#camera-offcanvas`) must replace centered modals for snapshot previews and channel management.

## Review Focus
- Offline air-gapped loading: All vendor stylesheets and scripts must load locally from `/static/vendor/tabler/` without external CDN requests.
- Live Snapshot stream rendering: The offcanvas drawer must show the live RTSP JPEG snapshot with OSD timestamp and retake functionality without closing the drawer.
- No Cam spare port toggling: Toggling a channel to/from "No Cam" must update the badge, rack tile appearance, and plant health uptime stats immediately.
- Audio outage chimes: The audio alert toggle must persist state and play pleasant recovery or warning chimes via Web Audio API without audio context errors.
- Real-time polling & sync: Heatmap and overview counters must automatically update during periodic scans and manual "Scan All Now" actions.

---

### Task 1: Vendor Assets & Static Serving Setup

**Files:**
- Create: `static/vendor/tabler/css/tabler.min.css`
- Create: `static/vendor/tabler/js/tabler.min.js`
- Create: `static/vendor/tabler/css/tabler-icons.min.css`
- Modify: `tests/test_frontend_serving.py`

**Interfaces:**
- Consumes: FastAPI `StaticFiles(directory="static")` in `app/main.py`
- Produces: Local HTTP paths `/static/vendor/tabler/css/tabler.min.css`, `/static/vendor/tabler/js/tabler.min.js`

- [ ] **Step 1: Write failing test for Tabler vendor assets**

Add test in `tests/test_frontend_serving.py`:
```python
def test_tabler_vendor_assets_served(client):
    css_res = client.get("/static/vendor/tabler/css/tabler.min.css")
    assert css_res.status_code == 200
    assert "tabler" in css_res.text.lower()
    
    js_res = client.get("/static/vendor/tabler/js/tabler.min.js")
    assert js_res.status_code == 200
    assert len(js_res.content) > 1000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_frontend_serving.py -k test_tabler_vendor_assets_served -v`  
Expected: FAIL with status code 404.

- [ ] **Step 3: Download and place Tabler vendor assets in `static/vendor/tabler/`**

Download Tabler core distribution CSS and JS (`tabler.min.css`, `tabler.min.js`) into `static/vendor/tabler/css/` and `static/vendor/tabler/js/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_frontend_serving.py -k test_tabler_vendor_assets_served -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add static/vendor/ tests/test_frontend_serving.py
git commit -m "chore(assets): add self-contained Tabler UI vendor assets"
```

---

### Task 2: Enterprise Shell, Command Header & Global Omnisearch

**Files:**
- Modify: `static/index.html:1-120`
- Modify: `static/styles.css`
- Modify: `static/app.js`

**Interfaces:**
- Consumes: Tabler CSS/JS vendor assets, `/api/cameras`, `/api/nvrs`
- Produces: Enterprise dark theme shell with live plant health beacon, omnisearch filter, audio toggle, and Tabler sub-navigation.

- [ ] **Step 1: Update HTML shell with Tabler page layout**

In `static/index.html`:
- Set `<html lang="en" data-bs-theme="dark">`.
- Link `/static/vendor/tabler/css/tabler.min.css` and custom `styles.css`.
- Add Tabler `.page` and `.navbar` header containing:
  - Brand with CCTV glyph and "CCTV Watchdog" subtitle.
  - Status beacon badge: `#plant-health-beacon` (e.g. `🟢 98.2% Operational • 256/270 Active`).
  - Omnisearch input: `#global-omnisearch` (`Ctrl+K` shortcut indicator).
  - Quick action controls: `#btn-audio-toggle` (icon button), `#btn-scan-all` (loader state), and Export dropdown.
- Add Tabler sub-navbar (`.nav.nav-tabs.nav-fill`) with tabs:
  - `tab-overview` (Fleet Overview)
  - `tab-visuals` (Visual Rack Bays)
  - `tab-incidents` (Incident Command Feed)
  - `tab-cameras` (Camera Inventory)
  - `tab-settings` (System & Watchdog)

- [ ] **Step 2: Add global omnisearch and beacon logic in `static/app.js`**

Implement:
- `updateHealthBeacon()`: Calculates active camera percentage and updates the beacon badge in the navbar with color coding (>95% green, 85-95% yellow, <85% red).
- Keyboard shortcut `Ctrl+K` to focus `#global-omnisearch`.
- Real-time filtering across active view based on query string.

- [ ] **Step 3: Verify shell rendering via test**

Run: `python -m pytest tests/test_frontend_serving.py -v`  
Expected: PASS (all tests pass).

- [ ] **Step 4: Commit**

```bash
git add static/index.html static/styles.css static/app.js
git commit -m "feat(ui): implement Tabler enterprise command header and sub-navbar"
```

---

### Task 3: Fleet Overview & KPI Metric Cards

**Files:**
- Modify: `static/index.html` (inside `#tab-overview`)
- Modify: `static/styles.css`
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `cameras` and `nvrMetadata` global state from `/api/cameras` and `/api/nvrs`
- Produces: KPI telemetry cards with progress ribbons, dynamic outage alert banner, and NVR health summary cards.

- [ ] **Step 1: Build Tabler KPI metric cards and outage banner in `index.html`**

In `static/index.html` inside `#tab-overview`:
- Add dynamic `#critical-outage-alert` container (`.alert.alert-danger` with list of down cameras and instant re-check button).
- Add 4 Tabler KPI cards:
  1. `Online Fleet` (`#stat-online` count, `#stat-total` active, `#stat-online-progress` progress bar).
  2. `Critical Outages` (`#stat-offline` count with jump-to-outages link).
  3. `Network Latency` (`#stat-avg-latency` ms with status indicator).
  4. `Spare Capacity` (`#stat-nocam` count of designated No Cam ports).
- Add `#nvr-summary-grid`: Grid of Tabler cards summarizing each recorder's health, IP, and online channel fraction.

- [ ] **Step 2: Implement dynamic metric updates in `static/app.js`**

Update `updateStats()` and add `renderNvrSummaryCards()`:
- Compute fleet metrics, average ping latency, and offline cameras.
- Render or hide `#critical-outage-alert` based on `offline > 0`.
- Populate `#nvr-summary-grid` with recorder cards, online ratio, and diagnostic buttons.

- [ ] **Step 3: Verify with pytest**

Run: `python -m pytest tests/test_frontend_serving.py -v`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add static/index.html static/styles.css static/app.js
git commit -m "feat(ui): add Tabler KPI telemetry cards and dynamic outage banner"
```

---

### Task 4: High-Density NVR Rack Bay Heatmap

**Files:**
- Modify: `static/index.html` (inside `#tab-visuals`)
- Modify: `static/styles.css`
- Modify: `static/app.js:renderVisuals`

**Interfaces:**
- Consumes: `cameras` list, `window.openCameraOffcanvas(id)`
- Produces: Modular Tabler cards for each recorder bay with high-contrast matrix channel tiles.

- [ ] **Step 1: Update Visuals tab layout and legend in `index.html`**

In `static/index.html` inside `#tab-visuals`:
- Header with title: `Fleet Status Matrix & Visual Analytics`.
- Tabler badge status legend:
  - `• Online` (green badge)
  - `• Warning` (amber badge)
  - `• Offline` (red badge)
  - `[---] No Cam (Spare)` (dashed border muted badge)
- Card container for `#heatmap-grid`.

- [ ] **Step 2: Redesign `renderVisuals()` in `static/app.js` and custom CSS**

Update `renderVisuals()`:
- For each NVR, render a Tabler `.card` with `.card-header`:
  - Recorder name, IP address, and channel ratio badge (`14/16 Online`).
  - Action button: `Diagnostics Audit`.
- Channel strip: Grid of `.heatmap-cell` tiles (01-32).
  - Online: `status-ONLINE` (bright green).
  - Warning: `status-WARNING` (bright amber).
  - Offline: `status-OFFLINE` (bright red with subtle pulse).
  - Spare: `status-NO_CAM` (dashed border, muted text).
- `onclick`: Call `openCameraOffcanvas(c.id)` instead of modal popup.
- Title/Tooltip: Shows formatted camera details and instructions.

- [ ] **Step 3: Verify heatmap rendering with pytest**

Run: `python -m pytest tests/test_frontend_serving.py -v`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add static/index.html static/styles.css static/app.js
git commit -m "feat(ui): redesign visual rack bays with modular Tabler cards and matrix tiles"
```

---

### Task 5: Tabler Offcanvas Sliding Inspection Drawer

**Files:**
- Modify: `static/index.html` (add `#camera-offcanvas`)
- Modify: `static/styles.css`
- Modify: `static/app.js`

**Interfaces:**
- Consumes: Camera ID, `/api/cameras/{id}/snapshot`, `/api/cameras/{id}/check`, `/api/cameras/{id}/toggle-no-cam`
- Produces: Sliding offcanvas inspection drawer (`#camera-offcanvas`) displaying live stream JPEG, telemetry, and actions.

- [ ] **Step 1: Add Tabler Offcanvas markup in `static/index.html`**

Add `#camera-offcanvas` using Tabler's `.offcanvas .offcanvas-end`:
```html
<div class="offcanvas offcanvas-end" tabindex="-1" id="camera-offcanvas" style="width: 540px;">
  <div class="offcanvas-header border-bottom">
    <div>
      <h3 class="offcanvas-title" id="drawer-cam-name">Camera Name</h3>
      <div class="text-muted small" id="drawer-cam-sub">NVR • Channel • Location</div>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
  </div>
  <div class="offcanvas-body">
    <!-- Live Snapshot View -->
    <div id="drawer-snapshot-container" class="card mb-3">
      <!-- Image frame + OSD details -->
    </div>
    <!-- Telemetry Grid -->
    <div id="drawer-telemetry" class="card mb-3">
      <!-- IP, Port, RTSP, Latency, Error -->
    </div>
    <!-- Action Toolbar -->
    <div id="drawer-actions" class="card mb-3">
      <!-- Snap, Ping, Toggle No Cam, Copy RTSP -->
    </div>
    <!-- Channel Incident History -->
    <div id="drawer-channel-history" class="card">
      <!-- Last outages for this channel -->
    </div>
  </div>
</div>
```

- [ ] **Step 2: Implement `openCameraOffcanvas(id)` in `static/app.js`**

Implement:
- Populates camera metadata, status badge, network target, latency, and last error.
- Triggers live snapshot capture via `/api/cameras/${id}/snapshot` with loading indicator and OSD timestamp.
- Sets up `#btn-drawer-snap` (Retake), `#btn-drawer-check` (Instant Ping), `#btn-drawer-toggle-nocam` (Toggle spare status), and `#btn-drawer-copy-rtsp`.
- Opens the drawer using `new bootstrap.Offcanvas(drawerEl).show()` (or Tabler fallback class `.show`).

- [ ] **Step 3: Verify offcanvas behavior**

Run: `python -m pytest tests/test_frontend_serving.py -v`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add static/index.html static/styles.css static/app.js
git commit -m "feat(ui): implement Tabler offcanvas inspection drawer with live snapshot"
```

---

### Task 6: Incident Command Timeline & Inventory Table

**Files:**
- Modify: `static/index.html` (inside `#tab-incidents` and `#tab-cameras`)
- Modify: `static/styles.css`
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `/api/incidents`, `/api/cameras`, Tabler `.timeline`
- Produces: Activity timeline for incidents and Tabler table for inventory.

- [ ] **Step 1: Implement Tabler `.timeline` in `#tab-incidents`**

Update `loadIncidents()` in `static/app.js`:
- Render active outages and incident history into a Tabler activity timeline:
  - Severity icons (red circle for down, green circle for recovered).
  - Outage duration counters (e.g. `Down for 12 mins`).
  - Cause / diagnostic error message.
  - Action button: `Test Channel Now`.

- [ ] **Step 2: Update Camera Inventory table in `#tab-cameras`**

Update `renderInventoryTable()`:
- Use Tabler `.table .table-vcenter .card-table .table-striped`.
- Status pills (`.badge.bg-success-lt`, `.badge.bg-danger-lt`, etc.).
- Direct action buttons (Snap, Check, Edit, No Cam, Del).

- [ ] **Step 3: Update Settings and Rename NVR forms**

Convert settings cards and rename modal to Tabler form controls (`.form-control`, `.form-select`, `.form-check-input`).

- [ ] **Step 4: Run test suite**

Run: `python -m pytest tests/ -v`  
Expected: All 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add static/index.html static/styles.css static/app.js
git commit -m "feat(ui): implement Tabler incident timeline, inventory table, and form controls"
```

---

### Task 7: End-to-End Verification & Browser Validation

**Files:**
- Test: Playwright browser verification script or direct tool run
- Test: Full backend pytest test suite

**Interfaces:**
- Consumes: Running FastAPI application on port 8000
- Produces: Verified dark theme rendering, functional offcanvas drawer, passing test report.

- [ ] **Step 1: Run full pytest suite**

Run: `python -m pytest`  
Expected: 14 passed.

- [ ] **Step 2: Validate via Playwright in browser**

Using Playwright browser tools:
- Navigate to `http://localhost:8000/`.
- Verify `<html data-bs-theme="dark">` is applied.
- Switch between all tabs (Fleet Overview, Visual Rack Bays, Incidents, Inventory, Settings).
- Click an active camera square to verify the right-side offcanvas drawer slides in with live snapshot and telemetry.
- Click a spare "No Cam" square to verify the offcanvas drawer shows the "Restore to Active" option.
- Test the audio toggle and omnisearch bar.

- [ ] **Step 3: Final clean commit**

```bash
git add .
git commit -m "feat(ui): complete Tabler UI enterprise redesign verification"
```
