import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  KeyRound, 
  Key,
  Cpu, 
  Bell, 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Upload, 
  RotateCw, 
  Send,
  Lock,
  Terminal,
  FileSpreadsheet,
  Clock,
  HardDrive,
  Volume2,
  Eye,
  Sliders,
  Sparkles,
  FlaskConical,
  Save,
  BellRing,
  Calendar,
  AlertTriangle,
  Camera
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';
import { useTimeFormat, getTimezoneInfo, formatTime, type TimeFormat } from '../../lib/timeUtils';
import { soundManager } from '../../lib/audio';
import { cn } from '../../lib/utils';

interface AdminPanelViewProps {
  onFleetReload?: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onFleetReload }) => {
  const { user } = useAuth();

  // --- Sub-View Tabs ---
  const [activeSubTab, setActiveSubTab] = useState('account');

  // --- Account State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(user?.username || 'admin');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);
  const [accountStatus, setAccountStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Engine Settings State ---
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Time Format State & Live Preview Clock ---
  const [timeFormat, setTimeFormatState] = useTimeFormat();
  const [clockNow, setClockNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tzInfo = React.useMemo(() => getTimezoneInfo(), []);
  const liveTime12h = formatTime(clockNow, '12h', true);
  const liveTime24h = formatTime(clockNow, '24h', true);

  const handleTimeFormatChange = async (fmt: TimeFormat) => {
    setTimeFormatState(fmt);
    setSettings((prev) => ({ ...prev, time_format: fmt }));
    try {
      await api.updateSettings({ time_format: fmt });
    } catch (e) {
      console.warn('Could not persist time format:', e);
    }
  };

  // --- Alert Test & Save State ---
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [alertSaveStatus, setAlertSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [telegramSaveStatus, setTelegramSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [notificationSaveStatus, setNotificationSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingReportType, setTestingReportType] = useState<string | null>(null);
  const [reportTestStatus, setReportTestStatus] = useState<{ [key: string]: { type: 'success' | 'error'; message: string } }>({});

  // --- NVR Bay Renaming State ---
  const [nvrOldName, setNvrOldName] = useState('NVR 01');
  const [nvrNewName, setNvrNewName] = useState('');
  const [isRenamingNvr, setIsRenamingNvr] = useState(false);
  const [renameStatus, setRenameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Fleet Maintenance & Simulator State ---
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [isRefreshingSnapshots, setIsRefreshingSnapshots] = useState(false);
  const [snapshotRefreshStatus, setSnapshotRefreshStatus] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUsername, setCsvUsername] = useState('');
  const [csvPassword, setCsvPassword] = useState('');
  const [csvOverride, setCsvOverride] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<{ count?: number; errors?: string[] } | null>(null);
  const [isReSeedModalOpen, setIsReSeedModalOpen] = useState(false);
  const [reSeedConfirmText, setReSeedConfirmText] = useState('');
  const [isReSeeding, setIsReSeeding] = useState(false);
  const [isSeedingSimulator, setIsSeedingSimulator] = useState(false);
  const [simulatorStatus, setSimulatorStatus] = useState<string | null>(null);

  // --- Diagnostics & Audit State ---
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isDiagLoading, setIsDiagLoading] = useState(false);

  // Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsSettingsLoading(true);
        const data = await api.fetchSettings();
        setSettings(data);
        if (data.time_format === '12h' || data.time_format === '24h') {
          setTimeFormatState(data.time_format);
        }
      } catch (err: any) {
        setSettingsStatus({ type: 'error', message: err.message || 'Failed to load settings' });
      } finally {
        setIsSettingsLoading(false);
      }
    };
    loadSettings();
  }, [setTimeFormatState]);

  // Load Diagnostics & Audit Logs when tab selected
  useEffect(() => {
    if (activeSubTab === 'diagnostics') {
      loadDiagnosticsAndLogs();
    }
  }, [activeSubTab]);

  const loadDiagnosticsAndLogs = async () => {
    try {
      setIsDiagLoading(true);
      const [diag, logs] = await Promise.all([
        api.fetchDiagnostics(),
        api.fetchAuditLogs(50)
      ]);
      setDiagnostics(diag);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiagLoading(false);
    }
  };

  // --- Handlers ---

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountStatus(null);

    if (!currentPassword) {
      setAccountStatus({ type: 'error', message: 'Current password is required' });
      return;
    }
    if (!newUsername.trim()) {
      setAccountStatus({ type: 'error', message: 'New username cannot be empty' });
      return;
    }
    if (newPassword.length < 8) {
      setAccountStatus({ type: 'error', message: 'New password must be at least 8 characters long' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountStatus({ type: 'error', message: 'New password and confirmation do not match' });
      return;
    }

    try {
      setIsUpdatingCreds(true);
      const res = await api.updateAdminCredentials(currentPassword, newUsername.trim(), newPassword);
      setAccountStatus({ type: 'success', message: `Credentials successfully updated for user "${res.username}".` });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setAccountStatus({ type: 'error', message: err.message || 'Failed to update credentials' });
    } finally {
      setIsUpdatingCreds(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus(null);
    try {
      setIsSavingSettings(true);
      const payload: Record<string, string> = {
        ...settings,
        scan_interval: settings.ping_interval_seconds || settings.scan_interval || '30'
      };
      await api.updateSettings(payload);
      setSettingsStatus({ type: 'success', message: 'Settings successfully updated and applied to running engine' });
      if (onFleetReload) onFleetReload();
      setTimeout(() => setSettingsStatus(null), 4000);
    } catch (err: any) {
      setSettingsStatus({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertSaveStatus(null);
    try {
      setIsSavingSettings(true);
      await api.updateSettings(settings);
      setAlertSaveStatus({ type: 'success', message: 'Alert configuration saved and applied!' });
      if (onFleetReload) onFleetReload();
      setTimeout(() => setAlertSaveStatus(null), 4000);
    } catch (err: any) {
      setAlertSaveStatus({ type: 'error', message: err.message || 'Failed to save alert configuration' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveTelegramSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramSaveStatus(null);
    try {
      setIsSavingSettings(true);
      await api.updateSettings(settings);
      setTelegramSaveStatus({ type: 'success', message: 'Telegram configuration saved!' });
      if (onFleetReload) onFleetReload();
      setTimeout(() => setTelegramSaveStatus(null), 4000);
    } catch (err: any) {
      setTelegramSaveStatus({ type: 'error', message: err.message || 'Failed to save Telegram settings' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveNotificationCategories = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotificationSaveStatus(null);
    try {
      setIsSavingSettings(true);
      await api.updateSettings(settings);
      setNotificationSaveStatus({ type: 'success', message: 'Notification preferences saved and applied!' });
      if (onFleetReload) onFleetReload();
      setTimeout(() => setNotificationSaveStatus(null), 4000);
    } catch (err: any) {
      setNotificationSaveStatus({ type: 'error', message: err.message || 'Failed to save notification preferences' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestReport = async (reportType: string) => {
    setTestingReportType(reportType);
    try {
      const res = await api.testReport(reportType);
      setReportTestStatus(prev => ({
        ...prev,
        [reportType]: { type: 'success', message: res.message || 'Sample report sent!' }
      }));
      setTimeout(() => {
        setReportTestStatus(prev => {
          const next = { ...prev };
          delete next[reportType];
          return next;
        });
      }, 5000);
    } catch (err: any) {
      setReportTestStatus(prev => ({
        ...prev,
        [reportType]: { type: 'error', message: err.message || 'Failed to dispatch report' }
      }));
    } finally {
      setTestingReportType(null);
    }
  };

  const handleTestEmail = async () => {
    setEmailTestStatus(null);
    try {
      setIsTestingEmail(true);
      const res = await api.testSmtpSettings();
      setEmailTestStatus({ type: 'success', message: res.message });
      setTimeout(() => setEmailTestStatus(null), 6000);
    } catch (err: any) {
      setEmailTestStatus({ type: 'error', message: err.message || 'SMTP test failed' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleRenameNvr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nvrNewName.trim()) return;
    try {
      setIsRenamingNvr(true);
      setRenameStatus(null);
      const res = await api.renameNvr(nvrOldName.trim(), nvrNewName.trim());
      setRenameStatus({ type: 'success', message: `${res.message} (${res.cameras_updated} channels updated)` });
      setNvrNewName('');
      if (onFleetReload) onFleetReload();
      setTimeout(() => setRenameStatus(null), 4000);
    } catch (err: any) {
      setRenameStatus({ type: 'error', message: err.message || 'Rename failed' });
    } finally {
      setIsRenamingNvr(false);
    }
  };

  const handleTriggerFleetScan = async () => {
    try {
      setIsScanning(true);
      setScanStatus(null);
      await api.triggerFullFleetScan();
      setScanStatus('Full fleet rescan dispatched to background prober.');
      setTimeout(() => setScanStatus(null), 4000);
    } catch (err: any) {
      setScanStatus(`Failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTriggerSnapshotRefresh = async () => {
    try {
      setIsRefreshingSnapshots(true);
      setSnapshotRefreshStatus("Starting parallel snapshot refresh...");
      const res = await api.triggerBatchSnapshotRefresh();
      setSnapshotRefreshStatus(res.message || "Parallel snapshot refresh started...");

      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getSnapshotRefreshStatus();
          if (status.is_running) {
            setSnapshotRefreshStatus(
              `Processing: ${status.completed}/${status.total} cameras (${status.succeeded} updated, ${status.failed} offline)...`
            );
          } else {
            clearInterval(pollInterval);
            setIsRefreshingSnapshots(false);
            setSnapshotRefreshStatus(
              status.message || `Completed: ${status.succeeded} updated, ${status.failed} offline.`
            );
            setTimeout(() => setSnapshotRefreshStatus(null), 10000);
          }
        } catch {
          // ignore transient errors during polling
        }
      }, 1500);
    } catch (err: any) {
      setSnapshotRefreshStatus(`Failed: ${err.message}`);
      setIsRefreshingSnapshots(false);
      setTimeout(() => setSnapshotRefreshStatus(null), 5000);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    try {
      setIsImportingCsv(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', csvFile);
      if (csvUsername.trim()) {
        formData.append('default_username', csvUsername.trim());
      }
      if (csvPassword) {
        formData.append('default_password', csvPassword);
      }
      if (csvOverride) {
        formData.append('override_credentials', 'true');
      }

      const res = await fetch('/api/cameras/csv/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      setImportResult({ count: data.imported_count, errors: data.errors });
      if (onFleetReload) onFleetReload();
    } catch (err: any) {
      setImportResult({ errors: [err.message || 'CSV Import failed'] });
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleReSeedFleet = async () => {
    if (reSeedConfirmText !== 'CONFIRM') return;
    try {
      setIsReSeeding(true);
      const res = await fetch('/api/simulator/seed-270', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      setIsReSeedModalOpen(false);
      setReSeedConfirmText('');
      setScanStatus(`Fleet re-seeded: ${data.count || 270} channels.`);
      if (onFleetReload) onFleetReload();
    } catch (err: any) {
      alert(`Re-seed failed: ${err.message}`);
    } finally {
      setIsReSeeding(false);
    }
  };

  const handleSeedSimulator = async () => {
    if (!window.confirm('Warning: This will clear current camera data and generate 270 synthetic test cameras across 9 NVRs. Continue?')) {
      return;
    }
    try {
      setIsSeedingSimulator(true);
      setSimulatorStatus('Seeding 270 test cameras across 9 NVR bays...');
      const res = await fetch('/api/simulator/seed-270', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      setSimulatorStatus(`Success: ${data.message || '270 cameras provisioned'}`);
      if (onFleetReload) onFleetReload();
      setTimeout(() => setSimulatorStatus(null), 4000);
    } catch (err: any) {
      setSimulatorStatus(`Error: ${err.message || 'Seeding failed'}`);
    } finally {
      setIsSeedingSimulator(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin & System Control Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise single-gatekeeper configuration, engine telemetry tuning, alert channels, and recorder administration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-mono gap-1 border-primary/30 bg-primary/5">
            <Lock className="w-3 h-3 text-primary" />
            Authenticated as {user?.username || 'admin'}
          </Badge>
        </div>
      </div>

      {/* Sub-view Navigation Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="account" className="gap-2 py-2 text-xs">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Account & Security</span>
          </TabsTrigger>
          <TabsTrigger value="engine" className="gap-2 py-2 text-xs">
            <Cpu className="w-3.5 h-3.5" />
            <span>Engine Tuning</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 py-2 text-xs">
            <Bell className="w-3.5 h-3.5" />
            <span>Alert Channels</span>
          </TabsTrigger>
          <TabsTrigger value="fleet" className="gap-2 py-2 text-xs">
            <Database className="w-3.5 h-3.5" />
            <span>Fleet Operations</span>
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="gap-2 py-2 text-xs">
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics & Audit</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* 1. Account & Security Sub-View */}
        {/* ============================================================== */}
        <TabsContent value="account" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  Modify Admin Credentials
                </CardTitle>
                <CardDescription>
                  Update the primary administrator username and password. Changes require verifying your current password.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleUpdateCredentials}>
                <CardContent className="space-y-4">
                  {accountStatus && (
                    <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      accountStatus.type === 'success' 
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                    }`}>
                      {accountStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{accountStatus.message}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                    <Input
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Admin Username</label>
                    <Input
                      type="text"
                      placeholder="Enter new or existing username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                      <Input
                        type="password"
                        placeholder="Min 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Confirm New Password</label>
                      <Input
                        type="password"
                        placeholder="Re-type new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">Salted Bcrypt with AES Key Encryption</span>
                  <Button type="submit" disabled={isUpdatingCreds} className="gap-2">
                    {isUpdatingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Save Credentials
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Security Specifications
                </CardTitle>
                <CardDescription>Enterprise security safeguards active on this instance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Database-at-Rest Encryption
                  </div>
                  <p className="text-muted-foreground">
                    All RTSP URLs and third-party tokens in SQLite are encrypted with AES-256 Fernet tokens.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    HttpOnly Session Cookies
                  </div>
                  <p className="text-muted-foreground">
                    Authentication cookies are inaccessible to client-side scripts, mitigating cross-site scripting (XSS) risks.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    RTSP Credential Masking
                  </div>
                  <p className="text-muted-foreground">
                    Both username and passwords in camera URLs are masked across all UI views and public JSON responses.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* 2. Engine Tuning Sub-View */}
        {/* ============================================================== */}
        <TabsContent value="engine" className="mt-6 space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {settingsStatus && (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                settingsStatus.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-destructive/10 border border-destructive/30 text-destructive'
              }`}>
                {settingsStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{settingsStatus.message}</span>
              </div>
            )}

            {/* Core Engine Timing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  Two-Tier Health Engine Timing & Probing
                </CardTitle>
                <CardDescription>
                  Configure background polling cadence, RTSP stream handshake limits, and failure thresholds.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Fleet Scan Interval (seconds)</label>
                    <Input
                      type="number"
                      value={settings.ping_interval_seconds || settings.scan_interval || '30'}
                      onChange={(e) => setSettings({ ...settings, ping_interval_seconds: e.target.value, scan_interval: e.target.value })}
                      disabled={isSettingsLoading}
                      min="5"
                      max="300"
                    />
                    <p className="text-[11px] text-muted-foreground">Rest period between complete fleet monitoring cycles.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">RTSP Handshake Timeout (ms)</label>
                    <Input
                      type="number"
                      value={settings.socket_timeout_ms || '4500'}
                      onChange={(e) => setSettings({ ...settings, socket_timeout_ms: e.target.value })}
                      disabled={isSettingsLoading}
                      min="500"
                      max="10000"
                    />
                    <p className="text-[11px] text-muted-foreground">Max wait time for RTSP DESCRIBE response and NVR connection.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Consecutive Failure Threshold</label>
                    <Input
                      type="number"
                      value={settings.failure_threshold || '3'}
                      onChange={(e) => setSettings({ ...settings, failure_threshold: e.target.value })}
                      disabled={isSettingsLoading}
                      min="1"
                      max="10"
                    />
                    <p className="text-[11px] text-muted-foreground">Consecutive failed check cycles before declaring an OFFLINE incident.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Latency Warning Threshold (ms)</label>
                    <Input
                      type="number"
                      value={settings.latency_warning_threshold_ms || '2500'}
                      onChange={(e) => setSettings({ ...settings, latency_warning_threshold_ms: e.target.value })}
                      disabled={isSettingsLoading}
                      min="100"
                      max="5000"
                    />
                    <p className="text-[11px] text-muted-foreground">Response time threshold for marking stream as amber WARNING.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Max Concurrency per NVR</label>
                    <Input
                      type="number"
                      value={settings.max_concurrency_per_host || '2'}
                      onChange={(e) => setSettings({ ...settings, max_concurrency_per_host: e.target.value })}
                      disabled={isSettingsLoading}
                      min="1"
                      max="8"
                    />
                    <p className="text-[11px] text-muted-foreground">Throttles simultaneous RTSP probes per recorder to protect NVR CPU.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Snapshot Interval (seconds)</label>
                    <Input
                      type="number"
                      value={settings.snapshot_interval_seconds || '600'}
                      onChange={(e) => setSettings({ ...settings, snapshot_interval_seconds: e.target.value })}
                      disabled={isSettingsLoading}
                      min="60"
                      max="3600"
                    />
                    <p className="text-[11px] text-muted-foreground">Automated background grab interval. Use 'Update All Snapshots' in Fleet Operations.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature Flags & Computer Vision Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Engine Diagnostic Switches & Alarms
                </CardTitle>
                <CardDescription>
                  Configure UI audio alerts and view upcoming computer vision analysis features.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Audio Alert Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-primary" />
                        <span>Audio Alert Chime</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Audible sound alert upon camera outage detection
                      </div>
                    </div>
                    <Switch
                      checked={settings.enable_audio_alert !== 'false'}
                      onCheckedChange={(checked) => {
                        setSettings({ ...settings, enable_audio_alert: checked ? 'true' : 'false' });
                        soundManager.setEnabled(checked);
                      }}
                    />
                  </div>

                  {/* Black Screen Detection */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20 opacity-80">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Black Screen Detection</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal border-amber-500/40 text-amber-500 bg-amber-500/10">
                          Coming Soon
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Flag outages if captured frames are pure black
                      </div>
                    </div>
                    <Switch
                      disabled
                      checked={false}
                    />
                  </div>

                  {/* Frozen Frame Detection */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20 opacity-80">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Frozen Frame Detection</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal border-amber-500/40 text-amber-500 bg-amber-500/10">
                          Coming Soon
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Flag feeds when consecutive frames are identical
                      </div>
                    </div>
                    <Switch
                      disabled
                      checked={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time & Regional Display Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Time & Regional Display
                  </CardTitle>
                  <Badge variant="outline" className="text-[11px] font-mono border-border/60">
                    {tzInfo.offset} • {tzInfo.name}
                  </Badge>
                </div>
                <CardDescription>
                  Configure clock display and timestamp formatting across the fleet dashboard, uptime charts, and incident logs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 12-Hour Option */}
                  <button
                    type="button"
                    data-testid="time-format-12h"
                    onClick={() => handleTimeFormatChange('12h')}
                    className={cn(
                      "flex items-start justify-between p-4 rounded-lg border text-left cursor-pointer transition-all w-full",
                      timeFormat === '12h'
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40 shadow-xs"
                        : "border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <span>12-Hour Format</span>
                        {timeFormat === '12h' && (
                          <Badge variant="default" className="text-[9px] h-4 px-1.5 font-normal">Active</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Standard 12h clock with AM/PM indicator</div>
                      <div className="font-mono text-[11px] text-primary pt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Live Preview:</span>
                        <span className="font-semibold">{liveTime12h}</span>
                      </div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                      timeFormat === '12h' ? "border-primary bg-primary/10" : "border-muted-foreground/40"
                    )}>
                      {timeFormat === '12h' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </button>

                  {/* 24-Hour Option */}
                  <button
                    type="button"
                    data-testid="time-format-24h"
                    onClick={() => handleTimeFormatChange('24h')}
                    className={cn(
                      "flex items-start justify-between p-4 rounded-lg border text-left cursor-pointer transition-all w-full",
                      timeFormat === '24h'
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40 shadow-xs"
                        : "border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <span>24-Hour Format</span>
                        {timeFormat === '24h' && (
                          <Badge variant="default" className="text-[9px] h-4 px-1.5 font-normal">Active</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Industrial 24h standard (00:00 - 23:59)</div>
                      <div className="font-mono text-[11px] text-primary pt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Live Preview:</span>
                        <span className="font-semibold">{liveTime24h}</span>
                      </div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0",
                      timeFormat === '24h' ? "border-primary bg-primary/10" : "border-muted-foreground/40"
                    )}>
                      {timeFormat === '24h' && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Detected Client Timezone
                  </span>
                  <span className="font-mono font-medium text-foreground">{tzInfo.name} ({tzInfo.offset})</span>
                </div>
              </CardContent>
            </Card>

            <CardFooter className="flex justify-end border-t pt-4 px-0">
              <Button type="submit" disabled={isSavingSettings || isSettingsLoading} className="gap-2">
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                Save All Engine Settings
              </Button>
            </CardFooter>
          </form>
        </TabsContent>

        {/* ============================================================== */}
        {/* 3. Alert Notification Channels */}
        {/* ============================================================== */}
        <TabsContent value="alerts" className="mt-6 space-y-6">
          {/* SMTP Email Alert Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  SMTP Email Alert Dispatcher
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Email Alerts:</span>
                  <Switch
                    checked={settings.enable_email_alerts === 'true'}
                    onCheckedChange={(checked) => setSettings({ ...settings, enable_email_alerts: checked ? 'true' : 'false' })}
                  />
                  <Badge variant={settings.enable_email_alerts === 'true' ? 'default' : 'secondary'} className="text-[10px]">
                    {settings.enable_email_alerts === 'true' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                Configure automated email dispatch upon camera outage and incident resolution.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveAlertSettings}>
              <CardContent className="space-y-4">
                {alertSaveStatus && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    alertSaveStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  }`}>
                    {alertSaveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{alertSaveStatus.message}</span>
                  </div>
                )}

                {emailTestStatus && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    emailTestStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  }`}>
                    {emailTestStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{emailTestStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Server Host</label>
                    <Input
                      placeholder="e.g. smtp.gmail.com"
                      value={settings.smtp_host || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Port</label>
                    <Input
                      placeholder="587 or 465"
                      value={settings.smtp_port || '587'}
                      onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">587 = STARTTLS, 465 = SSL</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Username / Sender Email</label>
                    <Input
                      placeholder="alerts@company.com"
                      value={settings.smtp_user || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">SMTP Password / App Key</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={settings.smtp_password || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold">TLS Encryption</div>
                      <div className="text-[10px] text-muted-foreground">Secure STARTTLS handshake</div>
                    </div>
                    <Switch
                      checked={settings.smtp_use_tls !== 'false'}
                      onCheckedChange={(checked) => setSettings({ ...settings, smtp_use_tls: checked ? 'true' : 'false' })}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold">Recipient Email Addresses</label>
                    <Input
                      placeholder="it-alerts@company.com, cctv-ops@company.com"
                      value={settings.email_recipients || ''}
                      onChange={(e) => setSettings({ ...settings, email_recipients: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">Separate multiple recipients with commas.</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-4 sm:pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                  className="gap-2 text-xs"
                >
                  {isTestingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Test Email
                </Button>
                <div className="flex items-center gap-3 justify-end">
                  {alertSaveStatus && (
                    <span className={`text-xs flex items-center gap-1 font-medium ${
                      alertSaveStatus.type === 'success' ? 'text-emerald-500' : 'text-destructive'
                    }`}>
                      {alertSaveStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {alertSaveStatus.message}
                    </span>
                  )}
                  <Button type="submit" disabled={isSavingSettings} className="gap-2 text-xs min-w-[230px] justify-center">
                    {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Alert Configuration
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>

          {/* Email Notification Categories & Triggers Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-primary" />
                  Email Notification Categories & Triggers
                </CardTitle>
                <Badge variant="outline" className="text-xs w-fit">
                  7 Configurable Channels
                </Badge>
              </div>
              <CardDescription>
                Fine-tune which operational incidents, periodic reports, and escalation thresholds dispatch emails to configured recipients.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveNotificationCategories}>
              <CardContent className="space-y-6">
                {notificationSaveStatus && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    notificationSaveStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  }`}>
                    {notificationSaveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{notificationSaveStatus.message}</span>
                  </div>
                )}

                {/* 1. Real-Time Incident Notifications */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Activity className="w-3.5 h-3.5 text-amber-500" />
                    Real-Time Incident Notifications
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Outage Alert */}
                    <div className="flex items-start justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">Camera Outage Alerts</span>
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase">Real-Time</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Immediate email dispatch when a camera crosses consecutive failure thresholds and drops OFFLINE.
                        </p>
                      </div>
                      <Switch
                        checked={settings.notify_email_outage !== 'false'}
                        onCheckedChange={(checked) => setSettings({ ...settings, notify_email_outage: checked ? 'true' : 'false' })}
                      />
                    </div>

                    {/* Recovery Confirmation */}
                    <div className="flex items-start justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">Camera Recovery Confirmation</span>
                          <Badge variant="default" className="text-[9px] px-1.5 py-0 uppercase bg-emerald-600">Real-Time</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Sends resolution confirmation with total downtime duration when an offline camera recovers to ONLINE.
                        </p>
                      </div>
                      <Switch
                        checked={settings.notify_email_recovery !== 'false'}
                        onCheckedChange={(checked) => setSettings({ ...settings, notify_email_recovery: checked ? 'true' : 'false' })}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Periodic Executive & Operational Reports */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    Periodic Executive & Operational Reports
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Daily Health Digest */}
                    <div className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">Daily Health Digest</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Daily</Badge>
                          </div>
                          <Switch
                            checked={settings.notify_email_daily_digest === 'true'}
                            onCheckedChange={(checked) => setSettings({ ...settings, notify_email_daily_digest: checked ? 'true' : 'false' })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          24-hour fleet availability %, total outages logged, and currently offline/flapping units.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">08:00 AM Daily</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={testingReportType !== null}
                          onClick={() => handleTestReport('daily_digest')}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {testingReportType === 'daily_digest' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send Sample
                        </Button>
                      </div>
                      {reportTestStatus['daily_digest'] && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 ${
                          reportTestStatus['daily_digest'].type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}>
                          {reportTestStatus['daily_digest'].type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                          <span>{reportTestStatus['daily_digest'].message}</span>
                        </div>
                      )}
                    </div>

                    {/* Weekly SLA Report */}
                    <div className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">Weekly SLA & Offenders</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Weekly</Badge>
                          </div>
                          <Switch
                            checked={settings.notify_email_weekly_report === 'true'}
                            onCheckedChange={(checked) => setSettings({ ...settings, notify_email_weekly_report: checked ? 'true' : 'false' })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Top 5 chronic flapping cameras, recurring NVR bay dropouts, and SLA uptime compliance.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">Monday Mornings</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={testingReportType !== null}
                          onClick={() => handleTestReport('weekly_report')}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {testingReportType === 'weekly_report' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send Sample
                        </Button>
                      </div>
                      {reportTestStatus['weekly_report'] && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 ${
                          reportTestStatus['weekly_report'].type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}>
                          {reportTestStatus['weekly_report'].type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                          <span>{reportTestStatus['weekly_report'].message}</span>
                        </div>
                      )}
                    </div>

                    {/* Monthly Executive Audit */}
                    <div className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">Monthly Fleet Audit</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Monthly</Badge>
                          </div>
                          <Switch
                            checked={settings.notify_email_monthly_report === 'true'}
                            onCheckedChange={(checked) => setSettings({ ...settings, notify_email_monthly_report: checked ? 'true' : 'false' })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          High-level executive review: 30-day uptime curves, MTTR, and hardware expansion headroom.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">1st of Month</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={testingReportType !== null}
                          onClick={() => handleTestReport('monthly_report')}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {testingReportType === 'monthly_report' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send Sample
                        </Button>
                      </div>
                      {reportTestStatus['monthly_report'] && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 ${
                          reportTestStatus['monthly_report'].type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}>
                          {reportTestStatus['monthly_report'].type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                          <span>{reportTestStatus['monthly_report'].message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Escalations & Health Checks */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    Escalations & Engine Health Checks
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Incident Escalation */}
                    <div className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">Incident Escalation Alert</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-rose-500/40 text-rose-500">Critical</Badge>
                          </div>
                          <Switch
                            checked={settings.notify_email_escalation === 'true'}
                            onCheckedChange={(checked) => setSettings({ ...settings, notify_email_escalation: checked ? 'true' : 'false' })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Urgent escalation reminder sent when a camera outage remains unacknowledged or offline beyond 2 hours.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">Trigger: 2hr Threshold</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={testingReportType !== null}
                          onClick={() => handleTestReport('escalation')}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {testingReportType === 'escalation' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send Sample
                        </Button>
                      </div>
                      {reportTestStatus['escalation'] && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 ${
                          reportTestStatus['escalation'].type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}>
                          {reportTestStatus['escalation'].type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                          <span>{reportTestStatus['escalation'].message}</span>
                        </div>
                      )}
                    </div>

                    {/* Engine Heartbeat */}
                    <div className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/50 hover:bg-card transition-colors space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">System Engine Heartbeat</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">Health Check</Badge>
                          </div>
                          <Switch
                            checked={settings.notify_email_heartbeat === 'true'}
                            onCheckedChange={(checked) => setSettings({ ...settings, notify_email_heartbeat: checked ? 'true' : 'false' })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Periodic automated heartbeat ping verifying that the monitoring background worker, database, and dispatchers are active.
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">Periodic System Ping</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={testingReportType !== null}
                          onClick={() => handleTestReport('heartbeat')}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          {testingReportType === 'heartbeat' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send Sample
                        </Button>
                      </div>
                      {reportTestStatus['heartbeat'] && (
                        <div className={`p-2 rounded text-[10px] flex items-center gap-1.5 ${
                          reportTestStatus['heartbeat'].type === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}>
                          {reportTestStatus['heartbeat'].type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                          <span>{reportTestStatus['heartbeat'].message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-4 sm:pt-4">
                <div />
                <div className="flex items-center gap-3 justify-end">
                  {notificationSaveStatus && (
                    <span className={`text-xs flex items-center gap-1 font-medium ${
                      notificationSaveStatus.type === 'success' ? 'text-emerald-500' : 'text-destructive'
                    }`}>
                      {notificationSaveStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {notificationSaveStatus.message}
                    </span>
                  )}
                  <Button type="submit" disabled={isSavingSettings} className="gap-2 text-xs min-w-[230px] justify-center">
                    {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Notification Preferences
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>

          {/* Telegram Bot Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-400" />
                Telegram Bot Outage Broadcast
              </CardTitle>
              <CardDescription>
                Instant push alerts directly to security on-duty Telegram channels and command chat rooms.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveTelegramSettings}>
              <CardContent className="space-y-4">
                {telegramSaveStatus && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    telegramSaveStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  }`}>
                    {telegramSaveStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{telegramSaveStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Telegram Bot Token</label>
                    <Input
                      type="password"
                      placeholder="123456789:ABCDefgh..."
                      value={settings.telegram_bot_token || ''}
                      onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Obtain from @BotFather on Telegram</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Telegram Chat ID</label>
                    <Input
                      type="text"
                      placeholder="-1001234567890"
                      value={settings.telegram_chat_id || ''}
                      onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Target group or direct chat identifier</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-4 sm:pt-4">
                <div />
                <div className="flex items-center gap-3 justify-end">
                  {telegramSaveStatus && (
                    <span className={`text-xs flex items-center gap-1 font-medium ${
                      telegramSaveStatus.type === 'success' ? 'text-emerald-500' : 'text-destructive'
                    }`}>
                      {telegramSaveStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {telegramSaveStatus.message}
                    </span>
                  )}
                  <Button type="submit" disabled={isSavingSettings} className="gap-2 text-xs min-w-[230px] justify-center">
                    {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Telegram Configuration
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* 4. Fleet Operations Sub-View */}
        {/* ============================================================== */}
        <TabsContent value="fleet" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bulk CSV / Excel Import & Export */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Bulk Fleet Import & Export
                </CardTitle>
                <CardDescription>Export current configurations or import bulk camera entries via CSV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <a href="/api/cameras/excel/export" download>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <Download className="w-3.5 h-3.5" />
                      Export Excel (.xlsx)
                    </Button>
                  </a>
                  <a href="/api/cameras/csv/export" download>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </Button>
                  </a>
                  <a href="/api/cameras/csv/template" download>
                    <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground">
                      <Download className="w-3.5 h-3.5" />
                      Sample Template
                    </Button>
                  </a>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs font-semibold">Upload CSV Camera Fleet File</label>
                  <form onSubmit={handleCsvImport} className="space-y-3">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-primary" />
                        <span>RTSP Credentials Injection (Optional)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        If your CSV has masked passwords (<code className="bg-muted px-1 py-0.5 rounded font-mono">*****</code>) or standard empty passwords, enter master credentials:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Default Username</label>
                          <Input
                            type="text"
                            value={csvUsername}
                            onChange={(e) => setCsvUsername(e.target.value)}
                            placeholder="e.g. admin or arechs_cctv"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Default Password</label>
                          <Input
                            type="password"
                            value={csvPassword}
                            onChange={(e) => setCsvPassword(e.target.value)}
                            placeholder="Enter password..."
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="admin-csv-override"
                          checked={csvOverride}
                          onChange={(e) => setCsvOverride(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                        <label htmlFor="admin-csv-override" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                          Force override existing passwords in CSV with this password
                        </label>
                      </div>
                    </div>
                    <Button type="submit" disabled={!csvFile || isImportingCsv} size="sm" className="gap-2">
                      {isImportingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Import Cameras
                    </Button>
                  </form>
                  {importResult && (
                    <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                      {importResult.count !== undefined && (
                        <p className="font-semibold text-emerald-500">Successfully imported {importResult.count} cameras!</p>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="text-destructive space-y-1">
                          <p className="font-semibold">Import Warnings/Errors:</p>
                          <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto font-mono text-[11px]">
                            {importResult.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* NVR Bay Renaming Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-500" />
                  NVR Recorder Bay Renaming
                </CardTitle>
                <CardDescription>
                  Batch-rename all camera channels assigned to an NVR bay across the entire fleet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleRenameNvr} className="space-y-4">
                  {renameStatus && (
                    <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      renameStatus.type === 'success' 
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                    }`}>
                      {renameStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{renameStatus.message}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Current Bay Name</label>
                      <Input
                        type="text"
                        required
                        value={nvrOldName}
                        onChange={(e) => setNvrOldName(e.target.value)}
                        placeholder="e.g. NVR 01"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">New Bay Name</label>
                      <Input
                        type="text"
                        required
                        value={nvrNewName}
                        onChange={(e) => setNvrNewName(e.target.value)}
                        placeholder="e.g. Main Gate Bay 01"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isRenamingNvr || !nvrNewName.trim()} size="sm" className="gap-2">
                    {isRenamingNvr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                    Rename Recorder Bay
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Fleet Diagnostic & Maintenance Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Health Rescan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-primary" />
                  Fleet Diagnostic Health Scan
                </CardTitle>
                <CardDescription>
                  Immediately pings all camera channels across all physical NVRs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleTriggerFleetScan} disabled={isScanning} size="sm" className="gap-2 w-full">
                  <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  Trigger Fleet Rescan
                </Button>
                {scanStatus && (
                  <p className="text-xs text-primary font-mono">{scanStatus}</p>
                )}
              </CardContent>
            </Card>

            {/* Batch Snapshot Refresh */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-500" />
                  Batch Snapshot Refresh
                </CardTitle>
                <CardDescription>
                  High-speed capture of fresh JPEG keyframes across all NVR bays in parallel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleTriggerSnapshotRefresh} 
                  disabled={isRefreshingSnapshots} 
                  size="sm" 
                  className="gap-2 w-full"
                >
                  <Camera className={`w-3.5 h-3.5 ${isRefreshingSnapshots ? 'animate-spin' : ''}`} />
                  Update All Snapshots
                </Button>
                {snapshotRefreshStatus && (
                  <p className="text-xs text-blue-500 font-mono">{snapshotRefreshStatus}</p>
                )}
              </CardContent>
            </Card>

            {/* Synthetic Fleet Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-500" />
                  Test Simulator (270 Cameras)
                </CardTitle>
                <CardDescription>
                  Populates 270 synthetic cameras across 9 bays for load testing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={handleSeedSimulator} 
                  disabled={isSeedingSimulator} 
                  size="sm" 
                  className="gap-2 w-full border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                >
                  {isSeedingSimulator ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                  Seed 270 Test Cameras
                </Button>
                {simulatorStatus && (
                  <p className="text-xs text-amber-500 font-mono">{simulatorStatus}</p>
                )}
              </CardContent>
            </Card>

            {/* Danger Zone: Reset Master Fleet */}
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  Danger Zone: Re-seed Master
                </CardTitle>
                <CardDescription>
                  Resets the camera fleet inventory back to factory default configuration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setIsReSeedModalOpen(true)}
                  className="gap-2 w-full text-xs"
                >
                  Re-seed Master Fleet
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Re-seed Confirmation Modal */}
          <Dialog open={isReSeedModalOpen} onOpenChange={setIsReSeedModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Confirm Fleet Re-Seed
                </DialogTitle>
                <DialogDescription>
                  This action will re-import the standard camera inventory. Type <code className="font-bold text-foreground">CONFIRM</code> below to proceed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="Type CONFIRM"
                  value={reSeedConfirmText}
                  onChange={(e) => setReSeedConfirmText(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsReSeedModalOpen(false)}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  disabled={reSeedConfirmText !== 'CONFIRM' || isReSeeding}
                  onClick={handleReSeedFleet}
                  className="gap-2"
                >
                  {isReSeeding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Re-Seed
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================== */}
        {/* 5. Diagnostics & Audit Logs Sub-View */}
        {/* ============================================================== */}
        <TabsContent value="diagnostics" className="mt-6 space-y-6">
          {/* Telemetry metrics cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Server Uptime</div>
              <div className="text-xl font-bold font-mono mt-1">
                {diagnostics ? `${Math.floor(diagnostics.uptime_seconds / 3600)}h ${Math.floor((diagnostics.uptime_seconds % 3600) / 60)}m` : '—'}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Database on Disk</div>
              <div className="text-xl font-bold font-mono mt-1">
                {diagnostics ? `${(diagnostics.db_size_bytes / 1024).toFixed(1)} KB` : '—'}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total Provisioned</div>
              <div className="text-xl font-bold font-mono mt-1">
                {diagnostics ? `${diagnostics.total_cameras} Cams` : '—'}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Active Outages</div>
              <div className="text-xl font-bold font-mono mt-1 text-destructive">
                {diagnostics ? `${diagnostics.active_incidents} Incidents` : '—'}
              </div>
            </Card>
          </div>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Security & Operational Audit Log
                </CardTitle>
                <CardDescription>Recent authentication and administrative actions on this system</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDiagnosticsAndLogs}
                disabled={isDiagLoading}
                className="gap-1.5 text-xs"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isDiagLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[160px]">Event Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[120px] text-right">Client IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          No audit log entries recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id} className="font-mono text-xs">
                          <TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={log.event_type.includes('FAIL') ? 'destructive' : 'outline'}
                              className="text-[10px] uppercase font-mono"
                            >
                              {log.event_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-sans text-xs">{log.description}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{log.ip_address || '127.0.0.1'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
