import asyncio
import time
import os
from contextlib import asynccontextmanager
from typing import Tuple, Optional, Dict
import cv2
import numpy as np

class HostThrottler:
    """
    Limits concurrent socket / RTSP requests to the same physical host IP
    to prevent overwhelming NVRs and DVRs.
    """
    def __init__(self, max_per_host: int = 2):
        self.max_per_host = max_per_host
        self._semaphores: Dict[str, asyncio.Semaphore] = {}
        self._active: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def _get_semaphore(self, host: str) -> asyncio.Semaphore:
        async with self._lock:
            if host not in self._semaphores:
                self._semaphores[host] = asyncio.Semaphore(self.max_per_host)
                self._active[host] = 0
            return self._semaphores[host]

    @asynccontextmanager
    async def acquire(self, host: str):
        sem = await self._get_semaphore(host)
        await sem.acquire()
        async with self._lock:
            self._active[host] = self._active.get(host, 0) + 1
        try:
            yield
        finally:
            async with self._lock:
                self._active[host] = max(0, self._active.get(host, 1) - 1)
            sem.release()

    def get_active(self, host: str) -> int:
        return self._active.get(host, 0)


async def check_tcp_liveness(host: str, port: int = 554, timeout_ms: int = 3000) -> Tuple[bool, float, Optional[str]]:
    """
    Fast asynchronous TCP socket probe.
    Returns: (is_online, latency_ms, error_message)
    """
    start_time = time.perf_counter()
    timeout_sec = timeout_ms / 1000.0
    try:
        connect_coro = asyncio.open_connection(host, port)
        reader, writer = await asyncio.wait_for(connect_coro, timeout=timeout_sec)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True, elapsed_ms, None
    except asyncio.TimeoutError:
        return False, 0.0, f"Connection timed out after {timeout_ms}ms"
    except ConnectionRefusedError:
        return False, 0.0, f"Connection refused on port {port}"
    except OSError as e:
        return False, 0.0, f"Network unreachable ({e.strerror or str(e)})"
    except Exception as e:
        return False, 0.0, f"Error: {str(e)}"


def _sync_capture_frame(rtsp_url: str, output_path: str, timeout_sec: int = 4) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Captures a single frame from an RTSP stream, saves a thumbnail,
    and returns (success, error_msg, mean_pixel_intensity).
    """
    # Force ffmpeg backend with timeout in milliseconds if supported by OpenCV
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;tcp|stimeout;{timeout_sec * 1000000}"
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        return False, "Failed to open RTSP stream", None

    try:
        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            return False, "Failed to read video frame from stream", None

        # Compute mean brightness to detect black/blank feeds
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_intensity = float(np.mean(gray))

        # Save thumbnail (resized to width 320 for light storage)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        h, w = frame.shape[:2]
        aspect = h / w
        thumb_w = 320
        thumb_h = int(thumb_w * aspect)
        thumbnail = cv2.resize(frame, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        cv2.imwrite(output_path, thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 75])

        return True, None, mean_intensity
    except Exception as e:
        return False, f"Frame decode error: {str(e)}", None
    finally:
        cap.release()


async def grab_rtsp_snapshot(rtsp_url: str, output_path: str, timeout_sec: int = 4) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Async wrapper for grabbing an RTSP frame in a worker thread.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_capture_frame, rtsp_url, output_path, timeout_sec),
            timeout=timeout_sec + 2
        )
    except asyncio.TimeoutError:
        return False, f"RTSP frame grab timed out after {timeout_sec}s", None
    except Exception as e:
        return False, f"Worker error: {str(e)}", None
