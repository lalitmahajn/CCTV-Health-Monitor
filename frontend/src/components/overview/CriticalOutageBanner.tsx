import React from 'react';
import { AlertOctagon, CheckCircle2, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Incident, Camera } from '@/lib/types';
import { useTimeFormat, formatTime } from '@/lib/timeUtils';

interface CriticalOutageBannerProps {
  activeIncidents: Incident[];
  onAcknowledge: (incidentId: number) => Promise<void>;
  onInspectCamera: (camera: Camera) => void;
  cameras: Camera[];
}

export const CriticalOutageBanner: React.FC<CriticalOutageBannerProps> = ({
  activeIncidents,
  onAcknowledge,
  onInspectCamera,
  cameras,
}) => {
  const [timeFormat] = useTimeFormat();

  if (activeIncidents.length === 0) {
    return null;
  }


  const cameraMap = new Map<number, Camera>(cameras.map((c) => [c.id, c]));

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-4 mb-4 shadow-lg animate-pulse-fast">
      <div className="flex items-center justify-between pb-3 border-b border-red-500/20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-red-500/20 text-red-500">
            <AlertOctagon className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-400 tracking-wide uppercase flex items-center gap-2">
              Critical Fleet Outage Detected
              <Badge variant="destructive" className="h-5 text-xs font-mono">
                {activeIncidents.length} CAMERA{activeIncidents.length === 1 ? '' : 'S'} DOWN
              </Badge>
            </h4>
            <p className="text-xs text-muted-foreground">
              Immediate inspection and acknowledgment required by security control
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
        {activeIncidents.map((incident) => {
          const associatedCam = cameraMap.get(incident.camera_id);
          const isAcked = Boolean(incident.is_acknowledged);

          return (
            <div
              key={incident.id}
              className="flex items-center justify-between p-2.5 rounded-md bg-background/60 border border-red-500/20 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{incident.camera_name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ({incident.dvr_nvr_name || 'NVR'} / CH-{incident.channel_no || '01'})
                    </span>
                  </div>
                  <div className="text-[11px] text-red-400/90 font-mono">
                    {incident.error_reason || 'RTSP Handshake Timeout / Device Unreachable'} • Started {formatTime(incident.started_at, timeFormat)}
                  </div>

                </div>
              </div>

              <div className="flex items-center gap-2">
                {associatedCam && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-muted hover:border-foreground"
                    onClick={() => onInspectCamera(associatedCam)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </Button>
                )}

                {isAcked ? (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 gap-1 h-7">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledged</span>
                  </Badge>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700"
                    onClick={() => onAcknowledge(incident.id)}
                  >
                    <span>Acknowledge</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
