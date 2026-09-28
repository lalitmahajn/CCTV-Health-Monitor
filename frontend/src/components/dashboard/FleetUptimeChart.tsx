import React, { useEffect, useState, useId } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Activity, ShieldCheck, Loader2, HelpCircle, ArrowDownRight } from 'lucide-react';
import { fetchFleetUptimeHistory } from '@/lib/api';
import type { FleetUptimeHistoryResponse, UptimeDataPoint, UptimePeriod } from '@/lib/types';

interface FleetUptimeChartProps {
  currentOnlineCount?: number;
  activeProvisionedCount?: number;
  sparePortsCount?: number;
}

const PERIOD_PRESETS: { key: UptimePeriod; label: string }[] = [
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
];

export const FleetUptimeChart: React.FC<FleetUptimeChartProps> = ({
  currentOnlineCount,
  activeProvisionedCount,
  sparePortsCount = 0,
}) => {
  const [period, setPeriod] = useState<UptimePeriod>('24h');
  const [history, setHistory] = useState<FleetUptimeHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const gradientId = useId();

  const loadData = React.useCallback(async (p: UptimePeriod) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchFleetUptimeHistory(p);
      setHistory(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load telemetry history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(period);
  }, [period, loadData]);

  const totalActive = activeProvisionedCount ?? history?.total_provisioned ?? 0;
  const currentOperating = currentOnlineCount ?? history?.summary.current_operating ?? 0;
  const minOperating = history?.summary.min_operating ?? currentOperating;
  const currentOffline = Math.max(0, totalActive - currentOperating);

  // Sync latest live operating count into the dataset
  const chartData = React.useMemo(() => {
    if (!history?.data_points) return [];
    const points = history.data_points.map((pt) => ({
      ...pt,
      total: totalActive,
      offline: Math.max(0, totalActive - pt.operating),
    }));

    if (points.length > 0 && currentOnlineCount !== undefined) {
      const last = points[points.length - 1];
      points[points.length - 1] = {
        ...last,
        operating: currentOperating,
        offline: currentOffline,
        total: totalActive,
      };
    }
    return points;
  }, [history, currentOnlineCount, currentOperating, currentOffline, totalActive]);

  const uptimePct = totalActive > 0 
    ? ((currentOperating / totalActive) * 100).toFixed(1) 
    : '100.0';

  // Calculate dynamic domain so the benchmark line is clearly visible with headroom
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d) => d.operating)) : totalActive;
  const yDomainMin = Math.max(0, Math.floor(Math.min(minVal, totalActive) - 5));
  const yDomainMax = Math.ceil(totalActive + 5);

  return (
    <Card className="w-full border-border/80 bg-card shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Fleet Operational Capacity Trend
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              {uptimePct}% Active Uptime
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 rounded-full bg-emerald-500 inline-block" />
              Operating Cameras
            </span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-b-2 border-dashed border-zinc-400 inline-block" />
              Active Baseline ({totalActive} Target Cameras)
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-muted-foreground/80">
              {sparePortsCount} spare ports excluded from stats
            </span>
          </div>
        </div>

        {/* Extended Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
          {PERIOD_PRESETS.map(({ key, label }) => (
            <Button
              key={key}
              variant={period === key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(key)}
              className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
                period === key
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {/* KPI Strip without confusing averages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-3 bg-muted/30 rounded-lg border border-border/50 text-xs">
          <div>
            <div className="text-muted-foreground text-[11px]">Currently Operating</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-baseline gap-1">
              <span className="text-emerald-400">{currentOperating}</span>
              <span className="text-muted-foreground text-xs font-normal">/ {totalActive} Active</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {currentOffline === 0 ? '100% operational coverage' : `${currentOffline} cameras offline`}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-[11px]">Target Baseline</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>{totalActive} Cameras</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Benchmark line on graph
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-[11px]">Lowest Recorded</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400">{minOperating}</span>
              <span className="text-muted-foreground text-xs font-normal">cams</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Deepest dip in {period} window
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-[11px]">Spare / Unassigned</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>{sparePortsCount} Ports</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Not counted in active uptime
            </div>
          </div>
        </div>

        {/* Chart View */}
        {isLoading && !history ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading telemetry history...</span>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center text-destructive text-xs gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => loadData(period)}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  dy={8}
                />
                <YAxis
                  stroke="#71717a"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  domain={[yDomainMin, yDomainMax]}
                  tickCount={5}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as UptimeDataPoint;
                      const op = data.operating;
                      const tot = totalActive;
                      const off = Math.max(0, tot - op);
                      const pct = tot > 0 ? ((op / tot) * 100).toFixed(1) : '100.0';

                      return (
                        <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-2 min-w-[190px]">
                          <div className="font-semibold text-foreground border-b border-border/50 pb-1.5 text-[11px] text-muted-foreground">
                            {data.label}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Operating:
                              </span>
                              <span className="font-bold text-emerald-400">{op} Active</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 border-b-2 border-dashed border-zinc-400 inline-block" />
                                Target Baseline:
                              </span>
                              <span className="font-medium text-zinc-300">{tot}</span>
                            </div>
                            {off > 0 && (
                              <div className="flex items-center justify-between text-red-400">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                  Offline:
                                </span>
                                <span className="font-medium">{off}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                              <span>Fleet Health:</span>
                              <span className="font-semibold text-foreground">{pct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={totalActive}
                  stroke="#a1a1aa"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Target Baseline: ${totalActive} Active Cameras`,
                    position: 'top',
                    fill: '#d4d4d8',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="operating"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', stroke: '#09090b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
