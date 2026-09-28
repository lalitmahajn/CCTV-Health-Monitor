export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'NO_CAM';

export interface Camera {
  id: number;
  name: string;
  dvr_nvr_name: string;
  location?: string;
  ip_address: string;
  port: number;
  channel_no: string;
  rtsp_url: string;
  masked_url?: string;
  status: CameraStatus;
  is_enabled: boolean | number;
  is_no_cam: boolean | number;
  consecutive_failures?: number;
  latency_ms?: number;
  last_seen?: string | null;
  last_checked?: string | null;
  last_error?: string | null;
  thumbnail_path?: string | null;
}

export interface NvrInfo {
  name: string;
  ip_address: string;
  port: number;
  total_channels: number;
  online_count?: number;
  offline_count?: number;
  no_cam_count?: number;
}

export interface Incident {
  id: number;
  camera_id: number;
  camera_name: string;
  dvr_nvr_name?: string;
  channel_no?: string;
  ip_address?: string;
  started_at: string;
  resolved_at?: string | null;
  duration_seconds?: number | null;
  error_reason?: string;
  is_acknowledged: boolean | number;
  acknowledged_at?: string | null;
  status?: 'ACTIVE' | 'RESOLVED';
}

export interface IncidentResponse {
  active: Incident[];
  history: Incident[];
}

export interface FleetSummary {
  total: number;
  activeTotal: number;
  online: number;
  offline: number;
  noCam: number;
  healthPercent: number;
  activeIncidents: number;
  criticalNvrCount: number;
}

export interface SSEEventData {
  type: 'CONNECTED' | 'CAMERA_DOWN' | 'CAMERA_RECOVERED' | 'CAMERA_UPDATE';
  camera?: Camera;
  camera_id?: number;
  status?: CameraStatus;
  incident?: Incident;
  duration_seconds?: number;
  consecutive_failures?: number;
}

export type UptimePeriod = '1h' | '6h' | '24h' | '7d' | '30d' | '90d';

export interface UptimeDataPoint {
  timestamp: string;
  label: string;
  tooltipLabel?: string;
  operating: number;
  offline: number;
  total: number;
}

export interface FleetUptimeHistoryResponse {
  period: UptimePeriod;
  total_provisioned: number;
  summary: {
    current_operating: number;
    min_operating: number;
    max_operating: number;
    avg_operating: number;
    uptime_percentage: number;
  };
  data_points: UptimeDataPoint[];
}


