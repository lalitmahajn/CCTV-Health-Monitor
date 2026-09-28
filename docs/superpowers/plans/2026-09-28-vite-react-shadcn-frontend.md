# Vite + React + Shadcn UI Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a brand-new, modern, build-based frontend in `frontend/` using Vite, React 19, TypeScript, Tailwind CSS, and Shadcn UI, featuring a full-width top navigation bar, high-density 270-port rack matrix with HoverCard previews, sliding right inspection drawer, telemetry charts, and seamless integration with the existing FastAPI backend.

**Architecture:** A modern single-page application (SPA) in `frontend/` powered by React and Tailwind CSS. During development, Vite's dev server proxies `/api` calls directly to FastAPI on port 8000. In production, Vite compiles into `frontend/dist/`, which FastAPI mounts and serves directly at `/`, maintaining pure Python deployment with zero Node.js server dependencies in production.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Lucide React, Radix UI (Shadcn UI primitives), Recharts (Shadcn Charts), Python FastAPI, SQLite.

**Spec:** [`docs/superpowers/specs/2026-09-28-vite-react-shadcn-frontend.md`](file:///d:/Learning/CCTV%20Health%20Monitoring/docs/superpowers/specs/2026-09-28-vite-react-shadcn-frontend.md)

---

## Global Constraints

- Backend endpoints, database schema, scanner engine, and SSE streams at `/api/` remain 100% backward-compatible and unchanged.
- Node.js (`v24.13.1`) and npm (`11.8.0`) are used for frontend development and building.
- Theme defaults to Dark Slate (`zinc`/`slate` palette with `#09090b` / `#18181b`) with a one-click Light Mode toggle in the top bar.
- Layout uses a top navigation bar (4 tabs: Dashboard, Incidents, Inventory, Settings) spanning 100% width.
- Camera inspection uses a smooth sliding right-side drawer (Shadcn Sheet) width ~480px.
- Live sound chimes use zero-dependency Web Audio API.

## Review Focus

1. **SSE Reconnection & Audio Chime**: When `/api/events` reconnects, ensure duplicate audio chimes are not triggered for existing outages.
2. **Anamorphic 16:9 Snapshot Ratio**: Live JPEG frame in drawer must render with `aspect-ratio: 16/9` and `object-fit: cover` so 1080N/D1 feeds do not distort.
3. **No Cam Spare Port Isolation**: Channels marked `is_no_cam: true` must render with dashed borders and be excluded from offline outage counters.
4. **Vite API Proxy**: In dev mode (`npm run dev`), all requests to `/api/*` and `/api/events` (SSE streaming) must proxy to `http://localhost:8000` without connection dropping.
5. **FastAPI Production Fallback**: If `frontend/dist/` exists, `app/main.py` serves `frontend/dist/index.html`; if not, it continues serving `static/index.html`.

---

### Task 1: Vite + React + Tailwind + TypeScript Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/index.css`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Node.js & npm
- Produces: Runnable Vite React SPA with Tailwind CSS and Shadcn dark slate CSS variables.

- [ ] **Step 1: Initialize `frontend/` package.json and install dependencies**

Install `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `vite`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `clsx`, `tailwind-merge`, and `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-hover-card`, `@radix-ui/react-slot`.

- [ ] **Step 2: Configure Vite, Tailwind, and Path Aliases**

Configure `frontend/vite.config.ts` with:
- `@` pointing to `frontend/src`.
- Proxy `/api` -> `http://localhost:8000`.
Configure `frontend/tailwind.config.js` with `darkMode: ["class"]`, slate/zinc colors, and animations.
Configure `frontend/src/index.css` with Shadcn CSS variables for light and dark modes.

- [ ] **Step 3: Verify build**

Run: `cd frontend; npm run build`  
Expected: Build passes, generates `frontend/dist/index.html` and assets.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Vite + React + Tailwind + TypeScript app"
```

---

### Task 2: Typed API Client, SSE Stream Hook, and Audio Alerts

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/audio.ts`
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/hooks/useCameraFleet.ts`
- Create: `frontend/src/hooks/useSSELiveStream.ts`

**Interfaces:**
- Consumes: FastAPI endpoints (`/api/cameras`, `/api/stats`, `/api/events`, `/api/incidents`)
- Produces: `useCameraFleet()` hook returning `{ cameras, stats, nvrs, isLoading, refresh }`, `useSSELiveStream()` hook with Web Audio chimes, and `api` client.

- [ ] **Step 1: Define TypeScript interfaces in `frontend/src/lib/types.ts`**

Define `Camera`, `NvrGroup`, `Stats`, `Incident`, `Settings`, `SSEEvent`.

- [ ] **Step 2: Implement API client in `frontend/src/lib/api.ts`**

Implement typed methods: `getCameras()`, `getStats()`, `getIncidents()`, `getSettings()`, `saveSettings()`, `scanAll()`, `checkCamera(id)`, `toggleNoCam(id)`, `getSnapshotUrl(id)`, `renameNvr(oldName, newName)`.

- [ ] **Step 3: Implement Web Audio API chimes in `frontend/src/lib/audio.ts`**

Implement `playChime(isOutage: boolean)` using oscillator nodes (urgent 440Hz/330Hz beep for down, pleasant 523Hz/659Hz chime for recovered).

- [ ] **Step 4: Implement `useCameraFleet` and `useSSELiveStream` hooks**

Connect `EventSource('/api/events')` to dispatch chimes on `CAMERA_DOWN` / `CAMERA_RECOVERED` and trigger refresh.

- [ ] **Step 5: Verify compilation and commit**

Run: `npm --prefix frontend run build`  
Expected: PASS with zero TypeScript errors.

```bash
git add frontend/src/lib/ frontend/src/hooks/
git commit -m "feat(frontend): implement typed API client, SSE hook, and Web Audio chimes"
```

---

### Task 3: Top Navigation Bar, Health Beacon, and Theme Toggle

**Files:**
- Create: `frontend/src/components/layout/TopNavbar.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Fleet stats from `useCameraFleet()`, active tab state
- Produces: Top navigation bar with 4 tabs (`Dashboard`, `Incidents`, `Inventory`, `Settings`), health beacon, sound toggle, theme switch.

- [ ] **Step 1: Create reusable Shadcn UI Button and Badge primitives**

Implement `Button` with variants (`default`, `secondary`, `outline`, `ghost`, `destructive`) and `Badge` (`default`, `secondary`, `destructive`, `outline`, `success`, `warning`).

- [ ] **Step 2: Implement `TopNavbar.tsx`**

Build:
- Left: Brand icon, title, and live health beacon (`🟢 100% Operational • 218/218 Active`).
- Center: Tab buttons (`Dashboard`, `Incidents`, `Inventory`, `Settings`) with active indicator line and dynamic outage badge counter.
- Right: `Scan All Now` button with loading spinner, Audio Chime button (`Sound: ON/OFF`), and Theme toggle (`Sun/Moon` icon).

- [ ] **Step 3: Test tab switching in `App.tsx`**

Verify clicking tabs changes active state and displays view container.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): implement top navigation bar, health beacon, and theme toggle"
```

---

### Task 4: Fleet Overview & Interactive Telemetry Visuals (Shadcn Charts)

**Files:**
- Create: `frontend/src/components/dashboard/SummaryMetrics.tsx`
- Create: `frontend/src/components/dashboard/CriticalOutageBanner.tsx`
- Create: `frontend/src/components/dashboard/TelemetryCharts.tsx`
- Create: `frontend/src/components/ui/card.tsx`

**Interfaces:**
- Consumes: Fleet stats & cameras array
- Produces: 4 KPI metric cards, conditional critical outage alert banner, and telemetry charts.

- [ ] **Step 1: Implement `SummaryMetrics.tsx`**

Render 4 cards:
1. Online Fleet (`218 / 218 Active`) with progress bar.
2. Critical Outages (`0 Outages, 0 Warnings`).
3. Socket Latency Ping (`21 ms Normal`).
4. Spare Ports (`48 Channels Unused (No Cam)`).

- [ ] **Step 2: Implement `CriticalOutageBanner.tsx`**

Renders when `stats.offline_cameras > 0`, displaying affected recorders and quick action buttons (`Re-Check Outages`, `View Incidents`).

- [ ] **Step 3: Implement `TelemetryCharts.tsx`**

Render:
1. Horizontal NVR capacity bars (Online vs Outage vs Spare ports).
2. Latency curve distribution (<20ms, 20-50ms, 50-100ms, >150ms).
3. Physical zone availability breakdown.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/components/ui/card.tsx
git commit -m "feat(frontend): implement KPI metric cards, outage banner, and telemetry charts"
```

