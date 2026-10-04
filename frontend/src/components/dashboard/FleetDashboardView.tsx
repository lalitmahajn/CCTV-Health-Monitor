import React from 'react';
import { SummaryMetrics } from '@/components/overview/SummaryMetrics';
import { CriticalOutageBanner } from '@/components/overview/CriticalOutageBanner';
import { FleetUptimeChart } from './FleetUptimeChart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  HardDrive, 
  ArrowRight, 
  RotateCw, 
  FileSpreadsheet, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Camera, NvrInfo, Incident, FleetSummary } from '@/lib/types';
import * as api from '@/lib/api';

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

  const [isScanning, setIsScanning] = React.useState(false);
  const [scanMessage, setScanMessage] = React.useState<string | null>(null);

  const handleScanFleet = async () => {
    try {
      setIsScanning(true);
      setScanMessage(null);
      await api.triggerFullFleetScan();
      setScanMessage('Scan completed successfully');
      setTimeout(() => setScanMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      setScanMessage(msg);
      setTimeout(() => setScanMessage(null), 4000);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Critical Outage Alerts Banner (Shown only when cameras drop) */}
      <CriticalOutageBanner
        activeIncidents={activeIncidents}
        onAcknowledge={onAcknowledgeIncident}
        onInspectCamera={onSelectCamera}
        cameras={cameras}
      />

      {/* 2. Official Shadcn Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Fleet Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time telemetry across {groupKeys.length} NVR hardware bays and {cameras.length} camera channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {scanMessage && (
            <span className="text-xs text-muted-foreground animate-fade-in mr-2">
              {scanMessage}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            asChild
          >
            <a href="/api/cameras/csv/export" download>
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-muted-foreground" />
              Export CSV
            </a>
          </Button>
          <Button
            size="sm"
            onClick={handleScanFleet}
            disabled={isScanning}
            className="text-xs"
          >
            <RotateCw className={cn("w-4 h-4 mr-1.5", isScanning && "animate-spin")} />
            {isScanning ? 'Scanning...' : 'Scan Fleet'}
          </Button>
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards (Official Shadcn dashboard-01 layout) */}
      <SummaryMetrics summary={summary} />

      {/* 4. Fleet Operating Trend Line Chart */}
      <FleetUptimeChart
        currentOnlineCount={summary.online}
        activeProvisionedCount={summary.activeTotal ?? (summary.total - summary.noCam)}
        sparePortsCount={summary.noCam}
      />


      {/* 5. NVR Hardware Recorders & Rack Bays Section */}

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span>NVR Rack Bays</span>
              <Badge variant="secondary" className="font-normal text-xs">
                {groupKeys.length} Units
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Hardware rack telemetry and channel allocation for physical recorders
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onNavigateToMatrix()}
          >
            <span>Open 32-CH Grid</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupKeys.map((bayName) => {
            const bayCams = nvrGroups[bayName] || [];
            const info = nvrMap.get(bayName);

            let online = 0;
            let warning = 0;
            let offline = 0;
            let spare = 0;

            bayCams.forEach((c) => {
              if (c.is_no_cam) spare++;
              else if (c.status === 'ONLINE') online++;
              else if (c.status === 'WARNING') warning++;
              else offline++;
            });

            const total = bayCams.length;
            const operating = online + warning;
            const healthPct = total > spare ? Math.round((operating / (total - spare)) * 100) : 100;
            const isNvrDown = info?.status === 'OFFLINE';
            const isCritical = isNvrDown || offline >= 2;

            return (
              <Card
                key={bayName}
                className={cn(
                  "flex flex-col justify-between transition-colors hover:bg-muted/20",
                  isCritical && "border-destructive/50"
                )}
              >
                <CardHeader className="p-4 pb-3 space-y-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold tracking-tight">
                        {bayName}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{info?.ip_address ? `${info.ip_address}:${info.port || 554}` : 'Assigned Rack'}</span>
                        {isNvrDown ? (
                          <span className="text-[10px] text-destructive font-sans font-medium">· Recorder Down</span>
                        ) : info?.status === 'ONLINE' ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium">· Online {info.latency_ms ? `(${Math.round(info.latency_ms)}ms)` : ''}</span>
                        ) : null}
                      </CardDescription>
                    </div>

                    {isNvrDown ? (
                      <Badge variant="destructive" className="text-[11px] gap-1 font-normal animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        NVR Outage
                      </Badge>
                    ) : isCritical ? (
                      <Badge variant="destructive" className="text-[11px] gap-1 font-normal">
                        <AlertTriangle className="w-3 h-3" />
                        {offline} Down
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] gap-1 font-normal text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {healthPct}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {isNvrDown && (
                    <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>TCP 554 unreachable. All channels suspended.</span>
                    </div>
                  )}

                  {/* Channel Breakdown Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground block text-[10px]">Online</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {online}
                        {warning > 0 && (
                          <span className="text-amber-500 font-normal text-[10px] ml-1" title={`${warning} high latency`}>
                            +{warning}w
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground block text-[10px]">Offline</span>
                      <span className={cn(
                        "font-semibold mt-0.5 block",
                        offline > 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {offline}
                      </span>
                    </div>

                    <div className="p-2 rounded-md bg-muted/50">
                      <span className="text-muted-foreground block text-[10px]">Spare</span>
                      <span className="font-semibold text-muted-foreground mt-0.5 block">
                        {spare}
                      </span>
                    </div>
                  </div>

                  {/* Channel allocation bar using Shadcn Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Allocation</span>
                      <span className="font-mono">
                        {operating} / {total - spare} ({healthPct}%)
                      </span>
                    </div>
                    <Progress value={healthPct} className="h-1.5" />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 mt-1"
                    onClick={() => onNavigateToMatrix(bayName)}
                  >
                    <span>Inspect Bay Channels</span>
                    <ArrowRight className="w-3 h-3 ml-1.5 text-muted-foreground" />
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
