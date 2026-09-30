import type { Camera, NvrInfo, IncidentResponse, FleetUptimeHistoryResponse, UptimePeriod } from './types';

const API_BASE = '/api';

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options: RequestInit = {
    ...init,
    credentials: 'include',
  };
  const res = await fetch(input, options);
  if (res.status === 401) {
    // Only dispatch if not checking auth status
    const urlStr = typeof input === 'string' ? input : input.toString();
    if (!urlStr.includes('/auth/me') && !urlStr.includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('cctv:unauthorized'));
    }
  }
  return res;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) message = parsed.detail;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// --- Auth Endpoints ---

export async function fetchAuthMe(): Promise<{ authenticated: boolean; username?: string; last_login?: string }> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  return handleResponse(res);
}

export async function loginAdmin(username: string, password: string): Promise<{ authenticated: boolean; username: string }> {
  const res = await authFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function logoutAdmin(): Promise<{ authenticated: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function updateAdminCredentials(currentPassword: string, newUsername: string, newPassword: string): Promise<{ success: boolean; username: string }> {
  const res = await authFetch(`${API_BASE}/auth/credentials`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
      new_username: newUsername,
      new_password: newPassword,
    }),
  });
  return handleResponse(res);
}

export async function fetchAuditLogs(limit = 50, offset = 0): Promise<Array<{ id: number; timestamp: string; event_type: string; description: string; ip_address?: string }>> {
  const res = await authFetch(`${API_BASE}/admin/audit-logs?limit=${limit}&offset=${offset}`);
  return handleResponse(res);
}

export async function fetchDiagnostics(): Promise<{
  uptime_seconds: number;
  db_size_bytes: number;
  db_path: string;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  active_incidents: number;
  timestamp: string;
}> {
  const res = await authFetch(`${API_BASE}/admin/diagnostics`);
  return handleResponse(res);
}

// --- Camera & Fleet Endpoints ---

export async function fetchCameras(enabledOnly = false): Promise<Camera[]> {
  const res = await authFetch(`${API_BASE}/cameras?enabled_only=${enabledOnly}`);
  return handleResponse<Camera[]>(res);
}

export async function fetchCamera(id: number): Promise<Camera> {
  const res = await authFetch(`${API_BASE}/cameras/${id}`);
  return handleResponse<Camera>(res);
}

export async function fetchNvrs(): Promise<NvrInfo[]> {
  const res = await authFetch(`${API_BASE}/nvrs`);
  return handleResponse<NvrInfo[]>(res);
}

export async function fetchIncidents(limit = 100): Promise<IncidentResponse> {
  const res = await authFetch(`${API_BASE}/incidents?limit=${limit}`);
  return handleResponse<IncidentResponse>(res);
}

export async function acknowledgeIncident(incidentId: number): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/ack`, {
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function checkCamera(cameraId: number): Promise<{
  camera_id: number;
  status: 'ONLINE' | 'OFFLINE';
  message: string;
  consecutive_failures: number;
}> {
  const res = await authFetch(`${API_BASE}/cameras/${cameraId}/check`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function toggleCameraNoCam(cameraId: number): Promise<{
  camera_id: number;
  is_no_cam: boolean;
  status: string;
  message: string;
}> {
  const res = await authFetch(`${API_BASE}/cameras/${cameraId}/toggle-no-cam`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function captureCameraSnapshot(cameraId: number): Promise<{
  camera_id: number;
  camera_name: string;
  image_url: string;
  mean_intensity: number;
  captured_at: string;
}> {
  const res = await authFetch(`${API_BASE}/cameras/${cameraId}/snapshot`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function triggerFullFleetScan(): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/cameras/scan-all`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function triggerBatchSnapshotRefresh(): Promise<{ message: string; total_cameras: number }> {
  const res = await authFetch(`${API_BASE}/cameras/snapshots/refresh-all`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function getSnapshotRefreshStatus(): Promise<{
  is_running: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  message: string;
}> {
  const res = await authFetch(`${API_BASE}/cameras/snapshots/refresh-status`);
  return handleResponse(res);
}

export async function createCamera(payload: Partial<Camera>): Promise<{ id: number; message: string }> {
  const res = await authFetch(`${API_BASE}/cameras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateCamera(cameraId: number, payload: Partial<Camera>): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/cameras/${cameraId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteCamera(cameraId: number): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/cameras/${cameraId}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function renameNvr(oldName: string, newName: string): Promise<{
  message: string;
  cameras_updated: number;
}> {
  const res = await authFetch(`${API_BASE}/nvrs/${encodeURIComponent(oldName)}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: newName }),
  });
  return handleResponse(res);
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const res = await authFetch(`${API_BASE}/settings`);
  return handleResponse(res);
}

export async function updateSettings(settings: Record<string, string>): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return handleResponse(res);
}

export async function testSmtpSettings(): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/settings/test-email`, {
    method: 'POST',
  });
  return handleResponse(res);
}

export async function testReport(reportType: string): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/settings/test-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_type: reportType }),
  });
  return handleResponse(res);
}

export async function simulateOutage(cameraId: number, errorReason = 'Simulated Hardware Failure'): Promise<{
  message: string;
  incident_id: number;
}> {
  const res = await authFetch(`${API_BASE}/simulator/simulate-outage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ camera_id: cameraId, error_reason: errorReason }),
  });
  return handleResponse(res);
}

export async function fetchFleetUptimeHistory(
  period: UptimePeriod = '24h'
): Promise<FleetUptimeHistoryResponse> {
  const res = await authFetch(`${API_BASE}/fleet/uptime-history?period=${period}`);
  return handleResponse<FleetUptimeHistoryResponse>(res);
}
