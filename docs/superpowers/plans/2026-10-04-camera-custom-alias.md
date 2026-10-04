# Camera Custom Alias & System Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-defined custom `alias` parameter for CCTV cameras across backend and frontend, displaying custom names everywhere on the UI while retaining immutable system/NVR-reported names with a one-click "Use default or system name" option.

**Architecture:** 
1. Database schema migration adds an optional `alias TEXT DEFAULT NULL` column to `cameras` table in SQLite.
2. Backend API routes and Pydantic models permit setting, updating, and clearing `alias` (empty string reverts to `None`/`NULL`).
3. Frontend presents read-only "System Name" and editable "Custom Alias" with a "Use default or system name" action in the Camera Edit modal.
4. Matrix tiles, drawer inspect, inventory, and search query filters use the alias as primary display name while keeping the hardware NVR name visible as secondary telemetry.

**Tech Stack:** Python 3.11, FastAPI, aiosqlite, SQLite3, React 18, TypeScript, Tailwind CSS, Vite.

**Spec:** User request dated 2026-10-04 requesting "additional field name for our custom name 'Alias' shown on UI and also show system provided name but not editable and if i wanted to show system name i need option like 'Use default or system name'".

## Global Constraints
- Preserve existing camera identification parameters (`id`, `ip_address`, `port`, `channel_no`) intact.
- Physical NVR communication (RTSP, ONVIF, CGI) must continue using `channel_no` and hardware IP, completely unaffected by `alias`.
- Background health scans (`app/engine.py`) and sync scripts (`sync_nvrs_to_db.py`) must only update hardware telemetry and system `name`; they must never overwrite user `alias`.
- Setting alias to empty string `""` or clicking "Use default or system name" must clear `alias` to `NULL`, automatically falling back to system `name`.
- Do not build `.exe` until the user explicitly requests it.

## Review Focus
1. Updating a camera with empty alias `""` clears `alias` in database to `NULL` so queries fall back to system `name`.
2. Setting a custom alias updates the display name in Matrix Bay tiles, Hover Tooltips, and Camera Drawer without breaking RTSP streaming.
3. Inventory search matches either the system hardware name or the custom alias.
4. Camera Edit modal disables the System Name input field preventing accidental overwrite of physical recorder channel titles.
5. CSV import and export preserve the `alias` column while maintaining backward compatibility with legacy CSV files lacking an `alias` column.

---

### Task 1: Database Migration & Repository Layer for Camera Alias

**Files:**
- Modify: `app/database.py:46-55`
- Modify: `app/models.py:17-30, 99-115`
- Modify: `app/routes.py:25-45`
- Test: `tests/test_database.py`

**Interfaces:**
- Consumes: `aiosqlite.Connection`
- Produces: `cameras.alias` column, `CameraRepository.create(..., alias: Optional[str] = None)`, `CameraRepository.update(..., alias: Optional[str])`, `CameraUpdate.alias: Optional[str]`

- [ ] **Step 1: Write the failing test for camera alias CRUD in `tests/test_database.py`**

```python
@pytest.mark.asyncio
async def test_camera_alias_crud(db_path):
    repo = CameraRepository(db_path)
    cam_id = await repo.create(
        name="D4C1-RECEPTION",
        ip_address="192.168.0.245",
        rtsp_url="rtsp://admin:pass@192.168.0.245:554/cam1",
        channel_no="1",
        alias="Front Lobby Reception"
    )
    cam = await repo.get_by_id(cam_id)
    assert cam["name"] == "D4C1-RECEPTION"
    assert cam["alias"] == "Front Lobby Reception"

    # Update alias
    await repo.update(cam_id, alias="Main Reception Desk")
    cam = await repo.get_by_id(cam_id)
    assert cam["alias"] == "Main Reception Desk"

    # Reset alias to None (Use default system name)
    await repo.update(cam_id, alias=None)
    cam = await repo.get_by_id(cam_id)
    assert cam["alias"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_database.py -k test_camera_alias_crud -v`
Expected: FAIL with `sqlite3.OperationalError: table cameras has no column named alias` or `TypeError: unexpected keyword argument 'alias'`

- [ ] **Step 3: Implement database migration and repository support**

In `app/database.py`:
```python
# Migration: add alias column if existing database doesn't have it
try:
    await db.execute("ALTER TABLE cameras ADD COLUMN alias TEXT DEFAULT NULL")
except Exception:
    pass
```

