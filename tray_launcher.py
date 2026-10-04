"""
CCTV Health Monitoring System - Windows System Tray Launcher
Runs the FastAPI + Uvicorn server in a background thread 24/7.
Provides a persistent system tray icon with dashboard quick-actions,
single-instance protection, and Windows autostart toggle.
"""

import os
import sys

# ----------------------------------------------------------------------
# Handle Windowless (noconsole) GUI execution where sys.stdout is None
# ----------------------------------------------------------------------
class SafeStream:
    """Provides a dummy isatty() and write stream for windowless executions."""
    def __init__(self, target_file=None):
        self.target_file = target_file

    def write(self, text):
        if self.target_file:
            try:
                self.target_file.write(text)
                self.target_file.flush()
            except Exception:
                pass

    def flush(self):
        if self.target_file:
            try:
                self.target_file.flush()
            except Exception:
                pass

    def isatty(self):
        return False

if sys.stdout is None or sys.stderr is None:
    _log_fh = None
    try:
        from app.paths import get_data_dir
        _base = get_data_dir()
        _log_fh = open(os.path.join(_base, "cctv_service.log"), "a", encoding="utf-8")
    except Exception:
        pass
    if sys.stdout is None:
        sys.stdout = SafeStream(_log_fh)
    if sys.stderr is None:
        sys.stderr = SafeStream(_log_fh)

import time
import socket
import configparser
import winreg
import ctypes
import ctypes.wintypes as w
import threading
import webbrowser
import logging
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as item

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("tray_launcher")

APP_NAME = "CCTV Health Monitor"
REG_KEY_NAME = "CCTVHealthMonitor"
DEFAULT_PORT = 8085  # Default port (avoids 8000/8080 conflicts)


def get_base_dir() -> str:
    """Returns directory of executable when frozen, or script directory in dev."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def load_or_create_config() -> dict:
    """
    Loads config.ini from the application directory.
    If missing, creates a default config.ini with port and host settings.
    """
    base_dir = get_base_dir()
    config_path = os.path.join(base_dir, "config.ini")
    config = configparser.ConfigParser()

    if not os.path.exists(config_path):
        config["Server"] = {
            "port": str(DEFAULT_PORT),
            "host": "0.0.0.0",
            "auto_find_free_port": "true"
        }
        try:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write("# CCTV Health Monitoring Configuration\n")
                f.write("# You can change the port number here and restart the application.\n\n")
                config.write(f)
            logger.info(f"Created default configuration: {config_path}")
        except Exception as e:
            logger.warning(f"Could not write default config.ini: {e}")
    else:
        try:
            config.read(config_path, encoding="utf-8")
        except Exception as e:
            logger.warning(f"Error reading config.ini, using defaults: {e}")

    # Allow CLI --port override if provided
    port = config.getint("Server", "port", fallback=DEFAULT_PORT)
    for idx, arg in enumerate(sys.argv):
        if arg == "--port" and idx + 1 < len(sys.argv):
            try:
                port = int(sys.argv[idx + 1])
            except ValueError:
                pass

    host = config.get("Server", "host", fallback="0.0.0.0")
    auto_find = config.getboolean("Server", "auto_find_free_port", fallback=True)
    return {"port": port, "host": host, "auto_find_free_port": auto_find}


def resolve_available_port(host: str, preferred_port: int, auto_find: bool = True) -> int:
    """
    Checks if preferred_port is available. If taken and auto_find is True,
    scans subsequent ports to find an open port, preventing startup crashes.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, preferred_port))
            return preferred_port
        except OSError:
            if not auto_find:
                logger.warning(f"Port {preferred_port} is busy and auto_find_free_port is False.")
                return preferred_port

    logger.warning(f"Port {preferred_port} is already in use by another program. Scanning for next available port...")
    for candidate in range(preferred_port + 1, preferred_port + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, candidate))
                logger.info(f"Auto-selected free port: {candidate}")
                return candidate
            except OSError:
                continue

    return preferred_port


# ----------------------------------------------------------------------
# 1. Single Instance Protection via Windows Kernel Mutex
# ----------------------------------------------------------------------
MUTEX_NAME = "Global\\CCTV_Health_Monitor_Single_Instance_Mutex"
ERROR_ALREADY_EXISTS = 183

