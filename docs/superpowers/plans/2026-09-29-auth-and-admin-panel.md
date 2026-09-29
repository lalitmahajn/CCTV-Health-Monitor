# Single Gatekeeper Auth & Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Single Gatekeeper authentication (login page, password hashing, HttpOnly session cookies, API route protection) and a comprehensive Admin Panel built with genuine Shadcn UI primitives for system, alert, fleet, and audit management.

**Architecture:** A salted `bcrypt` user authentication system with secure signed HTTP-only cookies protects all backend endpoints and telemetry data. A React `AuthContext` conditionally renders a branded Login View for unauthenticated users, or the full dashboard with a new 5-section Admin Panel for authenticated administrators.

**Tech Stack:** Python 3.11, FastAPI, `aiosqlite`, `bcrypt`, `pyjwt`, React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Shadcn UI primitives.

**Spec:** `docs/superpowers/specs/2026-09-29-auth-and-admin-panel-design.md`

## Global Constraints

- Default seeded credentials: `username: admin`, `password: admin123`.
- Passwords must be hashed using salted `bcrypt`. Plaintext passwords must never be stored or logged.
- Session cookie name: `cctv_session`, with attributes `HttpOnly=True`, `SameSite="lax"`, `Path="/"`.
- Admin Panel components must strictly use genuine Shadcn UI primitives (`Card`, `Tabs`, `Input`, `Button`, `Badge`, `Switch`, `Select`, `Table`, `Dialog`).
- Existing public monitoring operations must be guarded behind authentication without breaking ongoing background scanner tasks.

## Review Focus

- **Password complexity**: Updating credentials requires verifying the existing password and enforcing minimum 8 characters.
- **Session invalidation on logout**: Calling logout must immediately expire the cookie and block subsequent requests.
- **401 handling**: Background polling on camera and incident SSE streams must catch 401 and redirect to Login cleanly without white-screen crashes.
- **RTSP credential secrecy**: Admin panel operations and responses must continue to mask RTSP credentials as `*****:*****`.
- **First-run idempotency**: Database initialization must safely seed the default `admin` account only if the `users` table is empty.

---

### Task 1: Database Migration for Users and Audit Logs

**Files:**
- Modify: `app/database.py`
- Modify: `app/models.py`
- Test: `tests/test_database.py`

**Interfaces:**
- Consumes: SQLite schema creation in `app/database.py`
- Produces: `UserRepository` (`get_by_username`, `create_user`, `update_password`, `update_last_login`), `AuditLogRepository` (`create_entry`, `get_recent`)

- [ ] **Step 1: Write failing test in `tests/test_database.py` for UserRepository and AuditLogRepository**

```python
@pytest.mark.asyncio
async def test_users_and_audit_logs(tmp_path):
    test_db = str(tmp_path / "test_auth.db")
    await init_db(test_db)
    
    from app.models import UserRepository, AuditLogRepository
    user_repo = UserRepository(test_db)
    audit_repo = AuditLogRepository(test_db)
    
    # 1. Default user seeded
    admin = await user_repo.get_by_username("admin")
    assert admin is not None
    assert admin["username"] == "admin"
    assert admin["password_hash"].startswith("$2b$")
    
    # 2. Audit log recorded
    logs = await audit_repo.get_recent(limit=10)
    assert len(logs) >= 1
    assert "INITIALIZED" in logs[0]["event_type"] or "admin" in logs[0]["description"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_database.py -k test_users_and_audit_logs`
Expected: FAIL with `ImportError` or `AttributeError`

- [ ] **Step 3: Implement database tables and repositories in `app/database.py` and `app/models.py`**

In `app/database.py`:
- Add `users` table: `id`, `username`, `password_hash`, `created_at`, `updated_at`, `last_login_at`.
- Add `audit_logs` table: `id`, `timestamp`, `event_type`, `description`, `ip_address`.
- Seed default `admin` / `admin123` with bcrypt if `users` is empty.

In `app/models.py`:
- Add `UserRepository` class with methods `get_by_username`, `update_password`, `update_last_login`.
- Add `AuditLogRepository` class with `create_entry` and `get_recent`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_database.py -k test_users_and_audit_logs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/database.py app/models.py tests/test_database.py
git commit -m "feat(auth): add users and audit_logs tables with repository classes"
```

---

### Task 2: Backend Auth Module & Session Cookie Logic

**Files:**
- Create: `app/auth.py`
- Test: `tests/test_auth.py`

**Interfaces:**
- Consumes: `app.security.get_secret_key`
- Produces: `hash_password(raw: str) -> str`, `verify_password(raw: str, hashed: str) -> bool`, `create_session_token(username: str) -> str`, `decode_session_token(token: str) -> Optional[dict]`, `require_admin(request: Request)` FastAPI dependency.

- [ ] **Step 1: Write failing test in `tests/test_auth.py`**

```python
import pytest
from app.auth import hash_password, verify_password, create_session_token, decode_session_token

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_session_token():
    token = create_session_token("admin")
    payload = decode_session_token(token)
    assert payload is not None
    assert payload["sub"] == "admin"
    
    bad_payload = decode_session_token("invalid.token.here")
    assert bad_payload is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_auth.py`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.auth'`)

