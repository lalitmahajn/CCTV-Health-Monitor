from app.models import CameraRepository

async def seed_270_cameras(repo: CameraRepository, clear_existing: bool = True) -> int:
    """
    Populates 270 mock cameras across 10 NVRs (approx 27 cameras each)
    with realistic physical locations, channel numbers, and host groupings.
    """
    if clear_existing:
        existing = await repo.get_all()
        for c in existing:
            await repo.delete(c["id"])

    nvrs = [
        {"name": "NVR-01-MainAdmin", "ip": "192.168.10.11", "zone": "Admin Block"},
        {"name": "NVR-02-Warehouse-A", "ip": "192.168.10.12", "zone": "Warehouse North"},
        {"name": "NVR-03-Warehouse-B", "ip": "192.168.10.13", "zone": "Warehouse South"},
        {"name": "NVR-04-Production-1", "ip": "192.168.10.14", "zone": "Factory Line 1"},
        {"name": "NVR-05-Production-2", "ip": "192.168.10.15", "zone": "Factory Line 2"},
        {"name": "NVR-06-Perimeter-East", "ip": "192.168.10.16", "zone": "Perimeter Fence"},
        {"name": "NVR-07-Perimeter-West", "ip": "192.168.10.17", "zone": "Perimeter Fence"},
        {"name": "NVR-08-Parking-Logistics", "ip": "192.168.10.18", "zone": "Truck Bay & Parking"},
        {"name": "NVR-09-ServerRooms", "ip": "192.168.10.19", "zone": "Data Center & IT"},
        {"name": "NVR-10-Cafeteria-Lobby", "ip": "192.168.10.20", "zone": "Public Areas"}
    ]

    total_created = 0
    # 27 cameras per NVR = 270 total
    for nvr in nvrs:
        for ch in range(1, 28):
            ch_str = f"{ch:02d}"
            name = f"{nvr['zone']} - Cam {ch_str}"
            location = f"{nvr['zone']} Area {((ch - 1) % 5) + 1}"
            rtsp_url = f"rtsp://admin:nvrSecret99@{nvr['ip']}:554/Streaming/Channels/{ch}02"
            
            await repo.create(
                name=name,
                dvr_nvr_name=nvr["name"],
                location=location,
                ip_address=nvr["ip"],
                port=554,
                channel_no=ch_str,
                rtsp_url=rtsp_url,
                is_enabled=True
            )
            total_created += 1

    return total_created
