import pytest
from app.csv_utils import (
    parse_and_validate_csv,
    generate_csv_template,
    export_cameras_to_csv,
    mask_rtsp_password,
    inject_rtsp_credentials
)

def test_csv_template_and_parsing():
    template = generate_csv_template()
    assert "name,alias,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled,is_spare" in template
    assert "rtsp://admin:*****@" in template
    
    sample_csv = (
        "name,alias,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled,is_spare\n"
        "Cam 1,Main Entry Gate,NVR-A,Gate,192.168.1.10,554,1,rtsp://admin:*****@192.168.1.10:554/ch1,true,false\n"
        "Spare 2,,NVR-A,Spare,192.168.1.10,554,2,rtsp://operator:*****@192.168.1.10:554/ch2,true,true\n"
        "Cam 3,Lobby Cam,NVR-A,Lobby,192.168.1.10,554,3,,true,false\n"  # missing rtsp_url
    )
    # When password is provided, masked passwords are replaced
    valid_rows, errors = parse_and_validate_csv(sample_csv, default_password="secret_password")
    assert len(valid_rows) == 2
    assert len(errors) == 1
    assert "Row 4: 'rtsp_url' is required" in errors[0]
    assert valid_rows[0]["name"] == "Cam 1"
    assert valid_rows[0]["alias"] == "Main Entry Gate"
    assert valid_rows[0]["is_no_cam"] is False
    assert valid_rows[0]["rtsp_url"] == "rtsp://admin:secret_password@192.168.1.10:554/ch1"
    assert valid_rows[1]["name"] == "Spare 2"
    assert valid_rows[1]["alias"] is None
    assert valid_rows[1]["is_no_cam"] is True
    assert valid_rows[1]["rtsp_url"] == "rtsp://operator:secret_password@192.168.1.10:554/ch2"

def test_parsing_fails_when_masked_password_has_no_replacement():
    sample_csv = (
        "name,dvr_nvr_name,location,ip_address,port,channel_no,rtsp_url,is_enabled,is_spare\n"
        "Cam 1,NVR-A,Gate,192.168.1.10,554,1,rtsp://admin:*****@192.168.1.10:554/ch1,true,false\n"
    )
    valid_rows, errors = parse_and_validate_csv(sample_csv)
    assert len(valid_rows) == 0
    assert len(errors) == 1
    assert "RTSP password contains '*****'" in errors[0]

def test_inject_rtsp_credentials():
    # Masked password replaced
    url1 = "rtsp://admin:*****@192.168.1.10:554/cam/realmonitor?channel=1"
    res1 = inject_rtsp_credentials(url1, default_password="my_password")
    assert res1 == "rtsp://admin:my_password@192.168.1.10:554/cam/realmonitor?channel=1"

    # URL without credentials gets username and password injected
    url2 = "rtsp://192.168.1.10:554/live"
    res2 = inject_rtsp_credentials(url2, default_username="arechs", default_password="mypassword")
    assert res2 == "rtsp://arechs:mypassword@192.168.1.10:554/live"

    # URL with existing real password is preserved unless override_all=True
    url3 = "rtsp://custom_user:real_pass@192.168.1.10:554/live"
    res3 = inject_rtsp_credentials(url3, default_password="new_pass", override_all=False)
    assert res3 == "rtsp://custom_user:real_pass@192.168.1.10:554/live"

    res3_override = inject_rtsp_credentials(url3, default_password="new_pass", override_all=True)
    assert res3_override == "rtsp://custom_user:new_pass@192.168.1.10:554/live"

def test_export_cameras_to_csv_masks_passwords():
    cameras = [
        {
            "name": "Cam 1", "dvr_nvr_name": "NVR-A", "location": "Gate",
            "ip_address": "192.168.1.10", "port": 554, "channel_no": "1",
            "rtsp_url": "rtsp://admin:plaintext_secret@192.168.1.10:554/ch1", "is_enabled": 1,
            "is_no_cam": 0
        },
        {
            "name": "Ch 16 Spare", "dvr_nvr_name": "NVR-A", "location": "Rack",
            "ip_address": "192.168.1.10", "port": 554, "channel_no": "16",
            "rtsp_url": "rtsp://operator:plaintext_secret@192.168.1.10:554/ch16", "is_enabled": 1,
            "is_no_cam": 1
        }
    ]
    output = export_cameras_to_csv(cameras)
    assert "is_spare" in output
    # Plaintext secret MUST NOT appear in CSV
    assert "plaintext_secret" not in output
    # Masked URLs appear in output
    assert "rtsp://admin:*****@192.168.1.10:554/ch1,true,false" in output
    assert "rtsp://operator:*****@192.168.1.10:554/ch16,true,true" in output


