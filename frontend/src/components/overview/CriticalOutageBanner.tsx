import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Incident, Camera } from '@/lib/types';

interface CriticalOutageBannerProps {
  activeIncidents: Incident[];
  onNavigateToIncidents?: () => void;
  onAcknowledge?: (incidentId: number) => Promise<void>;
  onInspectCamera?: (camera: Camera) => void;
  cameras?: Camera[];
}

export const CriticalOutageBanner: React.FC<CriticalOutageBannerProps> = ({
  activeIncidents,
  onNavigateToIncidents,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastCount, setLastCount] = useState(activeIncidents.length);

  // If incident count increases, automatically reset dismissed status so newly dropped cameras notify operator
  if (activeIncidents.length > lastCount) {
    setIsDismissed(false);
    setLastCount(activeIncidents.length);
  } else if (activeIncidents.length < lastCount) {
    setLastCount(activeIncidents.length);
  }

  if (activeIncidents.length === 0 || isDismissed) {
    return null;
  }

  const affectedNvrs = new Set(
    activeIncidents.map((inc) => inc.dvr_nvr_name).filter(Boolean)
  );
  const nvrCount = affectedNvrs.size;
  const camCount = activeIncidents.length;

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg border border-red-500/30 bg-red-950/20 text-xs text-foreground mb-4 shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 rounded-md bg-red-500/15 text-red-400 shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div className="truncate">
          <span className="font-semibold text-red-400 mr-2">
            Fleet Outage:
          </span>
          <span className="text-muted-foreground">
            {camCount} camera{camCount === 1 ? '' : 's'} offline
            {nvrCount > 0 && ` across ${nvrCount} NVR${nvrCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onNavigateToIncidents && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium text-red-300 hover:text-white hover:bg-red-500/20 gap-1"
            onClick={onNavigateToIncidents}
          >
            <span>View Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-red-500/10 rounded-full"
          onClick={() => setIsDismissed(true)}
          title="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
