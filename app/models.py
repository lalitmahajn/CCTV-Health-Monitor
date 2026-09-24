import re
import aiosqlite
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.database import get_db

def mask_rtsp_url(url: str) -> str:
    """
    Masks credentials in RTSP URL.
    e.g. rtsp://admin:secret123@192.168.1.10:554/ch1 -> rtsp://admin:*****@192.168.1.10:554/ch1
    """
    if not url:
        return url
    # Pattern to match rtsp://username:password@
    pattern = r'^(rtsp[s]?://[^:]+):([^@]+)@'
    return re.sub(pattern, r'\1:*****@', url)

class CameraRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path

    async def create(self, name: str, ip_address: str, rtsp_url: str,
                     dvr_nvr_name: str = "", location: str = "",
                     port: int = 554, channel_no: str = "",
                     is_enabled: bool = True, is_no_cam: bool = False) -> int:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                INSERT INTO cameras (name, dvr_nvr_name, location, ip_address, port, channel_no, rtsp_url, is_enabled, is_no_cam)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, dvr_nvr_name, location, ip_address, port, str(channel_no), rtsp_url, 1 if is_enabled else 0, 1 if is_no_cam else 0))
            await db.commit()
            return cursor.lastrowid

    async def get_by_id(self, camera_id: int) -> Optional[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = dict(row)
                data["masked_url"] = mask_rtsp_url(data["rtsp_url"])
                return data

    async def get_all(self, enabled_only: bool = False) -> List[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            query = "SELECT * FROM cameras"
            if enabled_only:
                query += " WHERE is_enabled = 1"
            query += " ORDER BY id ASC"
            async with db.execute(query) as cursor:
                rows = await cursor.fetchall()
                results = []
                for row in rows:
                    item = dict(row)
                    item["masked_url"] = mask_rtsp_url(item["rtsp_url"])
                    results.append(item)
                return results

    async def update_status(self, camera_id: int, status: str, consecutive_failures: int,
                            latency_ms: float = 0.0, last_error: str = None,
                            thumbnail_path: str = None):
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            updates = [
                "status = ?",
                "consecutive_failures = ?",
                "latency_ms = ?",
                "last_checked = ?",
                "last_error = ?",
                "updated_at = CURRENT_TIMESTAMP"
            ]
            params = [status, consecutive_failures, latency_ms, now, last_error]
            
            if status == "ONLINE":
                updates.append("last_seen = ?")
                params.append(now)
                
            if thumbnail_path:
                updates.append("thumbnail_path = ?")
                params.append(thumbnail_path)
                
            params.append(camera_id)
            query = f"UPDATE cameras SET {', '.join(updates)} WHERE id = ?"
            await db.execute(query, params)
            await db.commit()

    async def delete(self, camera_id: int) -> bool:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
            await db.commit()
            return cursor.rowcount > 0

    async def update(self, camera_id: int, **fields) -> bool:
        allowed = {"name", "dvr_nvr_name", "location", "ip_address", "port", "channel_no", "rtsp_url", "is_enabled", "is_no_cam"}
        set_clauses = []
        params = []
        for k, v in fields.items():
            if k in allowed:
                set_clauses.append(f"{k} = ?")
                params.append(v)
        if not set_clauses:
            return False
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        params.append(camera_id)
        
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(f"UPDATE cameras SET {', '.join(set_clauses)} WHERE id = ?", params)
            await db.commit()
            return cursor.rowcount > 0

    async def toggle_no_cam(self, camera_id: int) -> Optional[Dict[str, Any]]:
        cam = await self.get_by_id(camera_id)
        if not cam:
            return None
        new_no_cam = 0 if cam.get("is_no_cam") else 1
        new_status = "NO_CAM" if new_no_cam == 1 else "UNKNOWN"
        async with get_db(self.db_path) as db:
            await db.execute("""
                UPDATE cameras 
                SET is_no_cam = ?, status = ?, consecutive_failures = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_no_cam, new_status, camera_id))
            await db.commit()
        return await self.get_by_id(camera_id)



class NvrRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path

    async def upsert(self, name: str, ip_address: str, port: int, total_channels: int, used_channels: int, make: str = "", model: str = ""):
        async with get_db(self.db_path) as db:
            await db.execute("""
                INSERT INTO nvrs (name, ip_address, port, total_channels, used_channels, make, model)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    ip_address = excluded.ip_address,
                    port = excluded.port,
                    total_channels = excluded.total_channels,
                    used_channels = excluded.used_channels,
                    make = excluded.make,
                    model = excluded.model
            """, (name, ip_address, port, total_channels, used_channels, make, model))
            await db.commit()

    async def get_all(self) -> List[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM nvrs ORDER BY name ASC") as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    async def rename(self, old_name: str, new_name: str) -> int:
        old_name = old_name.strip()
        new_name = new_name.strip()
        if not old_name or not new_name:
            raise ValueError("Recorder name cannot be empty.")
        if old_name == new_name:
            return 0

        async with get_db(self.db_path) as db:
            # Check collision with other NVR with different name
            async with db.execute("SELECT name FROM nvrs WHERE LOWER(name) = LOWER(?) AND LOWER(name) != LOWER(?)", (new_name, old_name)) as cursor:
                collision = await cursor.fetchone()
                if collision:
                    raise ValueError(f"A recorder named '{collision[0]}' already exists.")

            # Update cameras table for all matching cameras
            cursor_cams = await db.execute(
                "UPDATE cameras SET dvr_nvr_name = ?, updated_at = CURRENT_TIMESTAMP WHERE LOWER(dvr_nvr_name) = LOWER(?)",
                (new_name, old_name)
            )
            cams_updated = cursor_cams.rowcount

            # Update nvrs table entry
            cursor_nvrs = await db.execute(
                "UPDATE nvrs SET name = ? WHERE LOWER(name) = LOWER(?)",
                (new_name, old_name)
            )
            if cursor_nvrs.rowcount == 0:
                # If entry was not in nvrs table, insert it using attributes from updated cameras
                async with db.execute("SELECT ip_address, port FROM cameras WHERE LOWER(dvr_nvr_name) = LOWER(?) LIMIT 1", (new_name,)) as c_cur:
                    row = await c_cur.fetchone()
                    ip = row[0] if row else "127.0.0.1"
                    port = row[1] if row else 554
                await db.execute("""
                    INSERT INTO nvrs (name, ip_address, port, total_channels, used_channels)
                    VALUES (?, ?, ?, ?, ?)
                """, (new_name, ip, port, 16, cams_updated))

            await db.commit()
            return cams_updated

class IncidentRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path

    async def open_incident(self, camera_id: int, error_reason: str) -> int:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                INSERT INTO incidents (camera_id, started_at, error_reason)
                VALUES (?, ?, ?)
            """, (camera_id, now, error_reason))
            await db.commit()
            return cursor.lastrowid

    async def close_incident(self, incident_id: int) -> Optional[int]:
        now_dt = datetime.utcnow()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT started_at FROM incidents WHERE id = ?", (incident_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                started_dt = datetime.strptime(row["started_at"], "%Y-%m-%d %H:%M:%S")
                duration = int((now_dt - started_dt).total_seconds())
                
            await db.execute("""
                UPDATE incidents
                SET resolved_at = ?, duration_seconds = ?
                WHERE id = ?
            """, (now_str, duration, incident_id))
            await db.commit()
            return duration

    async def get_active(self, camera_id: Optional[int] = None) -> List[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            query = """
                SELECT i.*, c.name as camera_name, c.location, c.dvr_nvr_name, c.channel_no, c.ip_address
                FROM incidents i
                JOIN cameras c ON i.camera_id = c.id
                WHERE i.resolved_at IS NULL
            """
            params = []
            if camera_id:
                query += " AND i.camera_id = ?"
                params.append(camera_id)
            query += " ORDER BY i.started_at DESC"
            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    async def get_by_id(self, incident_id: int) -> Optional[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            query = """
                SELECT i.*, c.name as camera_name, c.location, c.dvr_nvr_name, c.channel_no, c.ip_address
                FROM incidents i
                JOIN cameras c ON i.camera_id = c.id
                ORDER BY i.started_at DESC LIMIT ?
            """
            async with db.execute(query, (limit,)) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

    async def acknowledge(self, incident_id: int) -> bool:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("UPDATE incidents SET acknowledged = 1 WHERE id = ?", (incident_id,))
            await db.commit()
            return cursor.rowcount > 0


class SettingsRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path

    async def get_all(self) -> Dict[str, str]:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT key, value FROM settings") as cursor:
                rows = await cursor.fetchall()
                return {r["key"]: r["value"] for r in rows}

    async def get(self, key: str, default: Any = None) -> Any:
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cursor:
                row = await cursor.fetchone()
                return row["value"] if row else default

    async def set(self, key: str, value: str, description: str = ""):
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            await db.execute("""
                INSERT INTO settings (key, value, description)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (key, str(value), description))
            await db.commit()

    async def update_many(self, settings_dict: Dict[str, str]):
        async with get_db(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            for k, v in settings_dict.items():
                await db.execute("""
                    INSERT INTO settings (key, value)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """, (k, str(v)))
            await db.commit()