- [ ] **Step 3: Implement `app/auth.py`**

- Use `bcrypt.hashpw` and `bcrypt.checkpw` for passwords.
- Use `jwt.encode` and `jwt.decode` (using HS256 and secret key from `app.security`).
- Implement `require_admin(request: Request)` which extracts `cctv_session` from cookies, verifies it, and raises `HTTPException(status_code=401, detail="Unauthorized")` if invalid.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_auth.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/auth.py tests/test_auth.py
git commit -m "feat(auth): add password hashing and session token verification"
```

---

### Task 3: Auth & Admin REST API Endpoints

**Files:**
- Modify: `app/routes.py`
- Test: `tests/test_auth_api.py`

**Interfaces:**
- Consumes: `app/auth.py`, `app/models.py`
- Produces:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `PUT /api/auth/credentials`
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/diagnostics`

- [ ] **Step 1: Write failing test in `tests/test_auth_api.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app

@pytest.mark.asyncio
async def test_auth_api_lifecycle(tmp_path):
    test_db = str(tmp_path / "test_api_auth.db")
    app = create_app(db_path=test_db)
    transport = ASGITransport(app=app)
    
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Check me (unauthenticated)
        res = await client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["authenticated"] is False
        
        # 2. Login with bad password
        res = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert res.status_code == 401
        
        # 3. Login with correct password
        res = await client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert res.status_code == 200
        assert res.json()["authenticated"] is True
        assert "cctv_session" in res.cookies
        
        # 4. Check me with cookie
        res = await client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.json()["authenticated"] is True
        assert res.json()["username"] == "admin"
        
        # 5. Logout
        res = await client.post("/api/auth/logout")
        assert res.status_code == 200
        assert res.json()["authenticated"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_auth_api.py`
Expected: FAIL with 404 on `/api/auth/login`

- [ ] **Step 3: Implement Auth and Admin routes in `app/routes.py`**

