import os
import aiosqlite
from app.paths import get_db_path

DEFAULT_DB_PATH = get_db_path()

def get_db(db_path: str = None):
    path = db_path or get_db_path()
    return aiosqlite.connect(path, timeout=30.0)

async def init_db(db_path: str = None):
    path = db_path or get_db_path()
    parent_dir = os.path.dirname(os.path.abspath(path))
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
    async with aiosqlite.connect(path, timeout=30.0) as db:
        await db.execute("PRAGMA journal_mode = WAL")
        await db.execute("PRAGMA busy_timeout = 30000")
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
                is_no_cam BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add is_no_cam column if existing database doesn't have it
        try:
            await db.execute("ALTER TABLE cameras ADD COLUMN is_no_cam BOOLEAN DEFAULT 0")
        except Exception:
            pass

        # Migration: normalize legacy bracketed channel numbers in camera names (e.g. "Reception (Ch 01)" -> "Reception")
        try:
            await db.execute("""
                UPDATE cameras
                SET name = location
                WHERE location IS NOT NULL 
                  AND TRIM(location) != ''
                  AND name LIKE '%(Ch %)'
            """)
        except Exception:
            pass

        # NVR Metadata table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS nvrs (
                name TEXT PRIMARY KEY,
                ip_address TEXT,
                port INTEGER DEFAULT 554,
                total_channels INTEGER DEFAULT 16,
                used_channels INTEGER DEFAULT 0,
                make TEXT,
                model TEXT,
                status TEXT DEFAULT 'UNKNOWN',
                latency_ms REAL DEFAULT 0.0,
                last_checked DATETIME,
                last_seen DATETIME,
                consecutive_failures INTEGER DEFAULT 0,
                last_error TEXT
            )
        """)

        # Migration: add health columns to nvrs table if missing in existing databases
        for col_name, col_type in [
            ("status", "TEXT DEFAULT 'UNKNOWN'"),
            ("latency_ms", "REAL DEFAULT 0.0"),
            ("last_checked", "DATETIME"),
            ("last_seen", "DATETIME"),
            ("consecutive_failures", "INTEGER DEFAULT 0"),
            ("last_error", "TEXT")
        ]:
            try:
                await db.execute(f"ALTER TABLE nvrs ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass
        
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
            ("simulation_mode", "false", "Run in mock simulation mode"),
            ("enable_email_alerts", "false", "Enable SMTP email outage alerts"),
            ("notify_email_outage", "true", "Send email alert immediately when a camera goes offline"),
            ("notify_email_recovery", "true", "Send email alert immediately when a camera recovers online"),
            ("notify_email_daily_digest", "false", "Send daily 24h fleet health summary digest"),
            ("notify_email_weekly_report", "false", "Send weekly SLA and repeat offenders report"),
            ("notify_email_monthly_report", "false", "Send monthly executive fleet audit and MTTR report"),
            ("notify_email_escalation", "false", "Send escalation reminder for unresolved outages > 2 hours"),
            ("notify_email_heartbeat", "false", "Send periodic system heartbeat health check email"),
            ("smtp_host", "", "SMTP server hostname"),
            ("smtp_port", "587", "SMTP server port"),
            ("smtp_user", "", "SMTP username / sender email"),
            ("smtp_password", "", "SMTP password or app password"),
            ("smtp_use_tls", "true", "Use TLS/STARTTLS for SMTP connection"),
            ("email_recipients", "", "Comma-separated list of alert recipients"),
            ("time_format", "12h", "Display time format: 12h or 24h"),
        ]

        
        for k, v, desc in defaults:
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)",
                (k, v, desc)
            )

        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                last_login_at DATETIME
            )
        """)

        # Audit Logs table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                ip_address TEXT
            )
        """)

        # Seed default admin user if users table is empty
        async with db.execute("SELECT COUNT(*) FROM users") as cursor:
            count_row = await cursor.fetchone()
            if count_row and count_row[0] == 0:
                import bcrypt
                from datetime import datetime, timezone
                now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
                await db.execute(
                    "INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    ("admin", admin_hash, now_str, now_str)
                )
                await db.execute(
                    "INSERT INTO audit_logs (timestamp, event_type, description, ip_address) VALUES (?, ?, ?, ?)",
                    (now_str, "SYSTEM_INITIALIZED", "Default admin account provisioned (username: admin)", "127.0.0.1")
                )

        # Migrate & secure database at rest: encrypt any plaintext RTSP URLs and sensitive settings
        from app.security import encrypt_val
        async with db.execute("SELECT id, rtsp_url FROM cameras") as cursor:
            cams = await cursor.fetchall()
            for cam_id, url in cams:
                if url and not url.startswith("enc:"):
                    await db.execute("UPDATE cameras SET rtsp_url = ? WHERE id = ?", (encrypt_val(url), cam_id))

        async with db.execute("SELECT key, value FROM settings WHERE key IN ('smtp_password', 'telegram_bot_token')") as cursor:
            s_rows = await cursor.fetchall()
            for key, val in s_rows:
                if val and not val.startswith("enc:"):
                    await db.execute("UPDATE settings SET value = ? WHERE key = ?", (encrypt_val(val), key))

        await db.commit()

