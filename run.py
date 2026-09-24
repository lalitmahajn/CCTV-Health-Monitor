"""
CCTV Health Monitoring System Launcher
"""
import sys
import argparse
import asyncio
import uvicorn
from app.database import init_db
from app.models import CameraRepository
from app.simulator import seed_270_cameras

def main():
    parser = argparse.ArgumentParser(description="Run CCTV Health Monitoring System")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to run server on (default: 8000)")
    parser.add_argument("--db", default="cctv_monitor.db", help="Path to SQLite database")
    parser.add_argument("--seed-demo", action="store_true", help="Pre-seed 270 mock cameras across 10 NVRs")
    
    args = parser.parse_args()

    # Initialize DB
    asyncio.run(init_db(args.db))
    
    if args.seed_demo:
        repo = CameraRepository(args.db)
        count = asyncio.run(seed_270_cameras(repo, clear_existing=True))
        print(f"[*] Pre-seeded {count} mock cameras across 10 NVRs into {args.db}")

    print(f"[*] Starting CCTV Health Monitoring Server on http://{args.host}:{args.port}")
    print(f"[*] Web UI available at http://localhost:{args.port}")
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=False)

if __name__ == "__main__":
    main()
