import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelTile } from './ChannelTile';
import { HardDrive, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Camera, NvrInfo } from '@/lib/types';

interface RackMatrixBayProps {
  nvrName: string;
  cameras: Camera[];
  nvrInfo?: NvrInfo;
  onSelectCamera: (camera: Camera) => void;
  onQuickPingCamera?: (camera: Camera) => void;
  filterStatus?: string | null;
  searchQuery?: string;
}

export const RackMatrixBay: React.FC<RackMatrixBayProps> = ({
  nvrName,
  cameras,
  nvrInfo,
  onSelectCamera,
  onQuickPingCamera,
  filterStatus,
  searchQuery = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Compute status counts for this NVR
  let onlineCount = 0;
  let warningCount = 0;
  let offlineCount = 0;
  let spareCount = 0;

  cameras.forEach((c) => {
    if (c.is_no_cam) spareCount++;
    else if (c.status === 'ONLINE') onlineCount++;
    else if (c.status === 'WARNING') warningCount++;
    else offlineCount++;
  });

  // Filter channels if filter or search active
  const filteredCameras = cameras.filter((cam) => {
    if (filterStatus) {
      if (filterStatus === 'ONLINE' && (cam.is_no_cam || (cam.status !== 'ONLINE' && cam.status !== 'WARNING'))) return false;
      if (filterStatus === 'OFFLINE' && (cam.is_no_cam || cam.status !== 'OFFLINE')) return false;
      if (filterStatus === 'NO_CAM' && !cam.is_no_cam) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cam.name.toLowerCase().includes(q);
      const matchIp = cam.ip_address.toLowerCase().includes(q);
      const matchLoc = (cam.location || '').toLowerCase().includes(q);
      const matchCh = String(cam.channel_no || '').toLowerCase().includes(q);
      if (!matchName && !matchIp && !matchLoc && !matchCh) return false;
    }

    return true;
  });

  const isNvrDown = nvrInfo?.status === 'OFFLINE';
  const isCriticalBay = isNvrDown || offlineCount > 0;

  return (
    <Card className={cn(
      "border-border/60 transition-colors",
      isCriticalBay && "border-destructive/40"
    )}>
      {/* Bay Header */}
      <CardHeader className="p-3.5 pb-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "p-1.5 rounded-md",
              isNvrDown ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
            )}>
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  {nvrName}
                </CardTitle>
                {nvrInfo?.ip_address && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({nvrInfo.ip_address}:{nvrInfo.port || 554})
                  </span>
                )}
                {isNvrDown ? (
                  <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    Recorder Unreachable
                  </Badge>
                ) : nvrInfo?.status === 'ONLINE' ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                    Recorder Online{nvrInfo.latency_ms ? ` (${Math.round(nvrInfo.latency_ms)}ms)` : ''}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{cameras.length} Channels</span>
                <span>·</span>
                <span>{onlineCount} Online</span>
                {warningCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-500 font-medium">{warningCount} Warning</span>
                  </>
                )}
                {offlineCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-destructive font-medium">{offlineCount} Down</span>
                  </>
                )}
                {spareCount > 0 && (
                  <>
                    <span>·</span>
                    <span>{spareCount} Spare</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {offlineCount > 0 && !isNvrDown && (
              <Badge variant="destructive" className="text-[10px]">
                {offlineCount} Down
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-muted-foreground"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* NVR Outage Alert Banner */}
      {isNvrDown && !isCollapsed && (
        <div className="mx-3 sm:mx-4 mt-3 p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <span className="font-semibold">NVR Recorder Outage:</span> Port {nvrInfo?.port || 554} on {nvrInfo?.ip_address} is unreachable. All camera streams on this bay are halted.
            {nvrInfo?.last_error && (
              <span className="block text-[11px] opacity-80 mt-0.5 font-mono">Error: {nvrInfo.last_error}</span>
            )}
          </div>
        </div>
      )}

      {/* 32-Channel Grid View */}
      {!isCollapsed && (
        <CardContent className="p-3 sm:p-4 pt-3 sm:pt-3">
          {filteredCameras.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground font-mono">
              No camera channels matching filter criteria in this bay
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {filteredCameras.map((camera) => (
                <ChannelTile
                  key={camera.id}
                  camera={camera}
                  onSelect={onSelectCamera}
                  onQuickPing={onQuickPingCamera}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
