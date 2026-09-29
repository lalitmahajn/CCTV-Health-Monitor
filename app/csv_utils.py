import csv
import io
import re
from typing import Tuple, List, Dict, Any

CSV_HEADERS = [
    "name",
    "dvr_nvr_name",
    "location",
    "ip_address",
    "port",
    "channel_no",
    "rtsp_url",
    "is_enabled"
]

def generate_csv_template() -> str:
    """
    Generates a sample CSV template with standard headers and an example row.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    writer.writerow([
        "Entrance Gate Cam",
        "NVR-Building-A",
        "Main Gate",
        "192.168.1.50",
        "554",
        "01",
        "rtsp://admin:password@192.168.1.50:554/ch1/main/av_stream",
        "true"
    ])
    return output.getvalue()


def _extract_ip_from_rtsp(url: str) -> str:
    """Extracts host/IP from RTSP URL if ip_address column is blank."""
    match = re.search(r'@([^:/]+)', url)
    if match:
        return match.group(1)
    match_no_auth = re.search(r'rtsp[s]?://([^:/]+)', url)
    if match_no_auth:
        return match_no_auth.group(1)
    return "127.0.0.1"


def parse_and_validate_csv(csv_content: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parses CSV text into a list of validated camera dictionaries.
    Returns: (valid_camera_dicts, error_messages)
    """
    f = io.StringIO(csv_content.strip())
    reader = csv.DictReader(f)
    
    valid_rows = []
    errors = []
    
    if not reader.fieldnames:
        return [], ["CSV file is empty or missing headers"]

    # Normalize fieldnames (lowercase and stripped)
    clean_fieldnames = [fn.strip().lower() for fn in reader.fieldnames if fn]
    
    if "rtsp_url" not in clean_fieldnames:
        return [], ["Missing required header 'rtsp_url' in CSV file"]

    for row_idx, row in enumerate(reader, start=2):
        # Normalize keys in row
        norm_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        
        rtsp_url = norm_row.get("rtsp_url", "")
        if not rtsp_url:
            errors.append(f"Row {row_idx}: 'rtsp_url' is required")
            continue
            
        name = norm_row.get("name") or f"Camera {row_idx - 1}"
        dvr_nvr_name = norm_row.get("dvr_nvr_name", "")
        location = norm_row.get("location", "")
        
        # IP Address
        ip_address = norm_row.get("ip_address")
        if not ip_address:
            ip_address = _extract_ip_from_rtsp(rtsp_url)
            
        # Port
        port_raw = norm_row.get("port", "554")
        try:
            port = int(port_raw) if port_raw else 554
        except ValueError:
            errors.append(f"Row {row_idx}: Invalid port '{port_raw}' - must be an integer")
            continue
            
        channel_no = norm_row.get("channel_no", "")
        
        # Enabled
        enabled_val = norm_row.get("is_enabled", "true").lower()
        is_enabled = enabled_val in ("true", "1", "yes", "t", "y")
        
        valid_rows.append({
            "name": name,
            "dvr_nvr_name": dvr_nvr_name,
            "location": location,
            "ip_address": ip_address,
            "port": port,
            "channel_no": str(channel_no),
            "rtsp_url": rtsp_url,
            "is_enabled": is_enabled
        })
        
    return valid_rows, errors


def export_cameras_to_csv(cameras: List[Dict[str, Any]]) -> str:
    """
    Serializes a list of camera records into CSV text.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    
    for cam in cameras:
        writer.writerow([
            cam.get("name", ""),
            cam.get("dvr_nvr_name", ""),
            cam.get("location", ""),
            cam.get("ip_address", ""),
            cam.get("port", 554),
            cam.get("channel_no", ""),
            cam.get("masked_url") or cam.get("rtsp_url", ""),
            "true" if cam.get("is_enabled", 1) else "false"

        ])
    return output.getvalue()
