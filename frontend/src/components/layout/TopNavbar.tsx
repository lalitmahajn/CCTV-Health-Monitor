import React, { useState } from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  LayoutGrid,
  AlertTriangle, 
  Server, 
  Settings, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  RotateCw, 
  RefreshCcw,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActiveTab } from '@/hooks/useCameraFleet';
import type { SSEConnectionStatus } from '@/hooks/useSSELiveStream';
import * as api from '@/lib/api';

interface TopNavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeIncidentCount: number;
  sseStatus: SSEConnectionStatus;
  lastHeartbeat: Date | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onRefresh: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  onTabChange,
  activeIncidentCount,
  sseStatus,
  lastHeartbeat,
  soundEnabled,
  onToggleSound,
  isDarkMode,
  onToggleDarkMode,
  onRefresh,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const handleScanAll = async () => {
    try {
      setIsScanning(true);
      setScanMessage(null);
      await api.triggerFullFleetScan();
      setScanMessage('Scan triggered');
      setTimeout(() => setScanMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      setScanMessage(msg);
      setTimeout(() => setScanMessage(null), 4000);
    } finally {
      setIsScanning(false);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'Fleet Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 mr-1.5" />,
    },
    {
      id: 'matrix',
      label: 'DVR/NVR Channels',
      icon: <LayoutGrid className="w-4 h-4 mr-1.5" />,
    },
    {
      id: 'incidents',
      label: 'Incident Command',
      icon: <AlertTriangle className="w-4 h-4 mr-1.5" />,
      badge: activeIncidentCount,
    },
    {
      id: 'inventory',
      label: 'Camera Inventory',
      icon: <Server className="w-4 h-4 mr-1.5" />,
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: <Settings className="w-4 h-4 mr-1.5" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center px-4 md:px-6 justify-between gap-4">
        {/* Left: Branding & Real-time SSE Beacon */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-foreground text-base md:text-lg">
                CCTV FLEET MATRIX
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                270-CH
              </span>
            </div>
            {/* Live SSE Status Beacon */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <Radio
                className={`w-3 h-3 ${
                  sseStatus === 'connected'
                    ? 'text-emerald-500 animate-pulse'
                    : sseStatus === 'connecting'
                    ? 'text-amber-500 animate-spin'
                    : 'text-red-500'
                }`}
              />
              <span
                className={
                  sseStatus === 'connected'
                    ? 'text-emerald-500 font-semibold'
                    : sseStatus === 'connecting'
                    ? 'text-amber-500'
                    : 'text-red-500'
                }
              >
                {sseStatus === 'connected'
                  ? 'LIVE SSE'
                  : sseStatus === 'connecting'
                  ? 'RECONNECTING...'
                  : 'DISCONNECTED'}
              </span>
              {lastHeartbeat && (
                <span className="text-muted-foreground text-[10px] hidden sm:inline">
                  • {lastHeartbeat.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Full Horizontal Top Navigation Tabs */}
        <nav className="flex items-center space-x-1 border border-border/60 bg-muted/30 p-1 rounded-lg">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative flex items-center px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant="danger"
                    className="ml-2 px-1.5 py-0 text-[10px] h-4 min-w-[16px] justify-center animate-pulse"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Quick actions, Sound toggle, Dark mode & Manual Refresh */}
        <div className="flex items-center gap-2">
          {scanMessage && (
            <span className="text-xs text-primary font-mono hidden md:inline animate-fade-in">
              {scanMessage}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleScanAll}
            disabled={isScanning}
            className="hidden sm:inline-flex text-xs h-8 gap-1.5"
            title="Trigger concurrent ping and health scan across all 270 cameras"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-primary' : ''}`} />
            <span>Scan Fleet</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSound}
            title={soundEnabled ? 'Audio alerts enabled (Click to mute)' : 'Audio alerts muted (Click to unmute)'}
            className={soundEnabled ? 'text-foreground' : 'text-muted-foreground line-through'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            title="Refresh fleet data"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
