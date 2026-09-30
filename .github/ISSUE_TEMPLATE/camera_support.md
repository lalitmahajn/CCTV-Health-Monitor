---
name: 📹 Camera / NVR Model Compatibility
about: Report compatibility or request support for a specific DVR, NVR, or IP camera brand
title: "[DEVICE] "
labels: ["device-compatibility"]
assignees: ""
---

### Device Information
- **Manufacturer / Brand**: [e.g. Dahua, CP Plus, Hikvision, Uniview, Axis, Hanwha]
- **Model Number**: [e.g. DHI-NVR5216-4KS2]
- **Firmware Version**: [e.g. V4.001.0000001.0]

### Verified RTSP Stream URLs
Please provide the stream paths tested with this device:
- **Main Stream RTSP**: `rtsp://<user>:<pass>@<ip>:<port>/...`
- **Sub Stream RTSP**: `rtsp://<user>:<pass>@<ip>:<port>/...`

### Compatibility Status
- [ ] Ping / TCP liveness probe works
- [ ] Main stream snapshot works
- [ ] Sub stream (`subtype=1` or vendor equivalent) works
- [ ] Video codec tested: H.264 / H.265 / MJPEG

### Observations & Quirks
Describe any special authentication quirks (Digest vs Basic), port mappings, or stream delays encountered with this model.
