# Technical Design Spec: Single Gatekeeper Authentication & Admin Panel

- **Date**: 2026-09-29
- **Status**: Draft / Under Review
- **Architecture Path**: Architectural (New Subsystem)

---

## 1. Executive Summary

This specification establishes an enterprise authentication subsystem and comprehensive administrative control panel for the CCTV Health Monitoring platform. The entire application operates under a **Single Gatekeeper** model: unauthenticated traffic cannot access telemetry, live streams, or camera metadata. Once authenticated, an administrator has full access to the monitoring dashboards as well as a dedicated, first-class **Admin Panel** built with strict Shadcn UI primitives for managing credentials, engine tuning, alert notifications, fleet operations, and diagnostic audit logs.

---

## 2. Authentication Subsystem Architecture

### 2.1 Security & Session Model
- **Hashing**: Passwords are saved as salted `bcrypt` hashes in a new SQLite `users` table.
- **Session Tokens**: Signed HMAC-SHA256 JWT tokens with a 7-day expiration.
- **Transport**: Stored in a secure `HttpOnly`, `SameSite=Lax` cookie named `cctv_session`. This eliminates client-side token exposure to XSS attacks.
- **Access Control**: FastAPI dependency `require_admin` enforces valid authentication across all `/api/*` endpoints except:
  - `POST /api/auth/login` (login endpoint)
  - `GET /api/auth/me` (session verification check)
  - Static frontend assets (`/`, `/index.html`, `/assets/*`, `/vite.svg`)

### 2.2 Database Schema (`cctv_monitor.db`)

#### `users` Table
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
);
```

#### `audit_logs` Table
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT
);
```

### 2.3 Initial Seed Credentials
On application launch (`init_db()`), if the `users` table contains zero records:
- **Default Username**: `admin`
- **Default Password**: `admin123` (hashed with `bcrypt`)
- Seed audit record: `SYSTEM_INITIALIZED: Default admin account provisioned`

### 2.4 REST API Endpoints
1. `POST /api/auth/login`
   - Request: `{ "username": "admin", "password": "..." }`
   - Validates bcrypt hash against `users` table.
   - On success: sets `cctv_session` cookie (`HttpOnly=True`, `SameSite="lax"`, `Path="/"`), logs `LOGIN_SUCCESS` with client IP, updates `last_login_at`, returns `{ "authenticated": true, "username": "admin" }`.
   - On failure: logs `LOGIN_FAILED`, returns `401 Unauthorized` with `{ "detail": "Invalid username or password" }`.
2. `POST /api/auth/logout`
   - Clears `cctv_session` cookie (`Max-Age=0`).
   - Logs `LOGOUT` audit event.
   - Returns `{ "authenticated": false, "message": "Logged out successfully" }`.
3. `GET /api/auth/me`
   - Reads `cctv_session` cookie.
   - If valid, returns `{ "authenticated": true, "username": "admin", "last_login": "..." }`.
   - If invalid/missing, returns `{ "authenticated": false, "username": None }` with HTTP 200 (avoids noisy console errors during initial app load).
4. `PUT /api/auth/credentials`
   - Request: `{ "current_password": "...", "new_username": "...", "new_password": "..." }`
   - Verifies `current_password`.
   - Enforces `new_password` minimum length (8 characters).
   - Updates `username` and `password_hash`.
   - Issues fresh session cookie and logs `CREDENTIALS_UPDATED`.
5. `GET /api/admin/audit-logs`
   - Query: `limit=50`, `offset=0`
   - Returns recent audit log entries ordered by `id DESC`.
6. `GET /api/admin/diagnostics`
   - Returns system uptime, memory usage, CPU load, database file size on disk, active background tasks count, total provisioned cameras, and total active incidents.

---

## 3. Frontend Architecture & User Experience

### 3.1 Gatekeeper Flow & State Management
- `AuthContext.tsx` wraps the React root.
- State: `{ isAuthenticated, user, isLoading, login, logout }`.
- On boot: calls `GET /api/auth/me`.
- While `isLoading`: renders a branded dark-theme loader.
- If `!isAuthenticated`: renders `LoginView.tsx`.
- If `isAuthenticated`: renders the main application with `TopNavbar`, active tabs, and telemetry polling.
- Global fetch interceptor: on `401 Unauthorized` response from any background API call, automatically resets auth state to redirect to the login screen.