- Wire up `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/credentials`.
- Add `GET /api/admin/audit-logs` and `GET /api/admin/diagnostics`.
- Ensure `audit_logs` records entries on login success/fail, logout, and credential updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_auth_api.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes.py tests/test_auth_api.py
git commit -m "feat(auth): implement auth and admin REST API endpoints"
```

---

### Task 4: Guard All Protected Endpoints with Authentication

**Files:**
- Modify: `app/routes.py`
- Modify: `tests/test_api.py`

**Interfaces:**
- Consumes: `require_admin` dependency from `app/auth.py`
- Produces: Protected `/api/cameras`, `/api/settings`, `/api/incidents`, `/api/stream/events`, `/api/fleet/*` endpoints returning 401 when called without valid `cctv_session`.

- [ ] **Step 1: Update `tests/test_api.py` to assert 401 without auth, then login before running tests**

Modify `tests/test_api.py` to first verify that unauthenticated calls to `/api/cameras` return 401, then authenticate with `admin` / `admin123` to verify the rest of the test suite.

- [ ] **Step 2: Run test to verify failure**

Run: `python -m pytest tests/test_api.py`
Expected: FAIL (because endpoints are not yet protected)

- [ ] **Step 3: Attach `dependencies=[Depends(require_admin)]` to protected router in `app/routes.py`**

Separate public routes (`/api/auth/login`, `/api/auth/me`, static files) from protected routes (`/api/cameras`, `/api/settings`, `/api/incidents`, `/api/admin/*`, etc.) using FastAPI `dependencies=[Depends(require_admin)]`.

- [ ] **Step 4: Run test to verify passes**

Run: `python -m pytest tests/test_api.py`
Expected: PASS

- [ ] **Step 5: Run complete test suite**

Run: `python -m pytest`
Expected: PASS (all tests pass)

- [ ] **Step 6: Commit**

```bash
git add app/routes.py tests/test_api.py
git commit -m "feat(auth): enforce require_admin guard on all private API routes"
```

---

### Task 5: Frontend Auth Context & Interceptor

**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`
- Produces: `useAuth()` hook providing `{ isAuthenticated, user, isLoading, login, logout }`.

- [ ] **Step 1: Create `frontend/src/context/AuthContext.tsx`**

Implement `AuthProvider` and `useAuth` hook. On boot, call `GET /api/auth/me` with `credentials: 'include'`. Provide `login(username, password)` and `logout()` functions.

- [ ] **Step 2: Update `frontend/src/lib/api.ts`**

Ensure all `fetch` calls include `credentials: 'include'`. Add error handling: if response status is 401, dispatch an auth event to notify `AuthContext` to reset state to unauthenticated.

- [ ] **Step 3: Build frontend to verify no TypeScript compilation errors**

Run: `npm run build` in `frontend/` directory.
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/lib/api.ts
git commit -m "feat(frontend): create AuthContext and credential fetch interceptor"
```

---

### Task 6: Frontend Branded Login Page with Shadcn UI

**Files:**
- Create: `frontend/src/components/auth/LoginView.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` hook, Shadcn `Card`, `Input`, `Button`, `Badge`
- Produces: Fullscreen login screen when `isAuthenticated === false`.

- [ ] **Step 1: Create `frontend/src/components/auth/LoginView.tsx`**

- Centered responsive card with surveillance shield branding.
- Username and password inputs using Shadcn `Input`.
- Show/hide password eye toggle.
- "Sign In to Fleet Command" button using Shadcn `Button` with loading spinner.
- Inline alert for invalid credentials.
- Security badge with `AES-256 Protected & Session Sealed`.

- [ ] **Step 2: Wire `LoginView` into `frontend/src/App.tsx`**

Wrap `App` with `AuthProvider`. If `isLoading`, show loading splash screen. If `!isAuthenticated`, render `<LoginView />`. Otherwise, render the full monitoring app.

- [ ] **Step 3: Build frontend to verify compilation**

Run: `npm run build` in `frontend/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/auth/LoginView.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add branded login screen using Shadcn UI primitives"
```

---

### Task 7: Top Navbar Updates (Admin Tab, User Badge, Logout Button)

**Files:**
- Modify: `frontend/src/components/layout/TopNavbar.tsx`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/hooks/useCameraFleet.ts`

**Interfaces:**
- Consumes: `useAuth()` hook
- Produces: `activeTab === 'admin'`, Admin tab button with `Shield` icon, username badge, logout button.

- [ ] **Step 1: Add `'admin'` to valid tab types in `frontend/src/lib/types.ts`**

- [ ] **Step 2: Update `frontend/src/components/layout/TopNavbar.tsx`**

- Add **Admin** navigation tab alongside Dashboard, Incidents, Fleet Matrix, Inventory.
- Add user profile badge displaying username (`admin`) with small shield icon.
- Add Logout button with `LogOut` icon that triggers `logout()` from `useAuth`.

- [ ] **Step 3: Build frontend and verify**

Run: `npm run build` in `frontend/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/TopNavbar.tsx frontend/src/lib/types.ts frontend/src/hooks/useCameraFleet.ts
git commit -m "feat(frontend): add admin tab, user badge, and logout button to top navbar"
```

---

### Task 8: Comprehensive Admin Panel with 5 Sub-Views (Shadcn UI)

**Files:**
- Create: `frontend/src/components/admin/AdminPanelView.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Shadcn `Tabs`, `Card`, `Input`, `Button`, `Switch`, `Select`, `Table`, `Dialog`
- Produces: Rendered view when `activeTab === 'admin'`.

- [ ] **Step 1: Create `frontend/src/components/admin/AdminPanelView.tsx`**

Implement 5 tabs using Shadcn `Tabs`:
1. **Account & Security**: Form to change username, change password (current, new, confirm), session info.
2. **Engine & Monitoring Tuning**: Form for scan interval, timeout, failure threshold, timezone selector, 12h/24h time format switch.
3. **Alert Notifications**: SMTP settings, "Send Test Email" trigger button, Telegram bot settings.
4. **Fleet Operations**: Bulk CSV import modal launcher, Excel export download, Instant Fleet Re-Scan trigger, Re-seed factory fleet confirmation dialog.
5. **Diagnostics & Audit Logs**: Live system metrics (uptime, DB size, active workers) and Security Audit Log table (`Table`, `Badge`) showing recent events.

- [ ] **Step 2: Render `AdminPanelView` in `frontend/src/App.tsx` when `activeTab === 'admin'`**

- [ ] **Step 3: Build frontend and copy dist to backend static files**

Run: `npm run build` in `frontend/`
Copy `frontend/dist/*` to `static/` (or update backend static file serving).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/AdminPanelView.tsx frontend/src/App.tsx static/
git commit -m "feat(frontend): implement comprehensive admin panel with 5 Shadcn sub-views"
```

---

### Task 9: End-to-End Playwright Verification & Final Acceptance

**Files:**
- Test: `tests/test_playwright_auth_admin.py` or interactive browser verification

**Interfaces:**
- Consumes: Running FastAPI app on `localhost:8000`
- Produces: Full browser verification log confirming login, admin panel tabs, and logout.

- [ ] **Step 1: Start background server and run automated test suite**

Run: `python -m pytest`
Expected: ALL PASS

- [ ] **Step 2: Use Playwright tool to navigate to `http://localhost:8000`**

Verify:
- Visiting app shows the Login Page.
- Submitting `admin` / `admin123` logs in and navigates to the Fleet Dashboard.
- Clicking the **Admin** tab opens the Admin Panel.
- Navigating between the 5 admin tabs renders properly with Shadcn components.
- Clicking **Logout** redirects back to the Login Page.
- Protected API calls return 401 when logged out.

- [ ] **Step 3: Final Commit & Git Push**

```bash
git push origin main
```
