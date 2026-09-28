import React, { useEffect, useState, useId } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
import { Activity, ShieldCheck, Loader2 } from 'lucide-react';
import { fetchFleetUptimeHistory } from '@/lib/api';
import type { FleetUptimeHistoryResponse, UptimeDataPoint } from '@/lib/types';

interface FleetUptimeChartProps {
  currentOnlineCount?: number;
  totalCamerasCount?: number;
}

export const FleetUptimeChart: React.FC<FleetUptimeChartProps> = ({
  currentOnlineCount,
  totalCamerasCount,
}) => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [history, setHistory] = useState<FleetUptimeHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const gradientId = useId();

  const loadData = React.useCallback(async (p: '24h' | '7d' | '30d') => {
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

  // If live props change, keep the latest data point synced
  const chartData = React.useMemo(() => {
    if (!history?.data_points) return [];
    const points = [...history.data_points];
    if (points.length > 0 && currentOnlineCount !== undefined) {
      const last = points[points.length - 1];
      points[points.length - 1] = {
        ...last,
        operating: currentOnlineCount,
        offline: Math.max(0, (totalCamerasCount ?? last.total) - currentOnlineCount),
        total: totalCamerasCount ?? last.total,
      };
    }
    return points;
  }, [history, currentOnlineCount, totalCamerasCount]);

  const totalProvisioned = totalCamerasCount ?? history?.total_provisioned ?? 270;
  const currentOperating = currentOnlineCount ?? history?.summary.current_operating ?? 0;
  const minOperating = history?.summary.min_operating ?? currentOperating;
  const maxOperating = history?.summary.max_operating ?? currentOperating;
  const avgOperating = history?.summary.avg_operating ?? currentOperating;
  const uptimePct = totalProvisioned > 0 
    ? ((currentOperating / totalProvisioned) * 100).toFixed(1) 
    : '100.0';

  // Calculate dynamic domain to keep chart looking informative and responsive to dips
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d) => d.operating)) : 0;
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.operating)) : totalProvisioned;
  const yDomainMin = Math.max(0, Math.floor(minVal - Math.max(5, (maxVal - minVal) * 0.3)));
  const yDomainMax = Math.min(totalProvisioned + 4, Math.ceil(maxVal + 3));

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
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Historical count of simultaneously transmitting cameras across all 17 recorder bays.
          </CardDescription>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
          {(['24h', '7d', '30d'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(p)}
              className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
              }`}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-3 bg-muted/30 rounded-lg border border-border/50 text-xs">
          <div>
            <div className="text-muted-foreground text-[11px]">Currently Operating</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-baseline gap-1">
              <span className="text-emerald-400">{currentOperating}</span>
              <span className="text-muted-foreground text-xs font-normal">/ {totalProvisioned}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">Period Average</div>
            <div className="text-base font-bold text-foreground mt-0.5">
              {avgOperating} <span className="text-muted-foreground text-xs font-normal">cams</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">Period Min / Max</div>
            <div className="text-base font-bold text-foreground mt-0.5">
              <span className="text-amber-400">{minOperating}</span>
              <span className="text-muted-foreground mx-1 font-normal">•</span>
              <span className="text-foreground">{maxOperating}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">Fleet Provisioned</div>
            <div className="text-base font-bold text-foreground mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>{totalProvisioned} Channels</span>
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
              <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
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
                      const off = data.offline;
                      const tot = data.total;
                      const pct = tot > 0 ? ((op / tot) * 100).toFixed(1) : '100.0';

                      return (
                        <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs space-y-2 min-w-[170px]">
                          <div className="font-semibold text-foreground border-b border-border/50 pb-1.5 text-[11px] text-muted-foreground">
                            {data.label}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Operating:
                              </span>
                              <span className="font-bold text-emerald-400">{op}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                Offline:
                              </span>
                              <span className="font-medium text-red-400">{off}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                              <span>Coverage:</span>
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
                  y={totalProvisioned}
                  stroke="#71717a"
                  strokeDasharray="4 4"
                  strokeWidth={1}
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