_mutex_handle = None

def check_single_instance(dashboard_url: str) -> bool:
    """
    Returns True if this is the only running instance.
    If another instance is detected, opens the browser to the dashboard and exits.
    """
    global _mutex_handle
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    CreateMutexW = kernel32.CreateMutexW
    CreateMutexW.argtypes = [ctypes.c_void_p, w.BOOL, w.LPCWSTR]
    CreateMutexW.restype = w.HANDLE

    _mutex_handle = CreateMutexW(None, False, MUTEX_NAME)
    last_error = kernel32.GetLastError()

    if last_error == ERROR_ALREADY_EXISTS:
        logger.info("Another instance is already running. Opening existing dashboard...")
        webbrowser.open(dashboard_url)
        return False
    return True


# ----------------------------------------------------------------------
# 2. Windows Auto-Start Registry Helpers (HKCU - No Admin Required)
# ----------------------------------------------------------------------
RUN_KEY_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"

def is_autostart_enabled() -> bool:
    """Checks if the application is registered in Windows Startup."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, REG_KEY_NAME)
            return True
    except FileNotFoundError:
        return False
    except Exception as e:
        logger.warning(f"Error checking autostart status: {e}")
        return False

def set_autostart(enable: bool) -> None:
    """Enables or disables auto-starting the application on Windows login."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                # Use current executable or pythonw script path
                if getattr(sys, "frozen", False):
                    cmd = f'"{sys.executable}"'
                else:
                    python_exe = sys.executable.replace("python.exe", "pythonw.exe")
                    if not os.path.exists(python_exe):
                        python_exe = sys.executable
                    script_path = os.path.abspath(__file__)
                    cmd = f'"{python_exe}" "{script_path}"'
                winreg.SetValueEx(key, REG_KEY_NAME, 0, winreg.REG_SZ, cmd)
                logger.info(f"Autostart enabled: {cmd}")
            else:
                try:
                    winreg.DeleteValue(key, REG_KEY_NAME)
                    logger.info("Autostart disabled.")
                except FileNotFoundError:
                    pass
    except Exception as e:
        logger.error(f"Failed to update autostart registry: {e}")


# ----------------------------------------------------------------------
# 3. Dynamic Tray Icon Generation (High Contrast 64x64 for Win 10 & 11)
# ----------------------------------------------------------------------
def create_tray_icon_image() -> Image.Image:
    """
    Draws a crisp, high-contrast 64x64 icon suitable for both dark and light
    taskbars across Windows 10 and Windows 11 with DPI scaling.
    Emerald green circular badge with a sharp white CCTV camera silhouette.
    """
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer badge circle (Emerald #10B981)
    draw.ellipse((2, 2, 62, 62), fill=(16, 185, 129, 255))
    
    # Inner border for extra depth
    draw.ellipse((4, 4, 60, 60), outline=(255, 255, 255, 120), width=1)

    # CCTV camera body (white rectangle)
    draw.rounded_rectangle((16, 23, 43, 41), radius=3, fill=(255, 255, 255, 255))

    # CCTV camera lens cone (white polygon)
    draw.polygon([(43, 27), (53, 19), (53, 45), (43, 37)], fill=(255, 255, 255, 255))

    # Small camera lens pupil (emerald center)
    draw.ellipse((49, 29, 53, 35), fill=(16, 185, 129, 255))

    # Camera mount base
    draw.rectangle((26, 41, 33, 47), fill=(255, 255, 255, 220))
    draw.rectangle((21, 47, 38, 50), fill=(255, 255, 255, 220))

    return img


# ----------------------------------------------------------------------
# 4. Thread-Safe Uvicorn Server
# ----------------------------------------------------------------------
import uvicorn
from app.database import init_db
from app.main import app

class StandaloneServer(uvicorn.Server):
    """
    Subclass of Uvicorn Server that disables signal handlers so it can
    safely run inside a secondary thread without crashing on Windows.
    """
    def install_signal_handlers(self) -> None:
        pass


class ServerThread(threading.Thread):
    def __init__(self, port: int = DEFAULT_PORT):
        super().__init__(daemon=True)
        self.port = port
        self.config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=self.port,
            log_level="info",
            access_log=False,
            log_config=None,
            use_colors=False
        )
        self.server = StandaloneServer(config=self.config)

    def run(self):
        logger.info(f"Starting CCTV background server on port {self.port}...")
        self.server.run()

    def stop(self):
        logger.info("Stopping CCTV background server...")
        self.server.should_exit = True


