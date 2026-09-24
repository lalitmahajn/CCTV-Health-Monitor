import pytest
from app.csv_utils import parse_and_validate_csv, generate_csv_template, export_cameras_to_csv

def test_csv_template_and_parsing():
    template = generate_csv_template()
    assert "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled" in template
    
    sample_csv = (
        "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled\n"
        "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://192.168.1.10:554/ch1,true\n"
        "Cam 2,NVR-A,Lobby,192.168.1.10,554,2,,true\n"  # missing rtsp_url
    )
    valid_rows, errors = parse_and_validate_csv(sample_csv)
    assert len(valid_rows) == 1
    assert len(errors) == 1
    assert "Row 3: 'rtsp_url' is required" in errors[0]
    assert valid_rows[0]["name"] == "Cam 1"
    assert valid_rows[0]["dvr_nvr_name"] == "NVR-A"
    assert valid_rows[0]["port"] == 554

def test_export_cameras_to_csv():
    cameras = [{
        "name": "Cam 1", "dvr_nvr_name": "NVR-A", "location": "Gate",
        "ip_address": "192.168.1.10", "port": 554, "channel_no": "1",
        "rtsp_url": "rtsp://192.168.1.10:554/ch1", "is_enabled": 1
    }]
    output = export_cameras_to_csv(cameras)
    assert "Cam 1" in output
    assert "NVR-A" in output
    assert "rtsp://192.168.1.10:554/ch1" in output
