import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, ShieldAlert, Cpu, MapPin, Eye, Zap } from 'lucide-react';
import type { Camera } from '@/lib/types';

interface ChannelTileProps {
  camera: Camera;
  onSelect: (camera: Camera) => void;
  onQuickPing?: (camera: Camera) => void;
}

export const ChannelTile: React.FC<ChannelTileProps> = ({
  camera,
  onSelect,
  onQuickPing,
}) => {
  const isNoCam = Boolean(camera.is_no_cam);
  const isOnline = !isNoCam && camera.status === 'ONLINE';
  const isOffline = !isNoCam && camera.status === 'OFFLINE';

  const chNum = parseInt(camera.channel_no) || 0;
  const displayChannel = chNum > 0 ? String(chNum).padStart(2, '0') : camera.channel_no || '--';

  // Tile appearance based on status
  let tileBorder = 'border-border/60 bg-card hover:bg-muted/50 hover:border-foreground/20';
  let dotColor = 'bg-muted-foreground/40';

  if (isOnline) {
    tileBorder = 'border-border/60 bg-card hover:bg-muted/50 hover:border-foreground/20';
    dotColor = 'bg-emerald-500';
  } else if (isOffline) {
    tileBorder = 'border-destructive/60 bg-destructive/10 hover:border-destructive';
    dotColor = 'bg-destructive animate-pulse';
  } else if (isNoCam) {
    tileBorder = 'border-border/40 bg-muted/20 opacity-60 hover:opacity-90';
    dotColor = 'bg-muted-foreground/30';
  }

  return (
    <HoverCard openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          onClick={() => onSelect(camera)}
          className={`relative group flex flex-col justify-between p-2 rounded-md border text-left transition-all duration-150 cursor-pointer h-[76px] w-full overflow-hidden ${tileBorder}`}
        >
          {/* Top row: Channel number & status dot */}
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs font-bold tracking-tight text-foreground/90">
              CH-{displayChannel}
            </span>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${dotColor} ${isOnline ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          {/* Bottom row: Camera label or spare indication */}
          <div className="w-full">
            {isNoCam ? (
              <span className="text-[11px] font-mono text-muted-foreground/70 uppercase">
                Spare Port
              </span>
            ) : (
              <>
                <p className="text-[11px] font-medium text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                  {camera.name}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {camera.ip_address}
                  </span>
                  {camera.latency_ms !== undefined && camera.latency_ms > 0 && isOnline && (
                    <span className="text-[10px] font-mono text-emerald-400/80">
                      {Math.round(camera.latency_ms)}ms
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </button>
      </HoverCardTrigger>

      {/* Rich Shadcn HoverCard Popover */}
      <HoverCardContent
        side="right"
        align="start"
        className="w-80 p-3 bg-popover/98 border border-border shadow-2xl backdrop-blur-md"
      >
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-sm text-foreground">
                  CH-{displayChannel}
                </span>
                <span className="text-xs text-muted-foreground">• {camera.dvr_nvr_name || 'NVR'}</span>
              </div>
              <h4 className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                {camera.name}
              </h4>
            </div>
            {isOnline ? (
              <Badge variant="outline" className="text-[10px] gap-1 font-normal text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </Badge>
            ) : isOffline ? (
              <Badge variant="destructive" className="text-[10px] font-normal">
                Offline
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Spare
              </Badge>
            )}
          </div>

          {/* Thumbnail Preview / Visual Area */}
          <div className="relative aspect-video w-full rounded border border-border/60 bg-muted/40 overflow-hidden flex items-center justify-center">
            {camera.thumbnail_path ? (
              <img
                src={camera.thumbnail_path}
                alt={camera.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : isOffline ? (
              <div className="flex flex-col items-center justify-center text-red-400 p-2 text-center">
                <ShieldAlert className="w-6 h-6 mb-1 text-red-500 animate-bounce" />
                <span className="text-[11px] font-medium">RTSP Feed Down</span>
              </div>
            ) : isNoCam ? (
              <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                <Video className="w-6 h-6 mb-1 text-slate-500" />
                <span className="text-[11px]">Unassigned Spare Slot</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-emerald-400/80 p-2 text-center">
                <Video className="w-6 h-6 mb-1 text-emerald-500" />
                <span className="text-[10px] font-mono">1080p RTSP Stream Active</span>
              </div>
            )}
            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white/90">
              {camera.ip_address}:{camera.port || 554}
            </div>
          </div>

          {/* Telemetry info */}
          <div className="space-y-1 text-xs">
            {camera.location && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">{camera.location}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-muted-foreground border-t border-border/40">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Latency:
              </span>
              <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                {isOnline ? `${Math.round(camera.latency_ms || 18)}ms` : 'TIMEOUT'}
              </span>
            </div>

            {camera.last_error && isOffline && (
              <div className="text-[11px] text-red-400 font-mono bg-red-950/30 p-1.5 rounded border border-red-500/20">
                {camera.last_error}
              </div>
            )}
          </div>

          {/* Quick Action Footer */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/60">
            <Button
              variant="default"
              size="sm"
              className="w-full text-xs h-7 gap-1"
              onClick={() => onSelect(camera)}
            >
              <Eye className="w-3 h-3" />
              <span>Inspect Camera</span>
            </Button>
            {onQuickPing && !isNoCam && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => onQuickPing(camera)}
                title="Run manual ping check"
              >
                <Zap className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