In `app/models.py`:
Update `create()` signature and SQL insert to include `alias`.
In `update()`, add `"alias"` to `allowed` fields and normalize empty string `""` to `None`.

In `app/routes.py`:
Add `alias: Optional[str] = None` to `CameraCreate` and `CameraUpdate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_database.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/database.py app/models.py app/routes.py tests/test_database.py
git commit -m "feat(db): add alias column and repository CRUD support for cameras"
```

---

### Task 2: API Endpoints, CSV Import/Export, and Reset Handling

**Files:**
- Modify: `app/csv_utils.py:6-38, 120-180`
- Modify: `app/routes.py:340-355`
- Test: `tests/test_api.py`
- Test: `tests/test_csv_utils.py`

**Interfaces:**
- Consumes: `CameraRepository`
- Produces: `GET /api/cameras` returning `alias`, `PUT /api/cameras/{id}` updating `alias`, `export_cameras_to_csv` exporting `alias`, `parse_and_validate_csv` parsing `alias`

- [ ] **Step 1: Write failing tests for API and CSV with alias**

In `tests/test_api.py`:
```python
@pytest.mark.asyncio
async def test_update_camera_alias_and_reset(client, auth_headers):
    # Create test camera
    res = await client.post("/api/cameras", json={
        "name": "CAM-01-ORIG",
        "ip_address": "192.168.1.100",
        "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/ch1",
        "alias": "Custom Lobby"
    }, headers=auth_headers)
    assert res.status_code == 200
    cam_id = res.json()["id"]

    # Verify alias returned in GET
    get_res = await client.get("/api/cameras", headers=auth_headers)
    cam = next(c for c in get_res.json() if c["id"] == cam_id)
    assert cam["alias"] == "Custom Lobby"
    assert cam["name"] == "CAM-01-ORIG"

    # Reset alias to use default system name
    put_res = await client.put(f"/api/cameras/{cam_id}", json={
        "alias": ""
    }, headers=auth_headers)
    assert put_res.status_code == 200

    get_res2 = await client.get("/api/cameras", headers=auth_headers)
    cam2 = next(c for c in get_res2.json() if c["id"] == cam_id)
    assert cam2["alias"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api.py -k test_update_camera_alias_and_reset -v`
Expected: FAIL

- [ ] **Step 3: Implement API update logic and CSV alias support**

In `app/routes.py`:
Ensure `PUT /api/cameras/{id}` converts `alias: ""` to `None` so database sets `alias = NULL`.
In `app/csv_utils.py`:
Add `"alias"` to `CSV_HEADERS` and handle optional alias in parser and exporter.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_api.py tests/test_csv_utils.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/csv_utils.py app/routes.py tests/test_api.py tests/test_csv_utils.py
git commit -m "feat(api): support camera alias update, reset to default, and CSV handling"
```

---

### Task 3: Frontend TypeScript Definitions & Name Resolution Utility

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/utils.ts`

**Interfaces:**
- Produces: `Camera.alias?: string | null`, `getCameraDisplayName(cam: { name: string; alias?: string | null }): string`

- [ ] **Step 1: Add `alias` property to `Camera` in `frontend/src/lib/types.ts`**

```typescript
export interface Camera {
  id: number;
  name: string;
  alias?: string | null;
  dvr_nvr_name: string;
  location: string;
  ip_address: string;
  port: number;
  channel_no: string;
  rtsp_url: string;
  status: 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNKNOWN' | 'NO_CAM';
  consecutive_failures: number;
  latency_ms: number;
  last_checked: string | null;
  last_seen: string | null;
  last_error: string | null;
  thumbnail_path: string | null;
  is_enabled: boolean;
  is_no_cam: boolean;
}
```

- [ ] **Step 2: Add `getCameraDisplayName` in `frontend/src/lib/utils.ts`**

```typescript
export function getCameraDisplayName(camera?: { name: string; alias?: string | null } | null): string {
  if (!camera) return '';
  if (camera.alias && camera.alias.trim()) {
    return camera.alias.trim();
  }
  return camera.name || 'Unnamed Camera';
}
```