# ----------------------------------------------------------------------
# 5. Tray Application & Menu Handlers
# ----------------------------------------------------------------------
class TrayApplication:
    def __init__(self):
        # Load settings from config.ini (or create default)
        cfg = load_or_create_config()
        self.host = cfg["host"]
        configured_port = cfg["port"]
        auto_find = cfg["auto_find_free_port"]

        # Safely resolve open port to prevent port collision crashes
        self.port = resolve_available_port(self.host, configured_port, auto_find=auto_find)
        self.dashboard_url = f"http://localhost:{self.port}"
        self.server_thread = None
        self.tray_icon = None

    def on_open_dashboard(self, icon=None, item=None):
        webbrowser.open(self.dashboard_url)

    def on_open_snapshots(self, icon=None, item=None):
        from app.paths import get_snapshots_dir
        snapshots_dir = get_snapshots_dir()
        try:
            os.startfile(snapshots_dir)
        except Exception as e:
            logger.error(f"Failed to open snapshots directory: {e}")

    def on_toggle_autostart(self, icon=None, item=None):
        current_state = is_autostart_enabled()
        set_autostart(not current_state)

    def is_autostart_checked(self, item=None) -> bool:
        return is_autostart_enabled()

    def on_exit(self, icon=None, item=None):
        logger.info("Exit requested from system tray.")
        if self.tray_icon:
            self.tray_icon.stop()
        if self.server_thread:
            self.server_thread.stop()
        # Cleanly release mutex
        global _mutex_handle
        if _mutex_handle:
            kernel32 = ctypes.WinDLL("kernel32")
            kernel32.CloseHandle(_mutex_handle)
            _mutex_handle = None
        logger.info("Clean shutdown completed.")
        sys.exit(0)

    def build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            item(f"{APP_NAME} (Port {self.port})", lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            item("🌐 Open Dashboard", self.on_open_dashboard, default=True),
            item("📁 Open Snapshots Folder", self.on_open_snapshots),
            pystray.Menu.SEPARATOR,
            item(
                "✓ Start with Windows",
                self.on_toggle_autostart,
                checked=self.is_autostart_checked
            ),
            pystray.Menu.SEPARATOR,
            item("❌ Exit / Stop Monitor", self.on_exit)
        )

    def run(self):
        # 1. Single Instance Check
        if not check_single_instance(self.dashboard_url):
            return

        # 2. Initialize Database if needed
        import asyncio
        from app.paths import get_db_path
        db_path = get_db_path()
        asyncio.run(init_db(db_path))

        # 3. Start Uvicorn Server in Background Thread
        self.server_thread = ServerThread(port=self.port)
        self.server_thread.start()

        # Brief delay to allow initial server socket bind
        time.sleep(1.2)

        # 4. Open dashboard in default browser on launch
        webbrowser.open(self.dashboard_url)

        # 5. Build and Run System Tray Icon in Main Thread
        icon_image = create_tray_icon_image()
        self.tray_icon = pystray.Icon(
            name="CCTVHealthMonitor",
            icon=icon_image,
            title=f"{APP_NAME} (Running on port {self.port})",
            menu=self.build_menu()
        )

        logger.info(f"{APP_NAME} is running in background on port {self.port}. System tray icon active.")
        
        # Notify user with a Windows balloon notification
        try:
            self.tray_icon.notify(
                f"CCTV Health Monitor is running on port {self.port}.\nRight-click tray icon to manage.",
                "CCTV Monitor Online"
            )
        except Exception:
            pass

        # icon.run() blocks the main thread and handles Windows messages
        self.tray_icon.run()


if __name__ == "__main__":
    app_launcher = TrayApplication()
    app_launcher.run()