---

### Task 5: High-Density Rack Bay Matrix & Shadcn HoverCard

**Files:**
- Create: `frontend/src/components/matrix/RackMatrixBay.tsx`
- Create: `frontend/src/components/matrix/ChannelTile.tsx`
- Create: `frontend/src/components/ui/hover-card.tsx`

**Interfaces:**
- Consumes: NVR groups, cameras list, `onSelectCamera(id: number)` callback
- Produces: 270-camera bird's-eye rack bay matrix with interactive hover previews.

- [ ] **Step 1: Implement Shadcn `HoverCard` primitive**

Wrap `@radix-ui/react-hover-card` with clean styling and smooth popover animation.

- [ ] **Step 2: Implement `ChannelTile.tsx`**

Render tile (01–32):
- Green background for ONLINE.
- Amber for WARNING.
- Red for OFFLINE (with pulse animation).
- Dashed border for NO CAM (spare port).
- Wrap in `HoverCard` displaying camera name, location, live latency ms, and click prompt.

- [ ] **Step 3: Implement `RackMatrixBay.tsx`**

Render NVR hardware card with name, IP, ratio badge (`14/18 Online`), and grid of `ChannelTile` components.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/matrix/ frontend/src/components/ui/hover-card.tsx
git commit -m "feat(frontend): implement 270-camera rack bay matrix with HoverCard previews"
```

---

### Task 6: Sliding Inspection Drawer (Shadcn Sheet)

**Files:**
- Create: `frontend/src/components/drawer/CameraDrawer.tsx`
- Create: `frontend/src/components/ui/sheet.tsx`

**Interfaces:**
- Consumes: Selected camera ID, camera details, action handlers
- Produces: Sliding right drawer (480px) with live snapshot, telemetry, and controls.

- [ ] **Step 1: Implement Shadcn `Sheet` primitive**

Wrap `@radix-ui/react-dialog` with slide-in from right animation (`slide-in-from-right duration-300`).

- [ ] **Step 2: Implement `CameraDrawer.tsx`**

Render:
- Drawer Header: Camera name, channel pill, recorder name, location.
- Live Snapshot Frame: 16:9 container fetching `/api/cameras/{id}/snapshot` with loading indicator, "Retake Frame" button, and OSD timestamp.
- Network Telemetry: Host IP, socket ping latency meter, and RTSP stream URL with copy button.
- Direct Actions: `Test Connection` (triggers live TCP check), `Edit Metadata`, `Toggle Spare (No Cam)`.

- [ ] **Step 3: Verify drawer interaction**

Verify clicking any matrix tile opens the drawer with live snapshot without losing page scroll.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/drawer/ frontend/src/components/ui/sheet.tsx
git commit -m "feat(frontend): implement sliding inspection drawer with live snapshot and stream controls"
```

