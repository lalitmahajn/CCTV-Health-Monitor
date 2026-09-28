import React from 'react';
import { SummaryMetrics } from '@/components/overview/SummaryMetrics';
import { CriticalOutageBanner } from '@/components/overview/CriticalOutageBanner';
import { TelemetryCharts } from '@/components/overview/TelemetryCharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardDrive, ArrowRight, CheckCircle2, AlertOctagon, Sliders, ExternalLink } from 'lucide-react';
import type { Camera, NvrInfo, Incident, FleetSummary } from '@/lib/types';

interface FleetDashboardViewProps {
  cameras: Camera[];
  nvrs: NvrInfo[];
  nvrGroups: Record<string, Camera[]>;
  summary: FleetSummary;
  activeIncidents: Incident[];
  onSelectCamera: (camera: Camera) => void;
  onAcknowledgeIncident: (incidentId: number) => Promise<void>;
  onNavigateToMatrix: (nvrName?: string) => void;
}

export const FleetDashboardView: React.FC<FleetDashboardViewProps> = ({
  cameras,
  nvrs,
  nvrGroups,
  summary,
  activeIncidents,
  onSelectCamera,
  onAcknowledgeIncident,
  onNavigateToMatrix,
}) => {
  const nvrMap = new Map<string, NvrInfo>(nvrs.map((n) => [n.name, n]));
  const groupKeys = Object.keys(nvrGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  return (
    <div className="space-y-6">
      {/* 1. Critical Outage Alerts Banner */}
      <CriticalOutageBanner
        activeIncidents={activeIncidents}
        onAcknowledge={onAcknowledgeIncident}
        onInspectCamera={onSelectCamera}
        cameras={cameras}
      />

      {/* 2. KPI Summary Cards */}
      <SummaryMetrics summary={summary} />

      {/* 3. Visual Analytics & Telemetry Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold tracking-tight text-foreground uppercase flex items-center gap-2">
            <span>Fleet Telemetry & Allocation Analytics</span>
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => onNavigateToMatrix()}
          >
            <span>Open All 270 Channels</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <TelemetryCharts cameras={cameras} nvrs={nvrs} />
      </div>

      {/* 4. Executive NVR Bays Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <span>NVR Recorder Bay Status & Distribution</span>
              <Badge variant="outline" className="font-mono text-xs">
                {groupKeys.length} Recorders
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Hardware rack recorders, allocated streaming channels, and bay health ratios
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupKeys.map((bayName) => {
            const bayCams = nvrGroups[bayName] || [];
            const info = nvrMap.get(bayName);

            let online = 0;
            let offline = 0;
            let spare = 0;

            bayCams.forEach((c) => {
              if (c.is_no_cam) spare++;
              else if (c.status === 'ONLINE') online++;
              else offline++;
            });

            const total = bayCams.length;
            const healthPct = total > spare ? Math.round((online / (total - spare)) * 100) : 100;
            const isCritical = offline >= 2;

            return (
              <Card
                key={bayName}
                className={`transition-all hover:border-primary/50 flex flex-col justify-between ${
                  isCritical ? 'border-red-500/50 bg-red-950/5' : 'border-border/80'
                }`}
              >
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                        <span>{bayName}</span>
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5">
                        {info?.ip_address ? `${info.ip_address}:${info.port || 554}` : 'Assigned Bay'}
                      </CardDescription>
                    </div>

                    {isCritical ? (
                      <Badge variant="danger" className="text-[10px] animate-pulse">
                        {offline} OUTAGES
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px] font-mono">
                        {healthPct}% HEALTH
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Channel Breakdown Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block text-[10px] uppercase">Online</span>
                      <span className="font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {online}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block text-[10px] uppercase">Offline</span>
                      <span className={`font-bold flex items-center justify-center gap-1 mt-0.5 ${
                        offline > 0 ? 'text-red-400' : 'text-muted-foreground'
                      }`}>
                        <AlertOctagon className="w-3 h-3" />
                        {offline}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block text-[10px] uppercase">Spare</span>
                      <span className="font-bold text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                        <Sliders className="w-3 h-3" />
                        {spare}
                      </span>
                    </div>
                  </div>

                  {/* Channel capacity bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                      <span>Allocation ({total} CH)</span>
                      <span>{Math.round((online / (total || 1)) * 100)}% Active</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(online / (total || 1)) * 100}%` }}
                        title={`${online} Online`}
                      />
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(offline / (total || 1)) * 100}%` }}
                        title={`${offline} Offline`}
                      />
                      <div
                        className="bg-slate-500 h-full"
                        style={{ width: `${(spare / (total || 1)) * 100}%` }}
                        title={`${spare} Spare`}
                      />
                    </div>
                  </div>

                  {/* Jump to Bay in Matrix */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 gap-1.5 mt-2 justify-center"
                    onClick={() => onNavigateToMatrix(bayName)}
                  >
                    <span>Inspect Bay Channels</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
