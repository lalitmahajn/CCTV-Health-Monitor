import asyncio
import time
import os
import re
import hashlib
from contextlib import asynccontextmanager
from typing import Tuple, Optional, Dict, Any, List
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


def _sync_capture_frame(rtsp_url: str, output_path: str, timeout_sec: int = 5, max_width: int = 720) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Captures a single frame from an RTSP stream, saves a snapshot,
    and returns (success, error_msg, mean_pixel_intensity).
    Uses substream (subtype=1) for rapid keyframe capture and light bandwidth,
    with automatic main stream fallback.
    """
    from app.security import decrypt_val
    if rtsp_url and str(rtsp_url).startswith("enc:"):
        rtsp_url = decrypt_val(rtsp_url) or rtsp_url

    # For snapshots, use substream (subtype=1) for rapid keyframe capture and light bandwidth
    target_url = rtsp_url.replace("subtype=0", "subtype=1") if "subtype=0" in rtsp_url else rtsp_url

    timeout_us = int(timeout_sec * 1000000)
    timeout_ms = int(timeout_sec * 1000)
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;tcp|timeout;{timeout_us}|stimeout;{timeout_us}"

    cap_params = []
    if hasattr(cv2, "CAP_PROP_OPEN_TIMEOUT_MSEC"):
        cap_params.extend([cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms])
    if hasattr(cv2, "CAP_PROP_READ_TIMEOUT_MSEC"):
        cap_params.extend([cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout_ms])

    cap = None
    try:
        if cap_params:
            cap = cv2.VideoCapture(target_url, cv2.CAP_FFMPEG, cap_params)
        else:
            cap = cv2.VideoCapture(target_url, cv2.CAP_FFMPEG)

        if not cap.isOpened() and target_url != rtsp_url:
            if cap is not None:
                cap.release()
            if cap_params:
                cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG, cap_params)
            else:
                cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)

        if not cap.isOpened():
            return False, "Failed to open RTSP stream", None

        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            return False, "Failed to read video frame from stream", None

        # Compute mean brightness to detect black/blank feeds
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_intensity = float(np.mean(gray))

        # Save snapshot with anamorphic aspect ratio correction
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        h, w = frame.shape[:2]

        if w < h:
            frame = cv2.resize(frame, (w * 2, h), interpolation=cv2.INTER_CUBIC)
            h, w = frame.shape[:2]
        elif 1.15 <= (w / h) <= 1.35 and h in (480, 576):
            display_w = int(round(h * 4.0 / 3.0))
            frame = cv2.resize(frame, (display_w, h), interpolation=cv2.INTER_CUBIC)
            h, w = frame.shape[:2]

        if w > max_width:
            aspect = h / w
            thumb_w = max_width
            thumb_h = int(thumb_w * aspect)
            frame_to_save = cv2.resize(frame, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
        else:
            frame_to_save = frame

        cv2.imwrite(output_path, frame_to_save, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return True, None, mean_intensity
    except Exception as e:
        return False, f"Frame decode error: {str(e)}", None
    finally:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass


async def grab_rtsp_snapshot(rtsp_url: str, output_path: str, timeout_sec: int = 12, max_width: int = 720) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Async wrapper for grabbing an RTSP frame in a worker thread.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_capture_frame, rtsp_url, output_path, timeout_sec, max_width),
            timeout=timeout_sec + 4
        )
    except asyncio.TimeoutError:
        return False, f"RTSP frame grab timed out after {timeout_sec}s", None
    except Exception as e:
        return False, f"Worker error: {str(e)}", None


async def probe_rtsp_url(rtsp_url: str, timeout_sec: float = 2.0) -> Dict[str, Any]:
    """
    Fast async RTSP DESCRIBE pre-check directly on a URL.
    Returns status: STREAMING, EMPTY, AUTH_FAILED, TIMEOUT, or INACTIVE.
    """
    from urllib.parse import urlsplit
    from app.security import decrypt_val
    if rtsp_url and str(rtsp_url).startswith("enc:"):
        rtsp_url = decrypt_val(rtsp_url) or rtsp_url

    t0 = time.perf_counter()
    try:
        p = urlsplit(rtsp_url)
        host = p.hostname or "127.0.0.1"
        port = p.port or 554
        user = p.username or ""
        pwd = p.password or ""
        path = p.path + ("?" + p.query if p.query else "")
        clean_url = f"rtsp://{host}:{port}{path}"

        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout_sec
        )

        req1 = (
            f"DESCRIBE {clean_url} RTSP/1.0\r\n"
            f"CSeq: 1\r\n"
            f"User-Agent: CCTV-Health-Monitor\r\n"
            f"Accept: application/sdp\r\n\r\n"
        )
        writer.write(req1.encode())
        await writer.drain()

        data1 = await asyncio.wait_for(reader.read(4096), timeout=timeout_sec)
        resp1 = data1.decode("utf-8", errors="ignore")

        final_resp = resp1
        if "200 OK" not in resp1 and "WWW-Authenticate" in resp1:
            auth_match = re.search(r'WWW-Authenticate:\s*Digest\s+(.+)', resp1, re.IGNORECASE)
            if auth_match and user and pwd:
                params = dict(re.findall(r'(\w+)="([^"]+)"', auth_match.group(1)))
                realm = params.get("realm", "")
                nonce = params.get("nonce", "")

                ha1 = hashlib.md5(f"{user}:{realm}:{pwd}".encode()).hexdigest()
                ha2 = hashlib.md5(f"DESCRIBE:{clean_url}".encode()).hexdigest()
                response = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode()).hexdigest()

                auth_hdr = f'Digest username="{user}", realm="{realm}", nonce="{nonce}", uri="{clean_url}", response="{response}"'
                req2 = (
                    f"DESCRIBE {clean_url} RTSP/1.0\r\n"
                    f"CSeq: 2\r\n"
                    f"User-Agent: CCTV-Health-Monitor\r\n"
                    f"Authorization: {auth_hdr}\r\n"
                    f"Accept: application/sdp\r\n\r\n"
                )
                writer.write(req2.encode())
                await writer.drain()

                data2 = await asyncio.wait_for(reader.read(4096), timeout=timeout_sec)
                final_resp = data2.decode("utf-8", errors="ignore")

        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        if "200 OK" in final_resp:
            return {"status": "STREAMING", "status_code": 200, "latency_ms": elapsed_ms, "message": "Stream active"}
        elif "404 Not Found" in final_resp:
            return {"status": "EMPTY", "status_code": 404, "latency_ms": elapsed_ms, "message": "No stream / channel empty"}
        elif "401" in final_resp:
            return {"status": "AUTH_FAILED", "status_code": 401, "latency_ms": elapsed_ms, "message": "Auth required or invalid"}
        else:
            first_line = final_resp.split("\r\n")[0] if final_resp else "No response"
            return {"status": "INACTIVE", "status_code": 0, "latency_ms": elapsed_ms, "message": first_line}

    except asyncio.TimeoutError:
        return {"status": "TIMEOUT", "status_code": 0, "latency_ms": round((time.perf_counter() - t0) * 1000, 1), "message": f"Timed out after {timeout_sec}s"}
    except Exception as e:
        return {"status": "ERROR", "status_code": 0, "latency_ms": 0.0, "message": str(e)}


async def probe_rtsp_describe(
    host: str,
    port: int,
    channel: int,
    user: str = "",
    pwd: str = "",
    path_template: str = "/cam/realmonitor?channel={channel}&subtype=0",
    timeout_sec: float = 3.0
) -> Dict[str, Any]:
    """
    Sends an RTSP DESCRIBE request to verify whether a specific channel
    is actively generating a video stream, without decoding any frames.
    """
    t0 = time.perf_counter()
    clean_path = path_template.format(channel=channel)
    url = f"rtsp://{host}:{port}{clean_path}"

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout_sec
        )

        req1 = (
            f"DESCRIBE {url} RTSP/1.0\r\n"
            f"CSeq: 1\r\n"
            f"User-Agent: CCTV-Health-Monitor\r\n"
            f"Accept: application/sdp\r\n\r\n"
        )
        writer.write(req1.encode())
        await writer.drain()

        data1 = await asyncio.wait_for(reader.read(4096), timeout=timeout_sec)
        resp1 = data1.decode("utf-8", errors="ignore")

        final_resp = resp1
        if "200 OK" not in resp1 and "WWW-Authenticate" in resp1:
            auth_match = re.search(r'WWW-Authenticate:\s*Digest\s+(.+)', resp1, re.IGNORECASE)
            if auth_match and user and pwd:
                params = dict(re.findall(r'(\w+)="([^"]+)"', auth_match.group(1)))
                realm = params.get("realm", "")
                nonce = params.get("nonce", "")

                ha1 = hashlib.md5(f"{user}:{realm}:{pwd}".encode()).hexdigest()
                ha2 = hashlib.md5(f"DESCRIBE:{url}".encode()).hexdigest()
                response = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode()).hexdigest()

                auth_hdr = f'Digest username="{user}", realm="{realm}", nonce="{nonce}", uri="{url}", response="{response}"'
                req2 = (
                    f"DESCRIBE {url} RTSP/1.0\r\n"
                    f"CSeq: 2\r\n"
                    f"User-Agent: CCTV-Health-Monitor\r\n"
                    f"Authorization: {auth_hdr}\r\n"
                    f"Accept: application/sdp\r\n\r\n"
                )
                writer.write(req2.encode())
                await writer.drain()

                data2 = await asyncio.wait_for(reader.read(4096), timeout=timeout_sec)
                final_resp = data2.decode("utf-8", errors="ignore")

        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        if "200 OK" in final_resp:
            codec_match = re.search(r'a=rtpmap:\d+\s+([A-Za-z0-9\-]+)', final_resp)
            codec = codec_match.group(1) if codec_match else "H.264"
            fps_match = re.search(r'a=framerate:([0-9.]+)', final_resp)
            fps = float(fps_match.group(1)) if fps_match else None

            return {
                "channel": channel,
                "status": "STREAMING",
                "status_code": 200,
                "codec": codec,
                "fps": fps,
                "latency_ms": elapsed_ms,
                "message": "Stream active and verified"
            }
        elif "404 Not Found" in final_resp:
            return {
                "channel": channel,
                "status": "EMPTY",
                "status_code": 404,
                "latency_ms": elapsed_ms,
                "message": "No camera connected or port unused"
            }
        elif "401" in final_resp:
            return {
                "channel": channel,
                "status": "AUTH_FAILED",
                "status_code": 401,
                "latency_ms": elapsed_ms,
                "message": "Authentication required or invalid password"
            }
        else:
            first_line = final_resp.split("\r\n")[0] if final_resp else "No response"
            return {
                "channel": channel,
                "status": "INACTIVE",
                "status_code": 0,
                "latency_ms": elapsed_ms,
                "message": first_line
            }

    except asyncio.TimeoutError:
        return {
            "channel": channel,
            "status": "TIMEOUT",
            "status_code": 0,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
            "message": f"Connection timed out after {timeout_sec}s"
        }
    except Exception as e:
        return {
            "channel": channel,
            "status": "ERROR",
            "status_code": 0,
            "latency_ms": 0.0,
            "message": str(e)
        }


async def scan_nvr_channels(
    host: str,
    port: int,
    user: str,
    pwd: str,
    total_channels: int = 16,
    path_template: str = "/cam/realmonitor?channel={channel}&subtype=0",
    max_concurrent: int = 2,
    timeout_sec: float = 2.5
) -> List[Dict[str, Any]]:
    """
    Sweeps channels 1 to total_channels with bounded concurrency (default 2)
    to prevent overloading the NVR CPU.
    """
    sem = asyncio.Semaphore(max_concurrent)

    async def _probe_with_sem(ch: int):
        async with sem:
            return await probe_rtsp_describe(
                host=host,
                port=port,
                channel=ch,
                user=user,
                pwd=pwd,
                path_template=path_template,
                timeout_sec=timeout_sec
            )

    tasks = [_probe_with_sem(ch) for ch in range(1, total_channels + 1)]
    return await asyncio.gather(*tasks)

