# 📹 CCTV Health Monitoring System

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%20Windows%2011%20(x64)-0078D6.svg?logo=windows&logoColor=white)](https://github.com/lalitmahajn/CCTV-Health-Monitor)
[![Release](https://img.shields.io/badge/Release-v1.0.0%20(Setup.exe)-2ea44f.svg?logo=github&logoColor=white)](https://github.com/lalitmahajn/CCTV-Health-Monitor/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Uvicorn-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20Tailwind-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![shadcn/ui](https://img.shields.io/badge/UI-shadcn%2Fui-black.svg)](https://ui.shadcn.com/)
[![OpenCV](https://img.shields.io/badge/Streaming-OpenCV%20%2B%20FFmpeg%20RTSP-5C3EE8.svg?logo=opencv&logoColor=white)](https://opencv.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(WAL%20Mode)-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

An enterprise-grade, real-time CCTV & NVR/DVR health surveillance solution designed to monitor large fleets of IP cameras across industrial plants, manufacturing facilities, and campus networks. Features **24/7 background telemetry**, **instant outage alerts**, **substream-accelerated thumbnail grabs**, **interactive multi-group inventory**, and a **native Windows System Tray application** with a turnkey Windows Setup Installer.

---

### 🚀 Quick Start for End Users & Operators

[![Download Windows Installer](https://img.shields.io/badge/Download-CCTV__Health__Monitor__Setup__v1.0.0.exe-blue?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/lalitmahajn/CCTV-Health-Monitor/releases/latest)

> 💡 **No Python, Node.js, or external runtimes required on client PCs.**  
> Download the installer, follow the 3-step setup wizard, and the monitoring dashboard will launch automatically in your default browser.
>
> 🔑 **Default Credentials:** `Username: admin` | `Password: admin123` *(change immediately after first login under Admin Settings)*  
> 🔒 **100% Local & Private:** Runs entirely on-premise within your LAN. Video feeds, credentials, and camera configurations never leave your local machine.

<p align="center">
  <img src="docs/images/dashboard_light.png" alt="CCTV Health Monitor - Executive Dashboard" width="100%" />
</p>

---

## 📑 Table of Contents

- [Key Highlights](#-key-highlights)
- [System Architecture](#-system-architecture)
- [Core Features](#-core-features)
  - [1. Executive Fleet Health Dashboard](#1-executive-fleet-health-dashboard)
  - [2. Multi-Group Camera Inventory & Bays](#2-multi-group-camera-inventory--bays)
  - [3. Substream-Accelerated Snapshot Engine](#3-substream-accelerated-snapshot-engine)
  - [4. Multi-Channel Incident Alerts & Notifications](#4-multi-channel-incident-alerts--notifications)
  - [5. Spreadsheet (Excel / CSV) Import & Export](#5-spreadsheet-excel--csv-import--export)
  - [6. Enterprise Audit Logging](#6-enterprise-audit-logging)
- [Installation & Deployment](#-installation--deployment)
  - [Option A: Turnkey Windows Setup Wizard (.exe)](#option-a-turnkey-windows-setup-wizard-exe-recommended)
  - [Option B: Running from Source (Developer Mode)](#option-b-running-from-source-developer-mode)
- [Windows System Tray & 24/7 Background Operation](#-windows-system-tray--247-background-operation)
- [Port Configuration & Anti-Conflict Engine](#-port-configuration--anti-conflict-engine)
- [RTSP Substream Architecture](#-rtsp-substream-architecture)
- [Repository Structure](#-repository-structure)
- [REST API Reference](#-rest-api-reference)
- [Compiling the Windows Installer from Source](#-compiling-the-windows-installer-from-source)
- [Security & Data Privacy](#-security--data-privacy)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Acknowledgements](#-acknowledgements--open-source-credits)
- [Show Your Support](#-show-your-support)
- [License](#-license)

---

## 🌟 Key Highlights

- **Turnkey Client Deployment**: Packaged into a self-contained 100 MB Windows Setup Wizard (`Setup.exe`). Bundles an embedded Python 3.11 runtime, OpenCV/FFmpeg binaries, and pre-compiled React frontend.
- **Silent 24/7 System Tray Telemetry**: Closing the browser never stops monitoring. Operates windowless in the background with tray controls, autostart support, and toast alerts.
- **Substream-Accelerated (`subtype=1`) Snapshots**: Captures live thumbnail keyframes in **under 2.5 seconds** with **90% less bandwidth** than high-bitrate recording streams.
- **Smart Hardware-Safe Concurrency**: Bounded worker pools serialize requests per physical DVR/NVR bay to avoid overwhelming surveillance hardware.
- **Dynamic Port Conflict Resolution**: Defaults to port `8085` and automatically binds to the next free port (`8086`, `8087`...) if a conflict arises. Configurable via plain-text `config.ini`.
- **Fault-Tolerant SQLite WAL**: Write-Ahead Logging (WAL) with concurrency locks and 30-second busy timeouts eliminates database locks during heavy background telemetry.
- **Enterprise Notification Dispatcher**: Instant failure and auto-recovery dispatches via **Telegram Bot** and **SMTP Email**.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph HostPC ["Windows 10 / 11 Host Machine"]
        Tray["Windows System Tray App\n(tray_launcher.py)"]
        
        subgraph CoreProcess ["CCTV-Health-Monitor Background Engine"]
            FastAPI["FastAPI App & Static Server\n(app/main.py)"]
            Engine["Telemetry Engine & Ping Probes\n(app/engine.py)"]
            Scanner["OpenCV & RTSP Frame Grabber\n(app/scanner.py)"]
            DB[(SQLite WAL Database\ncctv_monitor.db)]
            Alerts["Alert Dispatcher\n(Telegram Bot & SMTP Email)"]
        end

        Tray <--> CoreProcess
        FastAPI --> WebUI["React SPA Dashboard\n(http://localhost:8085)"]
    end

    subgraph SurveillanceLAN ["Physical Surveillance Network (LAN / Subnets)"]
        Engine -- "TCP Liveness Probe (:554 / :80)" --> NVRs["Dahua / CP Plus / Hikvision NVRs & DVRs"]
        Scanner -- "RTSP Substream Keyframe (subtype=1)" --> NVRs
        NVRs --> Cameras["IP Cameras Across Plant Zones & Buildings"]
    end

    CoreProcess -- "Outage & Recovery Notifications" --> ExternalNotifs["Telegram Messenger & IT Email Alerts"]
```

---

## 🚀 Core Features

### 1. Executive Fleet Health Dashboard
- **Real-Time Fleet KPI Cards**: Total Cameras, Online, Degraded, Offline, and Spare/No-Cam channels.
- **24-Hour Fleet Uptime Trend Chart**: Historical reliability curves tracking uptime percentages.
- **Latency & Jitter Tracking**: Monitors response latency (ms) per camera to detect network degradation before cameras drop offline.
- **Server-Sent Events (SSE)**: Sub-second live updates pushed to the browser without full page reloads.

### 2. Multi-Group Camera Inventory & Bays
- **Group by NVR / DVR Bay**: View cameras grouped by their physical NVR unit (`01`, `02`, `03`...), displaying online percentages per box.
- **Group by Location / Plant Zone**: Filter feeds by industrial areas (*Production Bay, Boiler Area, Stores, Security Gates*).
- **Group by Status**: Isolate `Offline` channels first for rapid incident troubleshooting.
- **Spare Channel Management**: Unused DVR ports can be toggled to `Spare / No Cam`, muting false alarms while keeping the port on record.

<p align="center">
  <img src="docs/images/inventory_light.png" alt="Multi-Group Camera Inventory" width="100%" />
</p>

### 3. Substream-Accelerated Snapshot Engine
- Auto-converts Dahua & CP Plus RTSP feeds to `subtype=1` (substream preview), cutting image capture time from **15+ seconds down to < 2.5 seconds**.
- Automatic fallback to `subtype=0` for older analog DVRs or encoders that lack secondary streams.
- **Batch Refresh All Snapshots**: Re-captures live keyframes across the entire fleet in parallel with live modal progress (`X / 218 processed`, `Y succeeded`, `Z failed`).
- **Aspect Ratio Normalization**: Previews are normalized to 16:9 / 4:3 for clean grid rendering.

<p align="center">
  <img src="docs/images/matrix_light.png" alt="Fleet Visual Matrix Grid" width="100%" />
</p>

### 4. Multi-Channel Incident Alerts & Notifications
- **Configurable Outage Thresholds**: Generates incident tickets after $N$ consecutive probe failures to prevent flapping alerts.
- **Auto-Recovery Detection**: Dispatches recovery notifications with the exact outage duration (e.g. `Camera recovered after 4m 12s offline`).
- **Telegram Bot Integration**: Delivers formatted HTML alert messages with timestamps and locations to your security operations chat.
- **SMTP Email Notifications**: Automated emails with configurable sender, recipient, and TLS/SSL authentication.
- **Live Test Dispatch**: Verify bot tokens and SMTP credentials with a single click.

<p align="center">
  <img src="docs/images/incidents_light.png" alt="Incident Command Center" width="100%" />
</p>

### 5. Spreadsheet (Excel / CSV) Import & Export
- **One-Click Backup**: Export camera inventories, RTSP URLs, bays, and statuses to `.xlsx` or `.csv`.
- **Bulk Onboarding**: Upload spreadsheets to bulk-create or update hundreds of cameras at once.

| Column Header | Description | Example |
| :--- | :--- | :--- |
| **`Name`** | Descriptive camera label | `Main Gate Inward - PTZ` |
| **`IP Address`** | IP or hostname of the camera / NVR | `192.168.0.101` |
| **`Port`** | RTSP / service port | `554` |
| **`RTSP URL`** | Full RTSP streaming URL | `rtsp://admin:pass@192.168.0.101:554/cam/realmonitor?channel=1&subtype=0` |
| **`Location`** | Physical zone or plant building | `Gate 1 Entrance` |
| **`NVR Bay`** | Identifier of the physical NVR box | `DVR-01` |
| **`Is Spare`** | Channel without an attached camera (`0` or `1`) | `0` |

### 6. Enterprise Audit Logging & Admin Controls
- Timestamped audit ledger tracking user logins, password modifications, camera configuration changes, manual scans, and spare channel toggles.
- Filterable and paginated for compliance audits.
- Centralized notification service setup for Telegram bots and SMTP mailers.

<p align="center">
  <img src="docs/images/admin_light.png" alt="Admin Panel & Notification Settings" width="100%" />
</p>

---

## 📦 Installation & Deployment

### Option A: Turnkey Windows Setup Wizard (.exe) *(Recommended)*

Designed for production environments, security control rooms, and client PCs:

[**⬇️ Download Latest Installer (`CCTV_Health_Monitor_Setup_v1.0.0.exe`)**](https://github.com/lalitmahajn/CCTV-Health-Monitor/releases/latest)

1. Download **`CCTV_Health_Monitor_Setup_v1.0.0.exe`** from [GitHub Releases](https://github.com/lalitmahajn/CCTV-Health-Monitor/releases/latest).
2. Double-click the installer and follow the setup wizard:
   - Select installation path (Default: `C:\Program Files\CCTV Health Monitor`).
   - Choose whether to create a Desktop shortcut.
   - Choose whether to enable **"Automatically start CCTV Health Monitor when Windows boots"**.
3. Click **Install**.
4. Check **"Launch CCTV Health Monitor"** and click **Finish**.
5. The application starts silently in the Windows System Tray and opens `http://localhost:8085` in your browser.

---

### Option B: Running from Source (Developer Mode)

#### Prerequisites
- **Python 3.11+ (64-bit)**
- **Node.js 18+ & npm** (for React frontend)

#### 1. Clone the Repository
```bash
git clone https://github.com/lalitmahajn/CCTV-Health-Monitor.git
cd CCTV-Health-Monitor
```

#### 2. Install Backend Dependencies
```powershell
python -m pip install -r requirements.txt
python -m pip install pystray Pillow
```

#### 3. Build the Frontend SPA
```powershell
cd frontend
npm install
npm run build
cd ..
```

#### 4. Launch the Server
- **Standard Console Mode**:
  ```powershell
  python run.py --port 8085
  ```
- **System Tray 24/7 Background Mode**:
  ```powershell
  python tray_launcher.py
  ```

---

## 🖥 Windows System Tray & 24/7 Background Operation

When launched via the installer or `tray_launcher.py`, the system runs without keeping a terminal window open. An emerald CCTV camera badge appears in your Windows notification tray (next to the system clock):

| Tray Action | Function |
| :--- | :--- |
| **Double-Click Icon** | Opens the Web Dashboard in your default browser. |
| **`🌐 Open Dashboard`** | Launches the active dashboard URL (`http://localhost:8085`). |
| **`📁 Open Snapshots Folder`** | Opens Windows File Explorer directly to `static/snapshots/`. |
| **`✓ Start with Windows`** | Toggles system autostart via Windows Registry (`HKCU\...\Run`). Requires **no Administrator privileges**. |
| **`❌ Exit / Stop Monitor`** | Flushes SQLite WAL journals, stops background threads, and terminates cleanly. |

> [!TIP]
> On **Windows 11**, newly installed tray icons may initially reside inside the overflow tray (`^` icon). You can drag the camera icon directly onto your main taskbar to keep it visible at all times.

---

## ⚙️ Port Configuration & Anti-Conflict Engine

The monitor features built-in port conflict resolution to guarantee reliable operation alongside existing web servers:

1. **Default Port**: Configured to **`8085`** (avoids collisions with standard ports `80`, `8080`, `3000`, and `8000`).
2. **`config.ini` Configuration File**: Placed next to the application binary:
   ```ini
   # CCTV Health Monitoring Configuration
   [Server]
   port = 8085
   host = 0.0.0.0
   auto_find_free_port = true
   ```
   To specify a custom port (e.g. `9000`), edit `port = 9000` and restart the monitor.
3. **Automated Port Fallback**: If port `8085` is in use by another software, the launcher automatically scans and binds to the next available port (`8086`, `8087`...), displays a Windows toast notification, and opens your browser to the active port.

---

## 🎥 RTSP Substream Architecture

High-resolution surveillance feeds consume significant bandwidth and compute during frame decoding. The snapshot engine leverages multi-stream RTSP switching:

- **`subtype=0` (Main Stream)**: High-resolution (1080p/4K) feed intended for NVR storage. High GOP ($50+$ frames between keyframes) results in $5\text{--}15$ second delays when grabbing snapshots.
- **`subtype=1` (Sub Stream)**: Optimized CIF/D1 resolution preview stream. Low GOP ($15$ frames) delivers I-frame keyframes within **$< 1.5\text{ seconds}$** using only $\sim 300\text{ KB}$ of bandwidth.

```mermaid
sequenceDiagram
    participant Engine as CCTV Snapshot Engine
    participant NVR as Physical Dahua / CP Plus NVR
    
    Note over Engine,NVR: Substream Optimization (subtype=1)
    Engine->>NVR: RTSP Request: /cam/realmonitor?channel=1&subtype=1
    alt Substream Active (Default)
        NVR-->>Engine: Keyframe received in < 1.5s (~300 KB)
        Engine->>Engine: Aspect-ratio normalize & save to static/snapshots/
    else Substream Disabled
        Engine->>NVR: Fallback Request: subtype=0
        NVR-->>Engine: Main stream frame decoded & saved
    end
```

---

## 📂 Repository Structure

```
CCTV-Health-Monitor/
├── app/
│   ├── main.py              # FastAPI server, static mount, API router
│   ├── engine.py            # Telemetry worker, background scheduler
│   ├── scanner.py           # RTSP keyframe grabber & OpenCV snapshot processor
│   ├── database.py          # SQLite WAL schema, connection pool & migrations
│   ├── auth.py              # JWT authentication & password hashing
│   ├── alerts.py            # Telegram & SMTP email notification dispatchers
│   └── excel_handler.py     # Spreadsheet import/export parser
├── frontend/                # React 18 SPA
│   ├── src/
│   │   ├── components/      # UI components (Fleet Gauges, Camera Cards, Inventory)
│   │   ├── pages/           # Dashboard, Inventory, Alerts, Admin Settings
│   │   └── App.tsx          # Root routing & SSE event listener
│   ├── package.json         # Node dependencies
│   └── vite.config.ts       # Vite build configuration
├── static/
│   └── snapshots/           # Captured live camera thumbnail images (.jpg)
├── cctv_monitor.spec        # PyInstaller specification file
├── installer.iss            # Inno Setup Windows installer compiler script
├── build_installer.bat      # 1-click automated build pipeline script
├── tray_launcher.py         # Native Windows System Tray entrypoint
├── run.py                   # CLI entrypoint for development
├── config.ini               # Server port and network host settings
├── requirements.txt         # Python dependencies
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the pre-compiled React single-page application. |
| `GET` | `/api/cameras` | List all cameras with live status, latency, and snapshot URLs. |
| `POST` | `/api/cameras/{id}/check` | Trigger an immediate manual probe of a single camera feed. |
| `POST` | `/api/cameras/{id}/snapshot` | Grab a fresh on-demand snapshot for a specific camera. |
| `POST` | `/api/cameras/{id}/toggle-no-cam` | Toggle a camera channel between Active and Spare/No-Cam mode. |
| `POST` | `/api/cameras/snapshots/refresh-all` | Trigger parallel fleet-wide snapshot refresh across all NVR bays. |
| `GET` | `/api/cameras/snapshots/refresh-status`| Poll live batch progress (`total`, `completed`, `succeeded`, `failed`). |
| `GET` | `/api/fleet/uptime-history?period=24h`| Retrieve 24h fleet uptime percentage history for charts. |
| `GET` | `/api/admin/audit-logs` | Retrieve paginated system audit and incident records. |
| `POST` | `/api/admin/notifications/test` | Dispatch a live test notification to Telegram or Email. |
| `GET` | `/api/events` | Server-Sent Events (SSE) stream for real-time UI telemetry. |

---

## 🛠 Compiling the Windows Installer from Source

To compile a new standalone `.exe` setup wizard after modifying source code:

### Prerequisites for Building
1. Install [Inno Setup 6](https://jrsoftware.org/isdl.php) (Add `ISCC.exe` to system `PATH` or install to default path).
2. Install Python build dependencies:
   ```powershell
   python -m pip install pyinstaller pystray Pillow
   ```

### 1-Click Build Pipeline
Execute the root build script:
```cmd
build_installer.bat
```

The script will automatically:
1. Compile the React frontend SPA (`npm run build` in `frontend/`).
2. Package the Python backend and DLLs into a standalone executable (`dist/CCTV-Health-Monitor/` via PyInstaller).
3. Clean out temporary logs, caches, and database files.
4. Compile the LZMA2-compressed Windows Setup Wizard (`installer.iss` via Inno Setup).

The resulting installer is saved to:
📂 **`installer_output\CCTV_Health_Monitor_Setup_v1.0.0.exe`**

---

## 🔒 Security & Data Privacy

- **100% On-Premise Execution**: All video processing, telemetry pinging, and database operations execute locally. No video frames, camera credentials, or IP data are sent to external cloud servers.
- **Zero Database Bundling**: The installer **never packages an existing database**. On first launch on a target machine, a fresh, clean database is created on disk.
- **Credential Protection**: Database passwords and sensitive tokens are protected with local cryptographic keying (`.secret.key`).
- **Git Shielding**: All `.db`, `.log`, `.secret.key`, and temporary capture files are strictly ignored via [`.gitignore`](.gitignore).

---

## ❓ Troubleshooting & FAQs

#### Q: The browser shows "Unable to connect" after starting.
- Check the Windows System Tray next to the clock. If port `8085` was in use by another program, the application automatically moved to `http://localhost:8086`. Right-click the camera icon and select **Open Dashboard**.

#### Q: A channel shows "Online" but the thumbnail says "Stream unavailable".
- The NVR hardware box is responding on TCP port `554`/`80`, but that specific physical BNC/IP channel may be unplugged or inactive. Toggle the channel to **Spare / No Cam** in the Inventory view to exclude it from health alerts.

#### Q: How do I change the default administrator password?
- Log in with `admin` / `admin123`. Click **Admin Settings ➔ Change Password** in the top navigation bar to set a new password.

#### Q: Where are snapshot images stored on disk?
- In the `static/snapshots/` folder in the application root (e.g. `C:\Program Files\CCTV Health Monitor\static\snapshots\`). Right-click the tray icon and click **Open Snapshots Folder** to access them directly.

---

## 🙏 Acknowledgements & Open-Source Credits

This project is made possible thanks to the following open-source libraries and frameworks:

- **[shadcn/ui](https://ui.shadcn.com/)** — Accessible, modular component architecture built on Radix UI and Tailwind CSS.
- **[FastAPI](https://fastapi.tiangolo.com/)** — High-performance async web backend by [@tiangolo](https://github.com/tiangolo).
- **[OpenCV](https://opencv.org/)** — Computer vision & RTSP frame decoding engine.
- **[React](https://react.dev/)** & **[Vite](https://vitejs.dev/)** — Modern reactive frontend framework and blazing-fast build tool.
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS framework for precision styling.
- **[Lucide Icons](https://lucide.dev/)** — Clean and consistent UI iconography.
- **[SQLite](https://www.sqlite.org/)** — Self-contained, zero-configuration SQL database engine.
- **[Uvicorn](https://www.uvicorn.org/)** — Lightning-fast ASGI web server implementation.
- **[Pystray](https://github.com/moses-palmer/pystray)** & **[Pillow](https://python-pillow.org/)** — Windows system tray integration & image manipulation library.
- **[Inno Setup](https://jrsoftware.org/isinfo.php)** — Legendary Windows installer compiler by Jordan Russell.

---

## ⭐ Show Your Support

If **CCTV Health Monitor** helps keep your surveillance feeds online, monitor facility health, or saves your security team time, please consider giving this project a **Star** on GitHub! It helps more developers and surveillance teams discover the tool.

<p align="center">
  <a href="https://github.com/lalitmahajn/CCTV-Health-Monitor/stargazers">
    <img src="https://img.shields.io/github/stars/lalitmahajn/CCTV-Health-Monitor?style=for-the-badge&logo=github&color=EA580C" alt="GitHub Stars" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/lalitmahajn/CCTV-Health-Monitor/network/members">
    <img src="https://img.shields.io/github/forks/lalitmahajn/CCTV-Health-Monitor?style=for-the-badge&logo=github&color=2563EB" alt="GitHub Forks" />
  </a>
</p>

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the [LICENSE](LICENSE) file for details.
