"""
CCTV Health Monitoring - Central Path and Storage Manager
Provides guaranteed-writable paths for database, logs, encryption keys, and snapshots.
Prevents permission errors on Windows when running without Administrator privileges.
"""

import os
import sys

def get_data_dir() -> str:
    """
    Returns a guaranteed-writable directory for application data.
    1. If CCTV_DATA_DIR is set, use that.
    2. Try the executable/app directory. If writable, use it (standard / portable).
    3. If read-only (e.g. C:\\Program Files under standard non-admin user),
       seamlessly fall back to %LOCALAPPDATA%\\CCTV Health Monitor.
    """
    env_dir = os.environ.get("CCTV_DATA_DIR")
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir

    if getattr(sys, "frozen", False):
        candidate = os.path.dirname(sys.executable)
    else:
        # Development root
        candidate = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Test if candidate directory is writable
    try:
        test_file = os.path.join(candidate, f".perm_test_{os.getpid()}")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        os.environ["CCTV_DATA_DIR"] = candidate
        return candidate
    except Exception:
        # Fall back to %LOCALAPPDATA%\\CCTV Health Monitor
        local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        fallback = os.path.join(local_app_data, "CCTV Health Monitor")
        os.makedirs(fallback, exist_ok=True)
        os.environ["CCTV_DATA_DIR"] = fallback
        return fallback


def get_db_path() -> str:
    """Returns the path to cctv_monitor.db in the active writable data directory."""
    if "CCTV_DB_PATH" in os.environ:
        return os.environ["CCTV_DB_PATH"]
    data_dir = get_data_dir()
    db_path = os.path.join(data_dir, "cctv_monitor.db")
    os.environ["CCTV_DB_PATH"] = db_path
    return db_path


def get_snapshots_dir() -> str:
    """Returns the path to the snapshots storage directory, ensuring it exists."""
    data_dir = get_data_dir()
    snap_dir = os.path.join(data_dir, "static", "snapshots")
    os.makedirs(snap_dir, exist_ok=True)
    return snap_dir
