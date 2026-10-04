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
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50/95 dark:bg-red-950/40 text-xs shadow-sm mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="truncate">
          <span className="font-bold text-red-800 dark:text-red-300 mr-2">
            Fleet Outage:
          </span>
          <span className="font-medium text-red-700 dark:text-red-200">
            {camCount} camera{camCount === 1 ? '' : 's'} offline
            {nvrCount > 0 && ` across ${nvrCount} NVR${nvrCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onNavigateToIncidents && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-semibold text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 bg-white/80 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-900 dark:hover:text-white gap-1 transition-colors"
            onClick={onNavigateToIncidents}
          >
            <span>View Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-400 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-200 dark:hover:bg-red-900/50 rounded-full transition-colors"
          onClick={() => setIsDismissed(true)}
          title="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
