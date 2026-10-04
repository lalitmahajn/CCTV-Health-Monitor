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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  Activity,
} from 'lucide-react';
import { cn, getCameraDisplayName } from '@/lib/utils';
import type { Camera } from '@/lib/types';
import * as api from '@/lib/api';
import { useTimeFormat, formatTime } from '@/lib/timeUtils';

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
  const [timeFormat] = useTimeFormat();

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
  const displayName = getCameraDisplayName(camera);

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
      setPingResult({
        status: 'OFFLINE',
        message: msg,
      });
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
        className="w-full sm:max-w-[460px] p-0 flex flex-col justify-between overflow-hidden bg-card border-l border-border"
      >
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Header */}
          <SheetHeader className="space-y-1.5 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  CH-{displayChannel}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {camera.dvr_nvr_name || 'NVR Bay'}
                </span>
              </div>

              <div>
                {isOnline && (
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </Badge>
                )}
                {isOffline && (
                  <Badge variant="destructive" className="text-xs font-normal">
                    Offline
                  </Badge>
                )}
                {isNoCam && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    Spare Port
                  </Badge>
                )}
              </div>
            </div>

            <SheetTitle className="text-xl font-bold tracking-tight text-foreground text-left pt-1">
              {displayName}
            </SheetTitle>
            {camera.alias && (
              <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="opacity-70">Hardware:</span>
                <span>{camera.name}</span>
              </div>
            )}

            <SheetDescription className="text-left text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{camera.location || 'Location Not Specified'}</span>
            </SheetDescription>
          </SheetHeader>

          {/* 2. Live Frame Snapshot Container (16:9) */}
          <div className="space-y-2">
            <div className="relative aspect-video w-full rounded-lg border border-border/80 bg-black/60 overflow-hidden flex items-center justify-center">
              {currentThumbnail ? (
                <img
                  src={currentThumbnail}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : isOffline ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-destructive">
                  <AlertTriangle className="w-8 h-8 mb-2 opacity-80" />
                  <span className="text-sm font-semibold">Video Stream Inactive</span>
                  <span className="text-xs text-muted-foreground mt-1 font-mono">
                    {camera.last_error || 'TCP Socket Timeout on RTSP port'}
                  </span>
                </div>
              ) : isNoCam ? (
                <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                  <Sliders className="w-8 h-8 mb-2 opacity-60" />
                  <span className="text-sm font-semibold">Spare Recorder Port</span>
                  <span className="text-xs text-muted-foreground mt-1">No camera attached</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                  <Radio className="w-8 h-8 mb-2 text-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-foreground">Live Stream Ready</span>
                  <span className="text-xs text-muted-foreground mt-1 font-mono">
                    Click below to capture frame
                  </span>
                </div>
              )}

              {/* Day/Night Intensity Tag */}
              {snapshotData?.intensity !== undefined && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur text-[10px] font-mono text-white flex items-center gap-1">
                  <SunMedium className="w-3 h-3 text-amber-400" />
                  <span>Lux: {Math.round(snapshotData.intensity)}</span>
                </div>
              )}

              {/* Timestamp tag */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-[10px] font-mono text-white/90">
                {snapshotData?.captured_at ? formatTime(snapshotData.captured_at, timeFormat, true) : formatTime(new Date(), timeFormat, true)}
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
                <CameraIcon className={cn("w-3.5 h-3.5", isCapturing && "animate-spin")} />
                <span>{isCapturing ? 'Extracting Frame...' : 'Capture Live Snapshot'}</span>
              </Button>
            )}
          </div>

          {/* 3. Ping Feedback Alert */}
          {pingResult && (
            <div
              className={cn(
                "p-3 rounded-md border text-xs flex items-start gap-2.5 transition-all",
                pingResult.status === 'ONLINE'
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              )}
            >
              <Activity className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">{pingResult.status}: {pingResult.message}</div>
                <div className="text-[10px] opacity-75 mt-0.5">{formatTime(new Date(), timeFormat, true)}</div>
              </div>
            </div>
          )}


          {/* 4. Stream & Network Specifications Card */}
          <Card className="border-border/60 shadow-none">
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Network & Stream Telemetry</span>
                <Server className="w-3.5 h-3.5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3.5 pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground block">System Name (NVR)</span>
                  <span className="font-mono font-medium text-foreground truncate block">{camera.name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Custom Alias</span>
                  <span className="font-medium text-foreground truncate block">
                    {camera.alias || 'None (Using Default)'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">IP Address</span>
                  <span className="font-mono font-medium text-foreground">{camera.ip_address}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">RTSP Port</span>
                  <span className="font-mono font-medium text-foreground">{camera.port || 554}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Recorder Bay</span>
                  <span className="font-medium text-foreground truncate block">{camera.dvr_nvr_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Bay Channel</span>
                  <span className="font-mono font-medium text-foreground">Channel {camera.channel_no || '--'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Ping Latency</span>
                  <span className={cn("font-mono font-medium", isOnline ? "text-emerald-500" : "text-destructive")}>
                    {camera.latency_ms ? `${Math.round(camera.latency_ms)}ms` : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Last Verified</span>
                  <span className="text-muted-foreground truncate block">
                    {camera.last_checked ? formatTime(camera.last_checked, timeFormat) : 'Recent'}
                  </span>
                </div>
              </div>

              {/* RTSP URL with Copy Button */}
              <div className="pt-2.5 border-t border-border/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground">RTSP Stream URI</span>
                  <button
                    onClick={copyRtsp}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors"
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
                <div className="p-2 rounded-md bg-muted/60 border border-input font-mono text-[10px] break-all select-all text-muted-foreground">
                  {camera.masked_url || camera.rtsp_url}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 5. Diagnostic Controls (Sticky Drawer Footer) */}
        <div className="p-5 border-t border-border/60 bg-card space-y-2.5">
          <div className="text-xs font-medium text-muted-foreground">
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
              <Zap className={cn("w-3.5 h-3.5", isPinging ? "animate-spin text-amber-500" : "text-muted-foreground")} />
              <span>{isPinging ? 'Testing...' : 'Test Ping'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={handleToggleSpare}
              disabled={isTogglingSpare}
            >
              <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{isNoCam ? 'Set as Active' : 'Mark as Spare'}</span>
            </Button>
          </div>

          {/* Outage Simulation Trigger */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs h-8 gap-1.5"
            onClick={handleSimulateOutage}
            disabled={isSimulating}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isSimulating ? 'Injecting Outage...' : 'Simulate Outage Alarm'}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
