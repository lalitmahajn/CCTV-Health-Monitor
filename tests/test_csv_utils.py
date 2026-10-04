import pytest
from app.csv_utils import parse_and_validate_csv, generate_csv_template, export_cameras_to_csv

def test_csv_template_and_parsing():
    template = generate_csv_template()
    assert "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled,is_spare" in template
    
    sample_csv = (
        "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled,is_spare\n"
        "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://192.168.1.10:554/ch1,true,false\n"
        "Spare 2,NVR-A,Spare,192.168.1.10,554,2,rtsp://192.168.1.10:554/ch2,true,true\n"
        "Cam 3,NVR-A,Lobby,192.168.1.10,554,3,,true,false\n"  # missing rtsp_url
    )
    valid_rows, errors = parse_and_validate_csv(sample_csv)
    assert len(valid_rows) == 2
    assert len(errors) == 1
    assert "Row 4: 'rtsp_url' is required" in errors[0]
    assert valid_rows[0]["name"] == "Cam 1"
    assert valid_rows[0]["is_no_cam"] is False
    assert valid_rows[1]["name"] == "Spare 2"
    assert valid_rows[1]["is_no_cam"] is True

def test_csv_backward_compatibility_without_spare_column():
    legacy_csv = (
        "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled\n"
        "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://192.168.1.10:554/ch1,true\n"
    )
    valid_rows, errors = parse_and_validate_csv(legacy_csv)
    assert len(valid_rows) == 1
    assert len(errors) == 0
    assert valid_rows[0]["is_no_cam"] is False

def test_export_cameras_to_csv():
    cameras = [
        {
            "name": "Cam 1", "dvr_nvr_name": "NVR-A", "location": "Gate",
            "ip_address": "192.168.1.10", "port": 554, "channel_no": "1",
            "rtsp_url": "rtsp://admin:pass@192.168.1.10:554/ch1", "is_enabled": 1,
            "is_no_cam": 0
        },
        {
            "name": "Ch 16 Spare", "dvr_nvr_name": "NVR-A", "location": "Rack",
            "ip_address": "192.168.1.10", "port": 554, "channel_no": "16",
            "rtsp_url": "rtsp://admin:pass@192.168.1.10:554/ch16", "is_enabled": 1,
            "is_no_cam": 1
        }
    ]
    output = export_cameras_to_csv(cameras)
    assert "is_spare" in output
    assert "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://admin:pass@192.168.1.10:554/ch1,true,false" in output
    assert "Ch 16 Spare,NVR-A,Rack,192.168.1.10,554,16,rtsp://admin:pass@192.168.1.10:554/ch16,true,true" in output

