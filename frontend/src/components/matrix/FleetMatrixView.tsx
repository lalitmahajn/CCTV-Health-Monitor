import React, { useState } from 'react';
import { SummaryMetrics } from '@/components/overview/SummaryMetrics';
import { CriticalOutageBanner } from '@/components/overview/CriticalOutageBanner';
import { TelemetryCharts } from '@/components/overview/TelemetryCharts';
import { RackMatrixBay } from './RackMatrixBay';
import { Button } from '@/components/ui/button';
import { Search, Filter, BarChart2 } from 'lucide-react';
import type { Camera, NvrInfo, Incident, FleetSummary } from '@/lib/types';

interface FleetMatrixViewProps {
  cameras: Camera[];
  nvrs: NvrInfo[];
  nvrGroups: Record<string, Camera[]>;
  summary: FleetSummary;
  activeIncidents: Incident[];
  onSelectCamera: (camera: Camera) => void;
  onAcknowledgeIncident: (incidentId: number) => Promise<void>;
  onQuickPingCamera?: (camera: Camera) => void;
}

export const FleetMatrixView: React.FC<FleetMatrixViewProps> = ({
  cameras,
  nvrs,
  nvrGroups,
  summary,
  activeIncidents,
  onSelectCamera,
  onAcknowledgeIncident,
  onQuickPingCamera,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedNvr, setSelectedNvr] = useState<string>('ALL');
  const [showCharts, setShowCharts] = useState(true);

  const nvrMap = new Map<string, NvrInfo>(nvrs.map((n) => [n.name, n]));
  const groupKeys = Object.keys(nvrGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const displayedGroups = selectedNvr === 'ALL'
    ? groupKeys
    : groupKeys.filter((k) => k.toLowerCase() === selectedNvr.toLowerCase());

  return (
    <div className="space-y-4">
      {/* 1. Critical Outage Alerts Banner */}
      <CriticalOutageBanner
        activeIncidents={activeIncidents}
        onAcknowledge={onAcknowledgeIncident}
        onInspectCamera={onSelectCamera}
        cameras={cameras}
      />

      {/* 2. KPI Summary Metrics */}
      <SummaryMetrics
        summary={summary}
        onFilterStatus={setFilterStatus}
        activeFilter={filterStatus}
      />

      {/* 3. Collapsible Telemetry Charts */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span>Telemetry & System Capacity</span>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 text-muted-foreground hover:text-foreground"
          onClick={() => setShowCharts(!showCharts)}
        >
          {showCharts ? 'Hide Visual Analytics' : 'Show Visual Analytics'}
        </Button>
      </div>

      {showCharts && <TelemetryCharts cameras={cameras} nvrs={nvrs} />}

      {/* 4. Matrix Controls: Search bar, Status pills, NVR filter dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-card/60 backdrop-blur">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search 270 cameras by name, IP, channel, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* NVR Bay Selector */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedNvr}
              onChange={(e) => setSelectedNvr(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All NVR Bays (9 Recorders)</option>
              {groupKeys.map((key) => (
                <option key={key} value={key}>
                  {key} ({nvrGroups[key]?.length || 0} CH)
                </option>
              ))}
            </select>
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

      {/* 5. High-Density Rack Bays */}
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
