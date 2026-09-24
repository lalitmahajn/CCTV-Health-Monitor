import pytest
import asyncio
from app.scanner import check_tcp_liveness, HostThrottler

@pytest.mark.asyncio
async def test_tcp_liveness_success_and_failure():
    # Start a dummy asyncio server on localhost
    server = await asyncio.start_server(lambda r, w: w.close(), '127.0.0.1', 0)
    port = server.sockets[0].getsockname()[1]
    
    # Test valid open port
    success, latency, err = await check_tcp_liveness('127.0.0.1', port, timeout_ms=1000)
    assert success is True
    assert latency >= 0.0
    assert err is None
    
    server.close()
    await server.wait_closed()
    
    # Test closed port
    fail_success, _, fail_err = await check_tcp_liveness('127.0.0.1', port, timeout_ms=500)
    assert fail_success is False
    assert fail_err is not None

@pytest.mark.asyncio
async def test_host_throttler_concurrency():
    throttler = HostThrottler(max_per_host=2)
    active_counts = []
    
    async def worker(host):
        async with throttler.acquire(host):
            active_counts.append(throttler.get_active(host))
            await asyncio.sleep(0.05)
            
    await asyncio.gather(*(worker("192.168.1.10") for _ in range(5)))
    assert max(active_counts) <= 2


@pytest.mark.asyncio
async def test_probe_rtsp_describe_and_scan():
    from app.scanner import probe_rtsp_describe, scan_nvr_channels

    async def handle_rtsp(reader, writer):
        data = await reader.read(1024)
        text = data.decode(errors="ignore")
        if "channel=1" in text:
            sdp = (
                "v=0\r\n"
                "m=video 0 RTP/AVP 96\r\n"
                "a=rtpmap:96 H264/90000\r\n"
                "a=framerate:15.0\r\n"
            )
            resp = f"RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: {len(sdp)}\r\n\r\n{sdp}"
        else:
            resp = "RTSP/1.0 404 Not Found\r\nCSeq: 1\r\n\r\n"
        writer.write(resp.encode())
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    server = await asyncio.start_server(handle_rtsp, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]

    # Test single channel 1 (Active)
    res1 = await probe_rtsp_describe("127.0.0.1", port, channel=1, timeout_sec=1.0)
    assert res1["status"] == "STREAMING"
    assert res1["status_code"] == 200
    assert res1["codec"] == "H264"
    assert res1["fps"] == 15.0

    # Test single channel 2 (Empty)
    res2 = await probe_rtsp_describe("127.0.0.1", port, channel=2, timeout_sec=1.0)
    assert res2["status"] == "EMPTY"
    assert res2["status_code"] == 404

    # Test scan_nvr_channels across 2 channels
    results = await scan_nvr_channels("127.0.0.1", port, "", "", total_channels=2, timeout_sec=1.0)
    assert len(results) == 2
    assert results[0]["status"] == "STREAMING"
    assert results[1]["status"] == "EMPTY"

    server.close()
    await server.wait_closed()

