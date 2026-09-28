import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera as CameraIcon,
  MapPin,
  Server,
  Zap,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Sliders,
  SunMedium,
} from 'lucide-react';
import type { Camera } from '@/lib/types';
import * as api from '@/lib/api';

interface CameraDrawerProps {
  camera: Camera | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCamera?: (updated: Camera) => void;
  onManualCheck?: (cameraId: number) => Promise<any>;
  onToggleSpare?: (cameraId: number) => Promise<any>;
}

export const CameraDrawer: React.FC<CameraDrawerProps> = ({
  camera,
  isOpen,
  onClose,
  onUpdateCamera,
  onManualCheck,
  onToggleSpare,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: string; message: string; latency_ms?: number } | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotData, setSnapshotData] = useState<{ url: string; intensity?: number; captured_at?: string } | null>(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isTogglingSpare, setIsTogglingSpare] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!camera) return null;

  const isNoCam = Boolean(camera.is_no_cam);
  const isOnline = !isNoCam && camera.status === 'ONLINE';
  const isOffline = !isNoCam && camera.status === 'OFFLINE';

  const chNum = parseInt(camera.channel_no) || 0;
  const displayChannel = chNum > 0 ? String(chNum).padStart(2, '0') : camera.channel_no || '--';

  const handleTestPing = async () => {
    try {
      setIsPinging(true);
      setPingResult(null);
      if (onManualCheck) {
        const res = await onManualCheck(camera.id);
        setPingResult({
          status: res.status,
          message: res.message,
        });
      } else {
        const res = await api.checkCamera(camera.id);
        setPingResult({
          status: res.status,
          message: res.message,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ping probe timed out';
      setPingResult({ status: 'OFFLINE', message: msg });
    } finally {
      setIsPinging(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    try {
      setIsCapturing(true);
      const res = await api.captureCameraSnapshot(camera.id);
      setSnapshotData({
        url: res.image_url,
        intensity: res.mean_intensity,
        captured_at: res.captured_at,
      });
      if (onUpdateCamera) {
        onUpdateCamera({ ...camera, thumbnail_path: res.image_url });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to capture frame';
      alert(`Snapshot Error: ${msg}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleToggleSpare = async () => {
    try {
      setIsTogglingSpare(true);
      if (onToggleSpare) {
        const res = await onToggleSpare(camera.id);
        if (onUpdateCamera) {
          onUpdateCamera({
            ...camera,
            is_no_cam: res.is_no_cam,
            status: res.status as 'ONLINE' | 'OFFLINE' | 'NO_CAM',
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      alert(msg);
    } finally {
      setIsTogglingSpare(false);
    }
  };

  const handleSimulateOutage = async () => {
    try {
      setIsSimulating(true);
      await api.simulateOutage(camera.id, 'Simulated Field Cable Severed');
      setPingResult({
        status: 'OFFLINE',
        message: 'Simulated Outage Injected - Incident Opened',
      });
      if (onUpdateCamera) {
        onUpdateCamera({ ...camera, status: 'OFFLINE', last_error: 'Simulated Field Cable Severed' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      alert(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  const copyRtsp = () => {
    const url = camera.masked_url || camera.rtsp_url;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const currentThumbnail = snapshotData?.url || camera.thumbnail_path;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="overflow-y-auto flex flex-col justify-between w-full sm:max-w-[480px] p-6 space-y-4"
      >
        <div>
          {/* Drawer Header */}
          <SheetHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted font-bold text-foreground">
                  CH-{displayChannel}
                </span>
                <span className="text-xs text-muted-foreground">{camera.dvr_nvr_name || 'NVR Bay'}</span>
              </div>
              <div>
                {isOnline && (
                  <Badge variant="success" className="gap-1.5 font-mono text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                  </Badge>
                )}
                {isOffline && (
                  <Badge variant="danger" className="gap-1.5 font-mono text-xs animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    OFFLINE
                  </Badge>
                )}
                {isNoCam && (
                  <Badge variant="spare" className="font-mono text-xs">
                    SPARE PORT
                  </Badge>
                )}
              </div>
            </div>
            <SheetTitle className="text-lg font-bold tracking-tight text-foreground text-left mt-1">
              {camera.name}
            </SheetTitle>
            <SheetDescription className="text-left text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              <span>{camera.location || 'Location Not Specified'}</span>
            </SheetDescription>
          </SheetHeader>

          {/* 1. Live Frame Snapshot Container (16:9 ratio) */}
          <div className="mt-4 space-y-2">
            <div className="relative aspect-video w-full rounded-lg border border-border/80 bg-black/40 overflow-hidden flex items-center justify-center shadow-inner">
              {currentThumbnail ? (
                <img
                  src={currentThumbnail}
                  alt={camera.name}
                  className="w-full h-full object-cover"
                />
              ) : isOffline ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-red-400">
                  <AlertTriangle className="w-10 h-10 mb-2 text-red-500 animate-bounce" />
                  <span className="text-sm font-semibold">Video Stream Inactive</span>
                  <span className="text-xs text-muted-foreground mt-1 font-mono">
                    {camera.last_error || 'TCP Socket Timeout on RTSP port'}
                  </span>
                </div>
              ) : isNoCam ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
                  <Sliders className="w-10 h-10 mb-2 text-slate-500" />
                  <span className="text-sm font-semibold">Spare Recorder Port</span>
                  <span className="text-xs text-muted-foreground mt-1">No physical camera attached to this channel</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-emerald-400">
                  <Radio className="w-10 h-10 mb-2 text-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold">Live Stream Active</span>
                  <span className="text-xs text-muted-foreground mt-1 font-mono">
                    Ready for single-frame live diagnostic grab
                  </span>
                </div>
              )}

              {/* Day/Night Intensity Tag */}
              {snapshotData?.intensity !== undefined && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] font-mono text-white flex items-center gap-1">
                  <SunMedium className="w-3 h-3 text-amber-400" />
                  <span>Lux/Mean: {Math.round(snapshotData.intensity)}</span>
                </div>
              )}

              {/* Timestamp tag */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-mono text-white/90">
                {snapshotData?.captured_at || new Date().toLocaleTimeString()}
              </div>
            </div>

            {/* Frame Grab Button */}
            {!isNoCam && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 gap-1.5"
                onClick={handleCaptureSnapshot}
                disabled={isCapturing}
              >
                <CameraIcon className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                <span>{isCapturing ? 'Extracting RTSP Keyframe...' : 'Capture Fresh Live Snapshot'}</span>
              </Button>
            )}
          </div>

          {/* 2. Ping & Handshake Result Banner */}
          {pingResult && (
            <div
              className={`p-3 rounded-md text-xs font-mono border mt-3 transition-all ${
                pingResult.status === 'ONLINE'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-red-950/20 border-red-500/40 text-red-400'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>STATUS: {pingResult.status}</span>
                <span className="text-[10px]">{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed">{pingResult.message}</p>
            </div>
          )}

          {/* 3. Stream & Network Specifications */}
          <div className="mt-4 rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2 text-xs">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/40">
              <Server className="w-3.5 h-3.5 text-primary" />
              <span>Network & Stream Telemetry</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">IP ADDRESS</span>
                <span className="text-foreground font-semibold">{camera.ip_address}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">PORT</span>
                <span className="text-foreground font-semibold">{camera.port || 554}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">RECORDER BAY</span>
                <span className="text-foreground">{camera.dvr_nvr_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">RECORDED CHANNEL</span>
                <span className="text-foreground">Channel {camera.channel_no || '--'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">LATENCY</span>
                <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                  {camera.latency_ms ? `${Math.round(camera.latency_ms)} ms` : '--'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">LAST INSPECTED</span>
                <span className="text-foreground truncate block">
                  {camera.last_checked ? new Date(camera.last_checked).toLocaleTimeString() : 'Recent'}
                </span>
              </div>
            </div>

            {/* RTSP URL with Copy Button */}
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono">
                  RTSP STREAM URI
                </span>
                <button
                  onClick={copyRtsp}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URI</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2 rounded bg-background border border-border/60 font-mono text-[10px] break-all text-muted-foreground">
                {camera.masked_url || camera.rtsp_url}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Interactive Drawer Diagnostic Actions */}
        <div className="space-y-2 pt-4 border-t border-border/60">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Operator Diagnostic Controls
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={handleTestPing}
              disabled={isPinging}
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Testing...' : 'Test Ping'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={handleToggleSpare}
              disabled={isTogglingSpare}
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>{isNoCam ? 'Set as Active' : 'Mark as Spare'}</span>
            </Button>
          </div>

          {/* Outage Simulation Trigger */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs h-8 gap-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300"
            onClick={handleSimulateOutage}
            disabled={isSimulating}
            title="Inject an artificial outage for this camera to verify system alarm handling"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>{isSimulating ? 'Injecting Outage...' : 'Simulate Camera Outage Alarm'}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