---

### Task 7: Incident Command, Camera Inventory & Settings Views

**Files:**
- Create: `frontend/src/components/incidents/IncidentCommandView.tsx`
- Create: `frontend/src/components/inventory/CameraInventoryView.tsx`
- Create: `frontend/src/components/settings/SettingsView.tsx`
- Create: `frontend/src/components/modals/CameraModal.tsx`
- Create: `frontend/src/components/modals/RenameNvrModal.tsx`

**Interfaces:**
- Consumes: Incidents API, Cameras API, Settings API
- Produces: Fully functional Incidents view, Inventory view with Add/Edit/Delete modals, and Settings view.

- [ ] **Step 1: Implement `IncidentCommandView.tsx`**

Render:
- Active Outages Table: Camera name, recorder badge (`bg-cyan-500/15 text-cyan-400`), channel badge (`bg-purple-500/15 text-purple-400`), location, start time, error message, and Acknowledge button.
- Real-time live downtime duration counter (e.g. `4m 12s`).
- Incident History Table (last 100 resolved outages).

- [ ] **Step 2: Implement `CameraInventoryView.tsx`**

Render:
- Real-time search filter (name, IP, NVR, location, channel).
- Actions: `+ Add Camera` button, `Export Excel (.xlsx)` download button, CSV upload.
- Full table with status badges and action buttons (`Inspect`, `Edit`, `No Cam`, `Delete`).

- [ ] **Step 3: Implement `SettingsView.tsx`**

Render threshold form: failure threshold, socket timeout ms, ping interval seconds, latency warning ms, max concurrency per host.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/incidents/ frontend/src/components/inventory/ frontend/src/components/settings/ frontend/src/components/modals/
git commit -m "feat(frontend): implement Incident Command, Inventory table, and Settings views"
```

---

### Task 8: Production Build & FastAPI Integration Verification

**Files:**
- Modify: `app/main.py`
- Test: Full backend pytest test suite (`tests/`)
- Test: Playwright E2E browser verification

**Interfaces:**
- Consumes: `frontend/dist/`
- Produces: Production FastAPI app serving the compiled React bundle on `http://localhost:8000/`.

- [ ] **Step 1: Update `app/main.py` to mount `frontend/dist` when present**

```python
dist_path = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if dist_path.exists():
    app.mount("/assets", StaticFiles(directory=str(dist_path / "assets")), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(dist_path / "index.html"))
```

- [ ] **Step 2: Build frontend bundle**

Run: `npm --prefix frontend run build`  
Expected: Generates optimized bundle in `frontend/dist/`.

- [ ] **Step 3: Run backend pytest test suite**

Run: `python -m pytest`  
Expected: All 15 tests PASS.

- [ ] **Step 4: Verify in Playwright E2E browser**

Launch FastAPI server, navigate to `http://localhost:8000/`, verify:
1. 218 cameras online, 48 spare ports.
2. Clicking a matrix tile slides open the inspection drawer with live snapshot.
3. Switching between Dashboard, Incidents, Inventory, and Settings tabs works instantly.
4. Light / Dark mode toggle functions properly.

- [ ] **Step 5: Commit**

```bash
git add app/main.py
git commit -m "feat(server): mount and serve compiled Vite React frontend from FastAPI"
```
