import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Camera, NvrInfo } from '@/lib/types';
import { BarChart3, PieChart as PieIcon, Cpu } from 'lucide-react';

interface TelemetryChartsProps {
  cameras: Camera[];
  nvrs: NvrInfo[];
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ cameras }) => {
  // Aggregate channel statistics per NVR
  const nvrChartData = useMemo(() => {
    const map: Record<string, { nvr: string; online: number; offline: number; spare: number; total: number }> = {};

    cameras.forEach((cam) => {
      const name = cam.dvr_nvr_name || 'NVR Unassigned';
      if (!map[name]) {
        map[name] = { nvr: name.replace('DVR/NVR ', '').replace('NVR ', 'NVR-'), online: 0, offline: 0, spare: 0, total: 0 };
      }
      map[name].total += 1;
      if (cam.is_no_cam) {
        map[name].spare += 1;
      } else if (cam.status === 'ONLINE') {
        map[name].online += 1;
      } else {
        map[name].offline += 1;
      }
    });

    return Object.values(map).sort((a, b) => a.nvr.localeCompare(b.nvr, undefined, { numeric: true }));
  }, [cameras]);

  // Aggregate overall status pie distribution
  const pieData = useMemo(() => {
    let online = 0;
    let offline = 0;
    let spare = 0;

    cameras.forEach((cam) => {
      if (cam.is_no_cam) spare++;
      else if (cam.status === 'ONLINE') online++;
      else offline++;
    });

    return [
      { name: 'Online Active', value: online, color: '#10b981' },
      { name: 'Offline Outage', value: offline, color: '#ef4444' },
      { name: 'Spare Port', value: spare, color: '#64748b' },
    ];
  }, [cameras]);

  // Aggregate latency distribution
  const latencyBuckets = useMemo(() => {
    let fast = 0; // < 40ms
    let normal = 0; // 40-100ms
    let slow = 0; // > 100ms
    let inactive = 0;

    cameras.forEach((cam) => {
      if (cam.is_no_cam || cam.status !== 'ONLINE') {
        inactive++;
        return;
      }
      const lat = cam.latency_ms || 0;
      if (lat < 40) fast++;
      else if (lat <= 100) normal++;
      else slow++;
    });

    return [
      { label: '< 40ms (Optimal)', count: fast, color: '#10b981' },
      { label: '40-100ms (Good)', count: normal, color: '#38bdf8' },
      { label: '> 100ms (High)', count: slow, color: '#f59e0b' },
      { label: 'Offline / Spare', count: inactive, color: '#64748b' },
    ];
  }, [cameras]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* 1. NVR Bay Channel Capacity Allocation (Stacked Bar) */}
      <Card className="lg:col-span-2 border-border/80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold tracking-wide">
                NVR Bay Capacity & Channel Health Distribution
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {nvrChartData.length} Recorders
            </Badge>
          </div>
          <CardDescription>
            Channel allocation showing active streaming, offline outages, and spare provisioning per rack bay
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nvrChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="nvr"
                  stroke="currentColor"
                  className="text-xs text-muted-foreground"
                  tickLine={false}
                  fontSize={11}
                />
                <YAxis
                  stroke="currentColor"
                  className="text-xs text-muted-foreground"
                  tickLine={false}
                  fontSize={11}
                  domain={[0, 32]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--card-foreground))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar dataKey="online" name="Online" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="offline" name="Offline" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="spare" name="Spare (No Cam)" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Fleet Status Ratio & Latency Telemetry */}
      <Card className="border-border/80 flex flex-col justify-between">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold tracking-wide">
                Fleet Proportions
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              270 Channels
            </Badge>
          </div>
          <CardDescription>
            Ratio of operational vs down vs spare
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pb-2">
          <div className="h-[140px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--card-foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Latency profile pill list */}
          <div className="w-full mt-2 space-y-1.5 border-t border-border/60 pt-3">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 uppercase tracking-wider mb-1">
              <Cpu className="w-3 h-3 text-primary" />
              <span>Ping Latency Profile</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {latencyBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="flex items-center justify-between p-1.5 rounded bg-muted/40 border border-border/50 text-[11px]"
                >
                  <span className="text-muted-foreground truncate">{bucket.label.split(' ')[0]}</span>
                  <span className="font-bold text-foreground">{bucket.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
