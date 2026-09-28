import React, { useState, useEffect } from 'react';
import { RackMatrixBay } from './RackMatrixBay';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, LayoutGrid } from 'lucide-react';
import type { Camera, NvrInfo } from '@/lib/types';

interface FleetMatrixViewProps {
  cameras: Camera[];
  nvrs: NvrInfo[];
  nvrGroups: Record<string, Camera[]>;
  onSelectCamera: (camera: Camera) => void;
  onQuickPingCamera?: (camera: Camera) => void;
  selectedNvrFilter?: string;
  onNvrFilterChange?: (nvrName: string) => void;
}

export const FleetMatrixView: React.FC<FleetMatrixViewProps> = ({
  cameras,
  nvrs,
  nvrGroups,
  onSelectCamera,
  onQuickPingCamera,
  selectedNvrFilter = 'ALL',
  onNvrFilterChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedNvr, setSelectedNvr] = useState<string>(selectedNvrFilter);

  useEffect(() => {
    if (selectedNvrFilter) {
      setSelectedNvr(selectedNvrFilter);
    }
  }, [selectedNvrFilter]);

  const handleNvrSelect = (val: string) => {
    setSelectedNvr(val);
    if (onNvrFilterChange) {
      onNvrFilterChange(val);
    }
  };

  const nvrMap = new Map<string, NvrInfo>(nvrs.map((n) => [n.name, n]));
  const groupKeys = Object.keys(nvrGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const displayedGroups = selectedNvr === 'ALL'
    ? groupKeys
    : groupKeys.filter((k) => k.toLowerCase() === selectedNvr.toLowerCase());

  // Count totals for matrix header
  let totalOnline = 0;
  let totalOffline = 0;
  let totalSpare = 0;
  cameras.forEach((c) => {
    if (c.is_no_cam) totalSpare++;
    else if (c.status === 'ONLINE') totalOnline++;
    else totalOffline++;
  });

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                DVR / NVR Channels Matrix
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                32-CH Rack Bays
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              High-density channel rack matrix. Hover any channel tile for instant preview or click to inspect.
            </p>
          </div>
        </div>

        {/* Quick status summary badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <Badge variant="success" className="gap-1 h-7">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{totalOnline} Online</span>
          </Badge>
          {totalOffline > 0 && (
            <Badge variant="danger" className="gap-1 h-7 animate-pulse">
              <span>{totalOffline} Down</span>
            </Badge>
          )}
          <Badge variant="spare" className="h-7">
            <span>{totalSpare} Spare</span>
          </Badge>
        </div>
      </div>

      {/* 2. Controls: Search, NVR Selector, Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-card/60 backdrop-blur">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search channels by camera name, IP, channel, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Genuine Shadcn Select for NVR Bay Selector */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select value={selectedNvr} onValueChange={handleNvrSelect}>
              <SelectTrigger className="w-[210px] h-9 text-xs font-medium">
                <SelectValue placeholder="All NVR Bays (9 Recorders)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All NVR Bays (9 Recorders)</SelectItem>
                {groupKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key} ({nvrGroups[key]?.length || 0} CH)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-md border border-border/60">
            {[
              { id: null, label: 'All' },
              { id: 'ONLINE', label: 'Online' },
              { id: 'OFFLINE', label: 'Offline' },
              { id: 'NO_CAM', label: 'Spare' },
            ].map((btn) => (
              <button
                key={String(btn.id)}
                onClick={() => setFilterStatus(btn.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  filterStatus === btn.id
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. High-Density Rack Bays with 32-Channel Grid & HoverCard */}
      <div className="space-y-4">
        {displayedGroups.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-mono rounded-lg border border-dashed border-border">
            No NVR bays match the selected filters.
          </div>
        ) : (
          displayedGroups.map((bayName) => (
            <RackMatrixBay
              key={bayName}
              nvrName={bayName}
              cameras={nvrGroups[bayName] || []}
              nvrInfo={nvrMap.get(bayName)}
              onSelectCamera={onSelectCamera}
              onQuickPingCamera={onQuickPingCamera}
              filterStatus={filterStatus}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
};
