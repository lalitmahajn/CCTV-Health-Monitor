import os
import aiosqlite

DEFAULT_DB_PATH = os.environ.get("CCTV_DB_PATH", "cctv_monitor.db")

def get_db(db_path: str = None):
    path = db_path or DEFAULT_DB_PATH
    return aiosqlite.connect(path)

async def init_db(db_path: str = None):
    path = db_path or DEFAULT_DB_PATH
    async with aiosqlite.connect(path) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        
        # Cameras table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                dvr_nvr_name TEXT,
                location TEXT,
                ip_address TEXT NOT NULL,
                port INTEGER DEFAULT 554,
                channel_no TEXT,
                rtsp_url TEXT NOT NULL,
                status TEXT DEFAULT 'UNKNOWN',
                consecutive_failures INTEGER DEFAULT 0,
                latency_ms REAL DEFAULT 0.0,
                last_checked DATETIME,
                last_seen DATETIME,
                last_error TEXT,
                thumbnail_path TEXT,
                is_enabled BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # NVR Metadata table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS nvrs (
                name TEXT PRIMARY KEY,
                ip_address TEXT,
                port INTEGER DEFAULT 554,
                total_channels INTEGER DEFAULT 16,
                used_channels INTEGER DEFAULT 0,
                make TEXT,
                model TEXT
            )
        """)
        
        # Incidents table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
                started_at DATETIME NOT NULL,
                resolved_at DATETIME,
                duration_seconds INTEGER,
                error_reason TEXT,
                acknowledged BOOLEAN DEFAULT 0
            )
        """)
        
        # Settings table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT
            )
        """)
        
        # Insert default settings if not exists
        defaults = [
            ("ping_interval_seconds", "30", "TCP ping interval in seconds"),
            ("snapshot_interval_seconds", "600", "Frame grab interval in seconds"),
            ("failure_threshold", "2", "Consecutive failures before marking OFFLINE"),
            ("socket_timeout_ms", "3000", "TCP socket connection timeout in ms"),
            ("latency_warning_threshold_ms", "1500", "Latency threshold for WARNING status in ms"),
            ("enable_black_screen_detection", "false", "Check if grabbed frame is completely black"),
            ("enable_frozen_frame_detection", "false", "Check if consecutive frames are identical"),
            ("max_concurrency_per_host", "2", "Max concurrent stream requests per physical NVR IP"),
            ("enable_audio_alert", "true", "Enable UI sound chime on outages"),
            ("simulation_mode", "false", "Run in mock simulation mode")
        ]
        
        for k, v, desc in defaults:
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)",
                (k, v, desc)
            )
            
        await db.commit()
