import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Check, 
  History, 
  ShieldAlert, 
  Search 
} from 'lucide-react';
import type { Incident, Camera } from '@/lib/types';

interface IncidentCommandViewProps {
  activeIncidents: Incident[];
  incidentHistory: Incident[];
  cameras: Camera[];
  onAcknowledge: (incidentId: number) => Promise<void>;
  onInspectCamera: (camera: Camera) => void;
}

export const IncidentCommandView: React.FC<IncidentCommandViewProps> = ({
  activeIncidents,
  incidentHistory,
  cameras,
  onAcknowledge,
  onInspectCamera,
}) => {
  const [filterMode, setFilterMode] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [search, setSearch] = useState('');

  const cameraMap = new Map<number, Camera>(cameras.map((c) => [c.id, c]));

  const currentList = filterMode === 'ACTIVE' ? activeIncidents : incidentHistory;

  const filteredList = currentList.filter((inc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = inc.camera_name.toLowerCase().includes(q);
    const nvrMatch = (inc.dvr_nvr_name || '').toLowerCase().includes(q);
    const reasonMatch = (inc.error_reason || '').toLowerCase().includes(q);
    return nameMatch || nvrMatch || reasonMatch;
  });

  const formatDuration = (seconds?: number | null, startedAt?: string) => {
    if (seconds !== undefined && seconds !== null) {
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const remSec = seconds % 60;
      return `${mins}m ${remSec}s`;
    }
    if (startedAt) {
      const elapsedSec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      if (elapsedSec < 60) return `${elapsedSec}s`;
      const mins = Math.floor(elapsedSec / 60);
      return `${mins}m`;
    }
    return '--';
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Incident Command & Alarm Log
              {activeIncidents.length > 0 && (
                <Badge variant="danger" className="font-mono text-xs">
                  {activeIncidents.length} Unresolved
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time audit log of hardware disconnects, RTSP socket drops, and operator acknowledgments
            </p>
          </div>
        </div>

        {/* Tab Toggle: Active vs Resolved History */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => setFilterMode('ACTIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterMode === 'ACTIVE'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span>Active Outages ({activeIncidents.length})</span>
          </button>
          <button
            onClick={() => setFilterMode('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterMode === 'HISTORY'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-500" />
            <span>Resolved History ({incidentHistory.length})</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter incidents by camera name, NVR, or failure reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Incident List */}
      <Card>
        <CardHeader className="p-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold tracking-tight">
              {filterMode === 'ACTIVE' ? 'Active Alarm Queue' : 'Historical Outage Records'}
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredList.length} records
            </span>
          </div>
          <CardDescription className="text-xs">
            {filterMode === 'ACTIVE'
              ? 'Incidents requiring field inspection or operator verification'
              : 'Recovered cameras with recorded downtime duration and resolution timestamp'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs font-mono">
              {filterMode === 'ACTIVE'
                ? '✓ No active camera outages! All operational channels are communicating normally.'
                : 'No historical outage records found matching your search.'}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredList.map((incident) => {
                const associatedCam = cameraMap.get(incident.camera_id);
                const isAcked = Boolean(incident.is_acknowledged);

                return (
                  <div
                    key={incident.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {filterMode === 'ACTIVE' ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {incident.camera_name}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            [{incident.dvr_nvr_name || 'NVR'} • CH-{incident.channel_no || '--'}]
                          </span>
                          {filterMode === 'ACTIVE' ? (
                            isAcked ? (
                              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] h-5">
                                Acknowledged
                              </Badge>
                            ) : (
                              <Badge variant="danger" className="text-[10px] h-5 animate-pulse">
                                Unacknowledged
                              </Badge>
                            )
                          ) : (
                            <Badge variant="success" className="text-[10px] h-5">
                              Resolved
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-red-400 font-mono mt-0.5">
                          {incident.error_reason || 'RTSP Handshake Timeout / Device Unreachable'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1.5 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary" />
                            Started: {new Date(incident.started_at).toLocaleString()}
                          </span>
                          {incident.resolved_at && (
                            <span>
                              Resolved: {new Date(incident.resolved_at).toLocaleString()}
                            </span>
                          )}
                          <span>
                            Downtime: {formatDuration(incident.duration_seconds, incident.started_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Incident Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {associatedCam && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => onInspectCamera(associatedCam)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </Button>
                      )}

                      {filterMode === 'ACTIVE' && (
                        isAcked ? (
                          <Badge variant="outline" className="h-8 px-2.5 text-xs text-muted-foreground gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Acknowledged</span>
                          </Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs gap-1 bg-red-600 hover:bg-red-700"
                            onClick={() => onAcknowledge(incident.id)}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Acknowledge</span>
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
