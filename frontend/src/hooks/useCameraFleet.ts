import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Camera, NvrInfo, Incident, FleetSummary, SSEEventData } from '../lib/types';
import * as api from '../lib/api';
import { useSSELiveStream } from './useSSELiveStream';
import { soundManager } from '../lib/audio';

export type ActiveTab = 'dashboard' | 'matrix' | 'incidents' | 'inventory' | 'admin';

export function useCameraFleet() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [nvrs, setNvrs] = useState<NvrInfo[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [incidentHistory, setIncidentHistory] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedNvrFilter, setSelectedNvrFilter] = useState<string>('ALL');

  // Drawer state
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  // Sound preference state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundManager.isEnabled());

  // Dark mode state - default to dark slate
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('cctv_theme');
    if (saved !== null) return saved === 'dark';
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleSound = useCallback(() => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('cctv_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  // Fetch all core fleet data
  const loadFleetData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [camsData, nvrsData, incData] = await Promise.all([
        api.fetchCameras(),
        api.fetchNvrs(),
        api.fetchIncidents(),
      ]);
      setCameras(camsData);
      setNvrs(nvrsData);
      setActiveIncidents(incData.active);
      setIncidentHistory(incData.history);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch camera fleet data';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh single camera in local state
  const updateCameraInState = useCallback((updatedCam: Partial<Camera> & { id: number }) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === updatedCam.id ? { ...c, ...updatedCam } : c))
    );
    setSelectedCamera((prev) => {
      if (prev && prev.id === updatedCam.id) {
        return { ...prev, ...updatedCam };
      }
      return prev;
    });
  }, []);

  // Handle incoming real-time SSE stream events
  const handleSSEEvent = useCallback(
    (event: SSEEventData) => {
      if (event.type === 'CAMERA_DOWN') {
        if (event.camera) {
          updateCameraInState({
            id: event.camera.id,
            status: 'OFFLINE',
            consecutive_failures: event.camera.consecutive_failures ?? 3,
            last_error: event.incident?.error_reason ?? 'Connection Lost',
          });
        }
        if (event.incident) {
          setActiveIncidents((prev) => {
            const exists = prev.some((inc) => inc.id === event.incident!.id);
            if (!exists) {
              return [event.incident!, ...prev];
            }
            return prev;
          });
        }
      } else if (event.type === 'CAMERA_RECOVERED') {
        if (event.camera) {
          updateCameraInState({
            id: event.camera.id,
            status: 'ONLINE',
            consecutive_failures: 0,
            last_error: null,
          });
        }
        if (event.incident) {
          setActiveIncidents((prev) => prev.filter((inc) => inc.id !== event.incident!.id));
          setIncidentHistory((prev) => [
            {
              ...event.incident!,
              status: 'RESOLVED',
              duration_seconds: event.duration_seconds,
            },
            ...prev,
          ]);
        }
      } else if (event.type === 'CAMERA_UPDATE') {
        if (event.camera) {
          updateCameraInState(event.camera);
        } else if (event.camera_id && event.status) {
          updateCameraInState({
            id: event.camera_id,
            status: event.status,
            consecutive_failures: event.consecutive_failures,
          });
        }
      } else if (event.type === 'NVR_DOWN') {
        if (event.nvr_name) {
          setNvrs((prev) =>
            prev.map((nvr) =>
              nvr.name.toLowerCase() === event.nvr_name!.toLowerCase()
                ? { ...nvr, status: 'OFFLINE', last_error: event.error || 'NVR connection unreachable' }
                : nvr
            )
          );
        }
      } else if (event.type === 'NVR_RECOVERED') {
        if (event.nvr_name) {
          setNvrs((prev) =>
            prev.map((nvr) =>
              nvr.name.toLowerCase() === event.nvr_name!.toLowerCase()
                ? { ...nvr, status: 'ONLINE', last_error: null }
                : nvr
            )
          );
        }
      }
    },
    [updateCameraInState]
  );

  const { status: sseStatus, lastHeartbeat } = useSSELiveStream({
    onEvent: handleSSEEvent,
    soundAlerts: soundEnabled,
  });

  // Calculate fleet summaries
  const summary: FleetSummary = useMemo(() => {
    let online = 0;
    let warning = 0;
    let offline = 0;
    let noCam = 0;

    for (const c of cameras) {
      if (c.is_no_cam) {
        noCam++;
      } else if (c.status === 'ONLINE') {
        online++;
      } else if (c.status === 'WARNING') {
        warning++;
      } else if (c.status === 'OFFLINE') {
        offline++;
      }
    }

    const totalActive = online + warning + offline;
    const operatingTotal = online + warning;
    const healthPercent = totalActive > 0 ? Math.round((operatingTotal / totalActive) * 100) : 100;

    // Calculate critical NVRs (where active cameras are offline)
    const nvrOfflineMap: Record<string, number> = {};
    for (const c of cameras) {
      if (!c.is_no_cam && c.status === 'OFFLINE' && c.dvr_nvr_name) {
        nvrOfflineMap[c.dvr_nvr_name] = (nvrOfflineMap[c.dvr_nvr_name] || 0) + 1;
      }
    }
    const criticalNvrCount = Object.values(nvrOfflineMap).filter((count) => count > 0).length;

    return {
      total: cameras.length,
      activeTotal: totalActive,
      online,
      warning,
      offline,
      noCam,
      healthPercent,
      activeIncidents: activeIncidents.length,
      criticalNvrCount,
    };
  }, [cameras, activeIncidents]);

  // Group cameras by NVR name
  const nvrGroups = useMemo(() => {
    const groups: Record<string, Camera[]> = {};
    for (const c of cameras) {
      const nvrName = c.dvr_nvr_name || 'Unassigned Bay';
      if (!groups[nvrName]) {
        groups[nvrName] = [];
      }
      groups[nvrName].push(c);
    }
    // Sort channels within each NVR
    for (const group of Object.values(groups)) {
      group.sort((a, b) => {
        const chA = parseInt(a.channel_no) || 0;
        const chB = parseInt(b.channel_no) || 0;
        return chA - chB;
      });
    }
    return groups;
  }, [cameras]);

  // Initial load
  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // User actions
  const ackIncident = async (incidentId: number) => {
    await api.acknowledgeIncident(incidentId);
    setActiveIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? { ...inc, is_acknowledged: 1, acknowledged_at: new Date().toISOString() }
          : inc
      )
    );
    soundManager.playSuccessChime();
  };

  const manualCheckCamera = async (cameraId: number) => {
    const result = await api.checkCamera(cameraId);
    updateCameraInState({
      id: cameraId,
      status: result.status,
      consecutive_failures: result.consecutive_failures,
    });
    return result;
  };

  const toggleSparePort = async (cameraId: number) => {
    const result = await api.toggleCameraNoCam(cameraId);
    updateCameraInState({
      id: cameraId,
      is_no_cam: result.is_no_cam,
      status: result.status as 'ONLINE' | 'OFFLINE' | 'NO_CAM',
    });
    // Refresh fleet to ensure incident counts sync
    loadFleetData();
    return result;
  };

  return {
    cameras,
    nvrs,
    nvrGroups,
    activeIncidents,
    incidentHistory,
    summary,
    isLoading,
    error,
    sseStatus,
    lastHeartbeat,
    activeTab,
    setActiveTab,
    selectedNvrFilter,
    setSelectedNvrFilter,
    selectedCamera,
    setSelectedCamera,
    soundEnabled,
    toggleSound,
    isDarkMode,
    toggleDarkMode,
    refreshFleet: loadFleetData,
    ackIncident,
    manualCheckCamera,
    toggleSparePort,
  };
}