### 3.2 Login Page (`LoginView.tsx`)
- Centered card design over dark surveillance mesh background.
- Branded shield/CCTV icon with title **Enterprise CCTV Health & Fleet Command**.
- Shadcn UI components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Input`, `Button`, `Badge`.
- Inputs:
  - Username field (defaults to autofocus).
  - Password field with toggleable show/hide eye icon.
  - "Sign In to Fleet Command" button with spinner.
- Inline error banner for invalid credentials.
- Security badge: `AES-256 Protected & Session Sealed`.

### 3.3 Top Navigation Bar (`TopNavbar.tsx`)
- New navigation tab item: **Admin** (`Shield` icon), positioned alongside Dashboard, Incidents, Fleet Matrix, and Inventory.
- User profile indicator in the header right-controls:
  - Badge with `admin` username.
  - Logout button (`LogOut` icon) triggering immediate session invalidation and redirection.

### 3.4 Admin Panel (`components/admin/AdminPanelView.tsx`)
Built using genuine Shadcn UI primitives (`Tabs`, `Card`, `Input`, `Button`, `Switch`, `Select`, `Table`, `Dialog`):

#### Tab 1: Account & Security
- Shadcn `Card` for Admin Credentials:
  - Current Password input.
  - New Username input.
  - New Password input & Confirm Password input.
  - Submit button with status feedback.
- Session Information card:
  - Current session duration, last login timestamp, client IP.

#### Tab 2: Engine & Monitoring Tuning
- Shadcn `Card` for Engine Tuning:
  - Background Scan Interval (`Input type="number"` seconds).
  - Host Throttle Max Concurrency (`Input type="number"`).
  - Failure Threshold before Alert (`Input type="number"`).
  - Timezone selector (`Select`: `Asia/Kolkata (IST)`, `UTC`, `America/New_York`, etc.).
  - Time Format (`Switch`: 12-hour AM/PM vs 24-hour Military).
  - Save button with toast notification.

#### Tab 3: Alert Notification Channels
- Upgrades and replaces existing standalone settings view:
  - SMTP Configuration: Server Host, Port, TLS/SSL switch, Username, Password (masked with `••••••••`).
  - "Send Test Email" button with live status indicator.
  - Telegram Bot Configuration: Bot Token (masked) and Chat ID.

#### Tab 4: Fleet Maintenance & Data Operations
- Shadcn `Card` for Fleet Tools:
  - Bulk Camera CSV Import button (opens import modal).
  - Formatted Excel Export (`.xlsx`) one-click download.
  - "Trigger Instant Fleet Re-Scan" button to trigger engine scan task.
  - **Danger Zone Card**:
    - "Re-seed Factory Fleet": Re-imports the master 266 camera configuration from `SCPL_FW_NVR.xlsx`.
    - Protected by Shadcn `Dialog` confirmation requiring typing `CONFIRM`.

#### Tab 5: Diagnostics & Audit Logs
- Live Telemetry Card:
  - Server process uptime, SQLite DB size on disk, active scanner worker status.
- Security Audit Log Table (`Table`):
  - Columns: Timestamp, Event Type (`Badge`), Description, IP Address.
  - Paged or scrollable view of recent 50 entries.

---

## 4. Verification & Testing Plan

### 4.1 Automated Tests (`tests/test_auth.py`)
1. **Initial Seed**: Verify `users` table automatically seeds `admin` with valid bcrypt hash if empty.
2. **Login Verification**:
   - `POST /api/auth/login` with `admin` / `admin123` returns 200 and sets `cctv_session` cookie.
   - `POST /api/auth/login` with wrong password returns 401.
3. **Session Guard**:
   - Protected endpoint (e.g. `GET /api/cameras`) without cookie returns 401.
   - Protected endpoint with valid cookie returns 200.
4. **Credential Modification**:
   - `PUT /api/auth/credentials` updates password, rejects if current password is wrong.
   - Subsequent login with new password succeeds.
5. **Audit Logging**:
   - Verify `audit_logs` table records `LOGIN_SUCCESS`, `LOGIN_FAILED`, and `CREDENTIALS_UPDATED`.
6. **Logout Verification**:
   - `POST /api/auth/logout` clears session cookie.

### 4.2 Browser & UI Verification (Playwright)
1. Verify initial visit redirects to the Login Page.
2. Enter default credentials (`admin` / `admin123`) and submit; verify successful transition to Dashboard.
3. Verify top navigation displays the new **Admin** tab.
4. Switch to the Admin Panel and test sub-views:
   - Account & Security
   - Engine & Monitoring
   - Alert Channels
   - Fleet Maintenance
   - Diagnostics & Audit Logs
5. Test Logout and verify return to Login Page.
