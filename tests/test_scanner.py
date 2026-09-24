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
