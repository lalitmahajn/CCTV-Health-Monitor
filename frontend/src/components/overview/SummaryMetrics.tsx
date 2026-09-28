import React from 'react';
import { Video, CheckCircle2, AlertOctagon, HelpCircle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      label: 'TOTAL CHANNELS',
      value: summary.total,
      subtext: `${summary.online} Active / ${summary.noCam} Spare`,
      icon: <Video className="w-5 h-5 text-primary" />,
      badge: (
        <Badge variant="outline" className="font-mono text-xs">
          Fleet Capacity
        </Badge>
      ),
      borderColor: 'hover:border-primary/50',
      isActive: activeFilter === null || activeFilter === 'ALL',
      filterValue: null,
    },
    {
      id: 'ONLINE',
      label: 'ONLINE OPERATIONAL',
      value: summary.online,
      subtext: `${summary.healthPercent}% Operational Health`,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      badge: (
        <Badge variant="success" className="font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {summary.healthPercent}%
        </Badge>
      ),
      borderColor: 'hover:border-emerald-500/50',
      isActive: activeFilter === 'ONLINE',
      filterValue: 'ONLINE',
    },
    {
      id: 'OFFLINE',
      label: 'OFFLINE CRITICAL',
      value: summary.offline,
      subtext: summary.offline > 0 
        ? `${summary.activeIncidents} Active Incident${summary.activeIncidents === 1 ? '' : 's'}` 
        : 'All systems normal',
      icon: <AlertOctagon className={`w-5 h-5 ${summary.offline > 0 ? 'text-red-500 animate-bounce' : 'text-muted-foreground'}`} />,
      badge: summary.offline > 0 ? (
        <Badge variant="danger" className="font-mono text-xs">
          {summary.offline} Down
        </Badge>
      ) : (
        <Badge variant="outline" className="font-mono text-xs text-emerald-500 border-emerald-500/30">
          Zero Outages
        </Badge>
      ),
      borderColor: summary.offline > 0 ? 'border-red-500/40 hover:border-red-500' : 'hover:border-red-500/30',
      isActive: activeFilter === 'OFFLINE',
      filterValue: 'OFFLINE',
    },
    {
      id: 'NO_CAM',
      label: 'SPARE / NO CAM',
      value: summary.noCam,
      subtext: 'Unassigned recorder slots',
      icon: <HelpCircle className="w-5 h-5 text-slate-400" />,
      badge: (
        <Badge variant="spare" className="font-mono text-xs">
          Provisioning
        </Badge>
      ),
      borderColor: 'hover:border-slate-500/40',
      isActive: activeFilter === 'NO_CAM',
      filterValue: 'NO_CAM',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <Card
          key={c.id}
          onClick={() => onFilterStatus && onFilterStatus(c.filterValue)}
          className={`cursor-pointer transition-all duration-150 ${c.borderColor} ${
            c.isActive ? 'ring-1 ring-primary/40 bg-accent/20' : 'hover:bg-muted/40'
          }`}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                {c.label}
              </span>
              {c.badge}
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground">
                {c.value}
              </span>
              <div className="p-1.5 rounded-md bg-muted/60">
                {c.icon}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 truncate flex items-center gap-1">
              <Activity className="w-3 h-3 text-muted-foreground/60 inline" />
              {c.subtext}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
