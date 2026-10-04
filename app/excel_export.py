import io
from datetime import datetime
from typing import List, Dict, Any, Optional
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_excel_export(cameras: List[Dict[str, Any]], nvrs: Optional[List[Dict[str, Any]]] = None) -> bytes:
    """
    Generates a beautifully formatted, multi-tab Excel workbook containing:
    1. Camera Inventory & Real-Time Health Status
    2. NVR & Recorder Capacity Summary
    """
    wb = Workbook()

    # Define color palette (Executive Dark Navy & Clean Slate)
    font_title = Font(name="Segoe UI", size=15, bold=True, color="FFFFFF")
    font_subtitle = Font(name="Segoe UI", size=9.5, italic=True, color="CBD5E1")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Segoe UI", size=9.5, color="1E293B")
    font_data_mono = Font(name="Consolas", size=9, color="334155")
    font_data_bold = Font(name="Segoe UI", size=9.5, bold=True, color="0F172A")
    font_total = Font(name="Segoe UI", size=10, bold=True, color="0F172A")

    # Fills
    fill_banner = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")      # Slate 900
    fill_sub_banner = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate 800
    fill_header = PatternFill(start_color="334155", end_color="334155", fill_type="solid")      # Slate 700
    fill_zebra_even = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")  # Light gray-white
    fill_zebra_odd = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")   # Pure white
    fill_total = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    # Status pill styles
    status_styles = {
        "ONLINE": {
            "fill": PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, bold=True, color="166534")
        },
        "WARNING": {
            "fill": PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, bold=True, color="92400E")
        },
        "OFFLINE": {
            "fill": PatternFill(start_color="FFE4E6", end_color="FFE4E6", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, bold=True, color="9F1239")
        },
        "NO CAM": {
            "fill": PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, italic=True, color="64748B")
        },
        "NO_CAM": {
            "fill": PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, italic=True, color="64748B")
        },
        "UNKNOWN": {
            "fill": PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid"),
            "font": Font(name="Segoe UI", size=9, italic=True, color="64748B")
        }
    }

    # Borders
    thin_border = Side(border_style="thin", color="E2E8F0")
    cell_border = Border(left=thin_border, right=thin_border, top=thin_border, bottom=thin_border)
    total_border = Border(
        top=Side(border_style="thin", color="94A3B8"),
        bottom=Side(border_style="double", color="334155"),
        left=thin_border,
        right=thin_border
    )

    # Alignments
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    align_banner = Alignment(horizontal="left", vertical="center", indent=1)

    # -------------------------------------------------------------------------
    # TAB 1: CAMERA INVENTORY
    # -------------------------------------------------------------------------
    ws_cams = wb.active
    ws_cams.title = "Camera Inventory"
    ws_cams.views.sheetView[0].showGridLines = True

    total_cams = len(cameras)
    active_cams = [c for c in cameras if not c.get("is_no_cam")]
    no_cam_cams = [c for c in cameras if c.get("is_no_cam")]
    online_count = sum(1 for c in active_cams if c.get("status") == "ONLINE")
    warning_count = sum(1 for c in active_cams if c.get("status") == "WARNING")
    offline_count = sum(1 for c in active_cams if c.get("status") == "OFFLINE")

    # Title Banner (Row 1)
    ws_cams.row_dimensions[1].height = 36
    ws_cams.merge_cells("A1:M1")
    title_cell = ws_cams["A1"]
    title_cell.value = "CCTV FLEET INVENTORY & REAL-TIME HEALTH REPORT"
    title_cell.font = font_title
    title_cell.fill = fill_banner
    title_cell.alignment = align_banner

    # Subtitle / Metadata Banner (Row 2)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ws_cams.row_dimensions[2].height = 22
    ws_cams.merge_cells("A2:M2")
    sub_cell = ws_cams["A2"]
    sub_cell.value = (
        f"Generated: {now_str}  |  Total Channels: {total_cams}  |  "
        f"Active Monitored: {len(active_cams)} (Online: {online_count}, Warning: {warning_count}, Offline: {offline_count})  |  "
        f"Spare Ports (No Cam): {len(no_cam_cams)}"
    )
    sub_cell.font = font_subtitle
    sub_cell.fill = fill_sub_banner
    sub_cell.alignment = align_banner

    # Blank Row 3
    ws_cams.row_dimensions[3].height = 8

    # Table Column Headers (Row 4)
    ws_cams.row_dimensions[4].height = 28
    headers = [
        ("ID", align_center),
        ("Camera Name (System)", align_left),
        ("Custom Alias", align_left),
        ("DVR / NVR Recorder", align_left),
        ("Ch #", align_center),
        ("Physical Location", align_left),
        ("Host IP", align_center),
        ("Port", align_center),
        ("Health Status", align_center),
        ("Classification", align_center),
        ("Latency (ms)", align_right),
        ("Status Details", align_left),
        ("Masked Stream URL", align_left),
    ]

    for col_idx, (header_text, alignment) in enumerate(headers, start=1):
        cell = ws_cams.cell(row=4, column=col_idx, value=header_text)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = alignment
        cell.border = cell_border

    # Data Rows
    for row_num, cam in enumerate(cameras, start=5):
        ws_cams.row_dimensions[row_num].height = 20
        is_even = (row_num % 2 == 0)
        row_fill = fill_zebra_even if is_even else fill_zebra_odd
        is_nocam = bool(cam.get("is_no_cam"))

        # Determine status display
        status = "NO CAM" if is_nocam else (cam.get("status") or "UNKNOWN")
        classification = "Spare / No Cam" if is_nocam else "Active Monitored"

        latency = cam.get("latency_ms")
        latency_val = f"{latency:.1f}" if latency is not None and not is_nocam and cam.get("status") == "ONLINE" else "-"
        status_detail = "Spare port (unassigned)" if is_nocam else ("Healthy" if cam.get("status") == "ONLINE" else (cam.get("last_error") or "Unreachable"))

        row_values = [
            (cam.get("id"), font_data_mono, align_center),
            (cam.get("name", "Unnamed"), font_data_bold if not is_nocam else font_data, align_left),
            (cam.get("alias") or "-", font_data, align_left),
            (cam.get("dvr_nvr_name", "N/A"), font_data, align_left),
            (cam.get("channel_no", "-"), font_data_mono, align_center),
            (cam.get("location", "N/A"), font_data, align_left),
            (cam.get("ip_address", ""), font_data_mono, align_center),
            (cam.get("port", 554), font_data_mono, align_center),
            (status, None, align_center),  # Handled with custom pill style
            (classification, font_data, align_center),
            (latency_val, font_data_mono, align_right),
            (status_detail, font_data, align_left),
            (cam.get("masked_url") or cam.get("rtsp_url", ""), font_data_mono, align_left),
        ]

        for col_idx, (val, cell_font, alignment) in enumerate(row_values, start=1):
            cell = ws_cams.cell(row=row_num, column=col_idx, value=val)
            cell.alignment = alignment
            cell.border = cell_border

            # Custom styling for status column (col 8)
            if col_idx == 8:
                st_style = status_styles.get(status, status_styles["UNKNOWN"])
                cell.fill = st_style["fill"]
                cell.font = st_style["font"]
            else:
                cell.fill = row_fill
                cell.font = cell_font

    # Freeze header panes on row 5 and enable autofilter
    last_row_cams = 4 + len(cameras)
    ws_cams.freeze_panes = "A5"
    if len(cameras) > 0:
        ws_cams.auto_filter.ref = f"A4:L{last_row_cams}"

    # Auto-adjust column widths
    for col in ws_cams.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            # Skip title row 1 & 2 for width calculation
            if cell.row in (1, 2, 3):
                continue
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws_cams.column_dimensions[col_letter].width = max(max_len + 3, 10)

    # -------------------------------------------------------------------------
    # TAB 2: NVR & RECORDER SUMMARY
    # -------------------------------------------------------------------------
    ws_nvrs = wb.create_sheet(title="NVR Summary")
    ws_nvrs.views.sheetView[0].showGridLines = True

    # Title Banner (Row 1)
    ws_nvrs.row_dimensions[1].height = 36
    ws_nvrs.merge_cells("A1:J1")
    title_nvr = ws_nvrs["A1"]
    title_nvr.value = "CCTV RECORDER CAPACITY & PORT UTILIZATION"
    title_nvr.font = font_title
    title_nvr.fill = fill_banner
    title_nvr.alignment = align_banner

    # Subtitle Banner (Row 2)
    ws_nvrs.row_dimensions[2].height = 22
    ws_nvrs.merge_cells("A2:J2")
    sub_nvr = ws_nvrs["A2"]
    sub_nvr.value = f"Generated: {now_str}  |  Overview of all Dahua, CP Plus & Uniview Recorders"
    sub_nvr.font = font_subtitle
    sub_nvr.fill = fill_sub_banner
    sub_nvr.alignment = align_banner

    # Blank Row 3
    ws_nvrs.row_dimensions[3].height = 8

    # Headers (Row 4)
    ws_nvrs.row_dimensions[4].height = 28
    nvr_headers = [
        ("Recorder / NVR Name", align_left),
        ("IP Address", align_center),
        ("Port", align_center),
        ("Total Capacity", align_center),
        ("Active Cams", align_center),
        ("Spare / No Cam", align_center),
        ("Online Cams", align_center),
        ("Offline Cams", align_center),
        ("Utilization %", align_right),
        ("Health Rate %", align_right),
    ]

    for col_idx, (text, alignment) in enumerate(nvr_headers, start=1):
        cell = ws_nvrs.cell(row=4, column=col_idx, value=text)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = alignment
        cell.border = cell_border

    # Build NVR grouped map
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for c in cameras:
        rec_name = c.get("dvr_nvr_name") or "Direct IP / Unassigned"
        if rec_name not in groups:
            groups[rec_name] = []
        groups[rec_name].append(c)

    nvr_dict = {n.get("name", ""): n for n in (nvrs or [])}

    nvr_names = sorted(groups.keys())
    row_start_nvr = 5

    tot_capacity = 0
    tot_active = 0
    tot_spare = 0
    tot_online = 0
    tot_offline = 0

    for idx, rec_name in enumerate(nvr_names):
        curr_row = row_start_nvr + idx
        ws_nvrs.row_dimensions[curr_row].height = 20
        is_even = (curr_row % 2 == 0)
        row_fill = fill_zebra_even if is_even else fill_zebra_odd

        rec_cams = groups[rec_name]
        meta = nvr_dict.get(rec_name, {})

        rec_ip = meta.get("ip_address") or (rec_cams[0].get("ip_address") if rec_cams else "")
        rec_port = meta.get("port") or (rec_cams[0].get("port") if rec_cams else 554)
        capacity = meta.get("total_channels") or len(rec_cams)
        active_cnt = sum(1 for c in rec_cams if not c.get("is_no_cam"))
        spare_cnt = sum(1 for c in rec_cams if c.get("is_no_cam"))
        online_cnt = sum(1 for c in rec_cams if not c.get("is_no_cam") and c.get("status") == "ONLINE")
        offline_cnt = sum(1 for c in rec_cams if not c.get("is_no_cam") and c.get("status") == "OFFLINE")

        tot_capacity += capacity
        tot_active += active_cnt
        tot_spare += spare_cnt
        tot_online += online_cnt
        tot_offline += offline_cnt

        util_pct = f"{int(round((active_cnt / capacity) * 100))}%" if capacity > 0 else "100%"
        health_pct = f"{int(round((online_cnt / active_cnt) * 100))}%" if active_cnt > 0 else "N/A"

        row_vals = [
            (rec_name, font_data_bold, align_left),
            (rec_ip, font_data_mono, align_center),
            (rec_port, font_data_mono, align_center),
            (capacity, font_data_bold, align_center),
            (active_cnt, font_data, align_center),
            (spare_cnt, font_data, align_center),
            (online_cnt, font_data, align_center),
            (offline_cnt, font_data, align_center),
            (util_pct, font_data_mono, align_right),
            (health_pct, font_data_mono, align_right),
        ]

        for col_idx, (val, cell_font, alignment) in enumerate(row_vals, start=1):
            cell = ws_nvrs.cell(row=curr_row, column=col_idx, value=val)
            cell.font = cell_font
            cell.alignment = alignment
            cell.fill = row_fill
            cell.border = cell_border

    # Total Row on Sheet 2
    total_row_idx = row_start_nvr + len(nvr_names)
    ws_nvrs.row_dimensions[total_row_idx].height = 24

    total_util_pct = f"{int(round((tot_active / tot_capacity) * 100))}%" if tot_capacity > 0 else "100%"
    total_health_pct = f"{int(round((tot_online / tot_active) * 100))}%" if tot_active > 0 else "N/A"

    total_row_vals = [
        ("TOTAL / FLEET-WIDE", font_total, align_left),
        ("-", font_total, align_center),
        ("-", font_total, align_center),
        (tot_capacity, font_total, align_center),
        (tot_active, font_total, align_center),
        (tot_spare, font_total, align_center),
        (tot_online, font_total, align_center),
        (tot_offline, font_total, align_center),
        (total_util_pct, font_total, align_right),
        (total_health_pct, font_total, align_right),
    ]

    for col_idx, (val, cell_font, alignment) in enumerate(total_row_vals, start=1):
        cell = ws_nvrs.cell(row=total_row_idx, column=col_idx, value=val)
        cell.font = cell_font
        cell.alignment = alignment
        cell.fill = fill_total
        cell.border = total_border

    # Freeze panes & widths on Sheet 2
    ws_nvrs.freeze_panes = "A5"
    if len(nvr_names) > 0:
        ws_nvrs.auto_filter.ref = f"A4:J{total_row_idx - 1}"

    for col in ws_nvrs.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row in (1, 2, 3):
                continue
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws_nvrs.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # Save to BytesIO buffer
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
