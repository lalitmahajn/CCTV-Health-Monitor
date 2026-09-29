import React, { useState } from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  LayoutGrid,
  AlertTriangle, 
  Server, 
  Shield,
  LogOut,
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  RotateCw, 
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ActiveTab } from '@/hooks/useCameraFleet';
import type { SSEConnectionStatus } from '@/hooks/useSSELiveStream';
import * as api from '@/lib/api';
import { useTimeFormat, formatTime } from '@/lib/timeUtils';
import { useAuth } from '@/context/AuthContext';

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
  const [timeFormat] = useTimeFormat();
  const { user, logout } = useAuth();

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
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    },
    {
      id: 'matrix',
      label: 'DVR/NVR Matrix',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
    },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      badge: activeIncidentCount,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Server className="w-3.5 h-3.5" />,
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: <Shield className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6 justify-between gap-4">
        {/* Left: Branding & Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">
              CCTV Monitor
            </span>
            <div 
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/80 text-[10px] font-mono text-muted-foreground"
              title={lastHeartbeat ? `Heartbeat: ${formatTime(lastHeartbeat, timeFormat, true)}` : undefined}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                sseStatus === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-destructive"
              )} />
              <span>{sseStatus === 'connected' ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* Center: Official Radix Tabs for Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => onTabChange(val as ActiveTab)}
          className="hidden md:block"
        >
          <TabsList className="h-8 bg-muted/60 p-0.5">
            {navItems.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="text-xs gap-1.5 px-3 h-7 data-[state=active]:shadow-xs"
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 px-1 py-0 text-[10px] h-3.5 min-w-[14px] justify-center"
                  >
                    {item.badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Mobile Navigation fallback */}
        <div className="flex md:hidden items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onTabChange(item.id)}
            >
              {item.icon}
            </Button>
          ))}
        </div>

        {/* Right: Actions & Tools */}
        <div className="flex items-center gap-1.5">
          {scanMessage && (
            <span className="text-xs text-muted-foreground mr-1 animate-fade-in hidden lg:inline">
              {scanMessage}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleScanAll}
            disabled={isScanning}
            className="hidden sm:inline-flex text-xs h-8 gap-1.5"
          >
            <RotateCw className={cn("w-3.5 h-3.5", isScanning && "animate-spin")} />
            <span>Scan Fleet</span>
          </Button>

          <TooltipProvider delayDuration={150}>
            {/* Audio Alarm Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleSound}
                  className="h-8 w-8"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-foreground" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{soundEnabled ? 'Mute audio alarms' : 'Enable audio alarms'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Dark Mode Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleDarkMode}
                  className="h-8 w-8"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  ) : (
                    <Moon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isDarkMode ? 'Switch to Light' : 'Switch to Dark'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Refresh Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRefresh}
                  className="h-8 w-8"
                >
                  <RefreshCcw className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Refresh fleet data</p>
              </TooltipContent>
            </Tooltip>

            {/* User Badge & Logout */}
            {user && (
              <div className="flex items-center gap-1.5 border-l border-border/60 pl-2 ml-1">
                <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 text-[11px] h-7 font-mono font-medium border-border/80">
                  <Shield className="w-3 h-3 text-primary" />
                  <span>{user.username}</span>
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={logout}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Log out of Fleet Command</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
};
