import React from 'react';
import { Video, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FleetSummary } from '@/lib/types';

interface SummaryMetricsProps {
  summary: FleetSummary;
  onFilterStatus?: (status: string | null) => void;
  activeFilter?: string | null;
}

export const SummaryMetrics: React.FC<SummaryMetricsProps> = ({
  summary,
  onFilterStatus,
  activeFilter,
}) => {
  const cards = [
    {
      id: 'TOTAL',
      title: 'Total Channels',
      value: summary.total,
      subtext: `${summary.online} active · ${summary.noCam} spare slots`,
      icon: Video,
      isActive: activeFilter === null || activeFilter === 'ALL',
      filterValue: null,
      highlight: null,
    },
    {
      id: 'ONLINE',
      title: 'Online Operational',
      value: summary.online,
      subtext: `${summary.healthPercent}% operational health`,
      icon: CheckCircle2,
      isActive: activeFilter === 'ONLINE',
      filterValue: 'ONLINE',
      highlight: 'text-emerald-500',
    },
    {
      id: 'OFFLINE',
      title: 'Offline Critical',
      value: summary.offline,
      subtext: summary.offline > 0
        ? `${summary.activeIncidents} active alert${summary.activeIncidents === 1 ? '' : 's'}`
        : 'All systems operating normally',
      icon: AlertOctagon,
      isActive: activeFilter === 'OFFLINE',
      filterValue: 'OFFLINE',
      highlight: summary.offline > 0 ? 'text-destructive' : null,
    },
    {
      id: 'NO_CAM',
      title: 'Spare Ports',
      value: summary.noCam,
      subtext: 'Unassigned recorder slots',
      icon: HelpCircle,
      isActive: activeFilter === 'NO_CAM',
      filterValue: 'NO_CAM',
      highlight: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.id}
            onClick={() => onFilterStatus && onFilterStatus(c.filterValue)}
            className={cn(
              "cursor-pointer transition-colors hover:bg-muted/50",
              c.isActive && "ring-1 ring-ring border-foreground/20"
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {c.title}
              </CardTitle>
              <Icon className={cn("h-4 w-4 text-muted-foreground", c.highlight)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {c.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
