import csv
import io
import re
from typing import Tuple, List, Dict, Any, Optional

CSV_HEADERS = [
    "name",
    "dvr_nvr_name",
    "location",
    "ip_address",
    "port",
    "channel_no",
    "rtsp_url",
    "is_enabled",
    "is_spare"
]

def generate_csv_template() -> str:
    """
    Generates a sample CSV template with standard headers and an example row.
    Uses masked password placeholder (*****) to show standard template pattern.
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
        "rtsp://admin:*****@192.168.1.50:554/ch1/main/av_stream",
        "true",
        "false"
    ])
    return output.getvalue()


def mask_rtsp_password(url: Optional[str]) -> str:
    """
    Masks ONLY the password in an RTSP URL with '*****', keeping username intact.
    e.g. rtsp://admin:secret@192.168.1.10:554/ch1 -> rtsp://admin:*****@192.168.1.10:554/ch1
    e.g. rtsp://192.168.1.10:554/ch1 -> rtsp://192.168.1.10:554/ch1
    """
    if not url:
        return ""
    url_str = str(url)
    if url_str.startswith("enc:"):
        from app.security import decrypt_val
        url_str = decrypt_val(url_str) or ""

    m = re.match(r'^(rtsps?://)([^:@/\s]+)(?::([^@/\s]+))?@(.*)$', url_str)
    if m:
        proto, user, passwd, rest = m.groups()
        return f"{proto}{user}:*****@{rest}"
    return url_str


def inject_rtsp_credentials(
    rtsp_url: str,
    default_username: Optional[str] = None,
    default_password: Optional[str] = None,
    override_all: bool = False
) -> str:
    """
    Injects or replaces credentials in an RTSP URL.
    - If URL contains '*****' (masked password) or has no password, and default_password is provided:
      replaces with default_password.
    - If default_username is provided, updates/injects the username as well.
    - If override_all is True, replaces any existing credentials with the provided ones.
    """
    if not rtsp_url:
        return rtsp_url

    clean_user = default_username.strip() if default_username and default_username.strip() else None
    clean_pass = default_password if default_password is not None and default_password != "" else None

    m = re.match(r'^(rtsps?://)(?:([^:@/\s]+)(?::([^@/\s]*))?@)?(.*)$', rtsp_url)
    if not m:
        return rtsp_url

    proto, existing_user, existing_pass, rest = m.groups()

    # Determine username
    if clean_user:
        target_user = clean_user
    elif existing_user and existing_user != "*****":
        target_user = existing_user
    else:
        target_user = "admin"

    # Determine password
    if clean_pass is not None:
        if override_all or not existing_pass or existing_pass == "*****":
            target_pass = clean_pass
        else:
            target_pass = existing_pass
    else:
        target_pass = existing_pass

    if target_user and target_pass is not None:
        return f"{proto}{target_user}:{target_pass}@{rest}"
    elif target_user:
        return f"{proto}{target_user}@{rest}"
    else:
        return f"{proto}{rest}"


def _extract_ip_from_rtsp(url: str) -> str:
    """Extracts host/IP from RTSP URL if ip_address column is blank."""
    match = re.search(r'@([^:/]+)', url)
    if match:
        return match.group(1)
    match_no_auth = re.search(r'rtsp[s]?://([^:/]+)', url)
    if match_no_auth:
        return match_no_auth.group(1)
    return "127.0.0.1"


def parse_and_validate_csv(
    csv_content: str,
    default_username: Optional[str] = None,
    default_password: Optional[str] = None,
    override_credentials: bool = False
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parses CSV text into a list of validated camera dictionaries.
    Supports injecting default credentials into masked (*****) or unauthenticated RTSP URLs.
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
        norm_row = {k.strip().lower(): v.strip() for k, v in row.items() if k and v is not None}
        
        raw_rtsp = norm_row.get("rtsp_url", "")
        if not raw_rtsp:
            errors.append(f"Row {row_idx}: 'rtsp_url' is required")
            continue

        # Inject or update credentials
        rtsp_url = inject_rtsp_credentials(
            raw_rtsp,
            default_username=default_username,
            default_password=default_password,
            override_all=override_credentials
        )

        if "*****" in rtsp_url:
            errors.append(
                f"Row {row_idx}: RTSP password contains '*****' (masked). Please enter a Default Password during import."
            )
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
        
        # Spare / No Cam (support is_spare, is_no_cam, or spare aliases)
        spare_val = (
            norm_row.get("is_spare") or 
            norm_row.get("is_no_cam") or 
            norm_row.get("spare") or 
            "false"
        ).lower()
        is_no_cam = spare_val in ("true", "1", "yes", "t", "y")

        valid_rows.append({
            "name": name,
            "dvr_nvr_name": dvr_nvr_name,
            "location": location,
            "ip_address": ip_address,
            "port": port,
            "channel_no": str(channel_no),
            "rtsp_url": rtsp_url,
            "is_enabled": is_enabled,
            "is_no_cam": is_no_cam
        })
        
    return valid_rows, errors


def export_cameras_to_csv(cameras: List[Dict[str, Any]]) -> str:
    """
    Serializes a list of camera records into CSV text.
    RTSP passwords are masked with '*****' to safeguard plant cybersecurity.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    
    for cam in cameras:
        # Secure export: Mask password so plaintext credentials are never saved in CSV files
        raw_url = cam.get("rtsp_url", "")
        url = mask_rtsp_password(raw_url) or cam.get("masked_url", "") or raw_url
        is_spare = bool(cam.get("is_no_cam"))
        writer.writerow([
            cam.get("name", ""),
            cam.get("dvr_nvr_name", ""),
            cam.get("location", ""),
            cam.get("ip_address", ""),
            cam.get("port", 554),
            cam.get("channel_no", ""),
            url,
            "true" if cam.get("is_enabled", 1) else "false",
            "true" if is_spare else "false"
        ])
    return output.getvalue()
