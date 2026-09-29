import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { useCameraFleet } from './hooks/useCameraFleet';
import { TopNavbar } from './components/layout/TopNavbar';
import { FleetDashboardView } from './components/dashboard/FleetDashboardView';
import { FleetMatrixView } from './components/matrix/FleetMatrixView';
import { IncidentCommandView } from './components/incidents/IncidentCommandView';
import { CameraInventoryView } from './components/inventory/CameraInventoryView';
import { AdminPanelView } from './components/admin/AdminPanelView';
import { CameraDrawer } from './components/drawer/CameraDrawer';
import { Loader2, AlertCircle } from 'lucide-react';

const MainFleetApp: React.FC = () => {
  const {
    cameras,
    nvrs,
    nvrGroups,
    activeIncidents,
    incidentHistory,
    summary,
    isLoading,
    error,
    sseStatus,
    lastHeartbeat,
    activeTab,
    setActiveTab,
    selectedNvrFilter,
    setSelectedNvrFilter,
    selectedCamera,
    setSelectedCamera,
    soundEnabled,
    toggleSound,
    isDarkMode,
    toggleDarkMode,
    refreshFleet,
    ackIncident,
    manualCheckCamera,
    toggleSparePort,
  } = useCameraFleet();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/20">
      {/* 1. Sticky Full-Width Top Navigation Bar */}
      <TopNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeIncidentCount={activeIncidents.length}
        sseStatus={sseStatus}
        lastHeartbeat={lastHeartbeat}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onRefresh={refreshFleet}
      />

      {/* 2. Main Content Container */}
      <main className="flex-1 w-full max-w-[1680px] mx-auto p-4 md:p-6 lg:p-8">
        {/* Error notification if API unreachable */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Backend Communication Notice:</span> {error}.
              Make sure the FastAPI server is running on port 8000.
            </div>
          </div>
        )}

        {/* Loading state on first load */}
        {isLoading && cameras.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-sm font-mono text-muted-foreground">
              Connecting to CCTV Fleet Stream (270 Channels)...
            </div>
          </div>
        ) : (
          <>
            {/* View Switcher based on TopNavbar Tab */}
            {activeTab === 'dashboard' && (
              <FleetDashboardView
                cameras={cameras}
                nvrs={nvrs}
                nvrGroups={nvrGroups}
                summary={summary}
                activeIncidents={activeIncidents}
                onSelectCamera={(cam) => setSelectedCamera(cam)}
                onAcknowledgeIncident={ackIncident}
                onNavigateToMatrix={(nvrName) => {
                  if (nvrName) setSelectedNvrFilter(nvrName);
                  setActiveTab('matrix');
                }}
              />
            )}

            {activeTab === 'matrix' && (
              <FleetMatrixView
                cameras={cameras}
                nvrs={nvrs}
                nvrGroups={nvrGroups}
                onSelectCamera={(cam) => setSelectedCamera(cam)}
                onQuickPingCamera={(cam) => manualCheckCamera(cam.id)}
                selectedNvrFilter={selectedNvrFilter}
                onNvrFilterChange={(nvr) => setSelectedNvrFilter(nvr)}
              />
            )}

            {activeTab === 'incidents' && (
              <IncidentCommandView
                activeIncidents={activeIncidents}
                incidentHistory={incidentHistory}
                cameras={cameras}
                onAcknowledge={ackIncident}
                onInspectCamera={(cam) => setSelectedCamera(cam)}
              />
            )}

            {activeTab === 'inventory' && (
              <CameraInventoryView
                cameras={cameras}
                onRefresh={refreshFleet}
                onInspectCamera={(cam) => setSelectedCamera(cam)}
              />
            )}

            {activeTab === 'admin' && (
              <AdminPanelView onFleetReload={refreshFleet} />
            )}
          </>
        )}
      </main>

      {/* 3. Sliding Inspection Drawer (Shadcn Sheet) */}
      <CameraDrawer
        camera={selectedCamera}
        isOpen={selectedCamera !== null}
        onClose={() => setSelectedCamera(null)}
        onManualCheck={manualCheckCamera}
        onToggleSpare={toggleSparePort}
        onUpdateCamera={(updated) => setSelectedCamera(updated)}
      />

      {/* 4. Bottom System Status Footer */}
      <footer className="w-full border-t border-border/60 py-3 px-4 md:px-6 bg-muted/20 text-muted-foreground text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>CCTV Health Monitor v2.0 • Vite + React + Shadcn UI</span>
          <span>•</span>
          <span>270-Channel High Density Fleet</span>
        </div>
        <div className="font-mono text-[11px]">
          {summary.online} Online / {summary.offline} Offline / {summary.noCam} Spare ({summary.healthPercent}% Operational)
        </div>
      </footer>
    </div>
  );
};

const AppGatekeeper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <div className="text-sm font-mono text-muted-foreground">
          Authenticating Fleet Command Session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <MainFleetApp />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppGatekeeper />
    </AuthProvider>
  );
};

export default App;
