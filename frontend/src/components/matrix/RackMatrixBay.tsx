import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChannelTile } from './ChannelTile';
import { HardDrive, ChevronDown, ChevronUp } from 'lucide-react';
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
  let offlineCount = 0;
  let spareCount = 0;

  cameras.forEach((c) => {
    if (c.is_no_cam) spareCount++;
    else if (c.status === 'ONLINE') onlineCount++;
    else offlineCount++;
  });

  // Filter channels if filter or search active
  const filteredCameras = cameras.filter((cam) => {
    if (filterStatus) {
      if (filterStatus === 'ONLINE' && (cam.is_no_cam || cam.status !== 'ONLINE')) return false;
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

  const isCriticalBay = offlineCount >= 2;

  return (
    <Card className={`border transition-all duration-200 ${
      isCriticalBay 
        ? 'border-red-500/50 shadow-md shadow-red-500/5 bg-red-950/5' 
        : 'border-border/80 hover:border-border'
    }`}>
      {/* Bay Header */}
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2 border-b border-border/60 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${isCriticalBay ? 'bg-red-500/20 text-red-500' : 'bg-primary/10 text-primary'}`}>
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold tracking-tight">
                  {nvrName}
                </CardTitle>
                {nvrInfo?.ip_address && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({nvrInfo.ip_address}:{nvrInfo.port || 554})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{cameras.length} Channels Allocated</span>
                <span>•</span>
                <span className="text-emerald-500 font-semibold">{onlineCount} Online</span>
                {offlineCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-500 font-bold">{offlineCount} Down</span>
                  </>
                )}
                {spareCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">{spareCount} Spare</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCriticalBay && (
              <Badge variant="danger" className="text-[10px] animate-pulse">
                CRITICAL BAY
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