- [ ] **Step 3: Commit changes**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/utils.ts
git commit -m "feat(frontend): add camera alias type definition and display name helper"
```

---

### Task 4: Camera Inventory Table & Edit Modal with Alias and "Use Default" Option

**Files:**
- Modify: `frontend/src/components/inventory/CameraInventoryView.tsx`

**Interfaces:**
- Consumes: `Camera`, `getCameraDisplayName`
- Produces: Read-only System Name display, editable Custom Alias input with "Use default or system name" reset button, dual-name inventory table column, and multi-field search.

- [ ] **Step 1: Update Add/Edit Form State in `CameraInventoryView.tsx`**

Include `alias: ''` in `formData`.
When opening edit modal for a camera:
```typescript
setFormData({
  name: cam.name,
  alias: cam.alias || '',
  dvr_nvr_name: cam.dvr_nvr_name || '',
  location: cam.location || '',
  ip_address: cam.ip_address,
  port: cam.port || 554,
  channel_no: cam.channel_no || '',
  rtsp_url: cam.rtsp_url || '',
  is_enabled: cam.is_enabled,
  is_no_cam: Boolean(cam.is_no_cam),
});
```

- [ ] **Step 2: Update Modal UI with Non-Editable System Name and Alias Input**

In edit modal:
1. **System Name (Hardware / NVR)** field:
   - `<Input disabled value={formData.name} className="bg-muted text-muted-foreground font-mono cursor-not-allowed" />`
   - Subtext: *"Hardware channel title from recorder (read-only)"*
2. **Custom Alias** field:
   - Header with label and action button:
     ```tsx
     <div className="flex items-center justify-between">
       <label className="text-xs font-semibold">Custom Alias</label>
       {formData.alias && (
         <Button
           type="button"
           variant="ghost"
           size="xs"
           className="text-[11px] h-6 text-primary hover:underline px-1"
           onClick={() => setFormData({ ...formData, alias: '' })}
         >
           Use default or system name
         </Button>
       )}
     </div>
     <Input
       value={formData.alias}
       placeholder="Enter custom friendly name (e.g. Main Reception Desk)"
       onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
     />
     ```

- [ ] **Step 3: Update Inventory Table Column and Search Filter**

In Table Row:
- If `cam.alias`:
  - Primary text: `<span className="font-semibold text-foreground text-xs">{cam.alias}</span>`
  - Secondary badge: `<span className="text-[10px] font-mono text-muted-foreground block">System: {cam.name}</span>`
- If no `cam.alias`:
  - Primary text: `<span className="font-semibold text-foreground text-xs">{cam.name}</span>`

In Search filtering:
- Match `c.name`, `c.alias`, `c.ip_address`, `c.location`, and `c.dvr_nvr_name`.

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/components/inventory/CameraInventoryView.tsx
git commit -m "feat(inventory): add custom alias editing, non-editable system name, and reset option"
```

---

### Task 5: Matrix Bay, Channel Tiles, and Drawer Integration

**Files:**
- Modify: `frontend/src/components/matrix/ChannelTile.tsx`
- Modify: `frontend/src/components/matrix/RackMatrixBay.tsx`
- Modify: `frontend/src/components/drawer/CameraDrawer.tsx`
- Modify: `frontend/src/components/incidents/IncidentCommandView.tsx`

**Interfaces:**
- Consumes: `Camera`, `getCameraDisplayName`
- Produces: Everywhere on UI shows custom alias with system hardware name fallback and inspector tooltips.

- [ ] **Step 1: Update `ChannelTile.tsx`**

- Use `displayName = getCameraDisplayName(camera)` on tile surface.
- In hover tooltip:
  - If `camera.alias`:
    - Show `displayName` in bold.
    - Show `[HW: {camera.name}]` in monospace secondary text.

- [ ] **Step 2: Update `RackMatrixBay.tsx` search**

- Include `cam.alias` in channel filter search query.

- [ ] **Step 3: Update `CameraDrawer.tsx`**

- Header title uses `getCameraDisplayName(camera)`.
- Specification table shows:
  - **Custom Alias**: `{camera.alias || 'None (Using default)'}`
  - **Hardware / System Name**: `{camera.name}`

- [ ] **Step 4: Update `IncidentCommandView.tsx`**

- Search matches either camera name or camera alias.

- [ ] **Step 5: Run tests and frontend build**

Run:
```powershell
python -m pytest
cd frontend; npm run build; cd ..
```
Expected: All tests pass, frontend builds without TypeScript errors.

- [ ] **Step 6: Commit changes**

```bash
git add frontend/src/components/matrix/ChannelTile.tsx frontend/src/components/matrix/RackMatrixBay.tsx frontend/src/components/drawer/CameraDrawer.tsx frontend/src/components/incidents/IncidentCommandView.tsx
git commit -m "feat(matrix): integrate camera alias across channel tiles, rack matrix, and drawer"
```
