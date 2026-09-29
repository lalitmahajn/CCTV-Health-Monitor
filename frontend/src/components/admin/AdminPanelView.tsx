import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  KeyRound, 
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
  FileSpreadsheet
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

  // --- Alert Test State ---
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Fleet Maintenance State ---
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<{ count?: number; errors?: string[] } | null>(null);
  const [isReSeedModalOpen, setIsReSeedModalOpen] = useState(false);
  const [reSeedConfirmText, setReSeedConfirmText] = useState('');
  const [isReSeeding, setIsReSeeding] = useState(false);

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
      } catch (err: any) {
        setSettingsStatus({ type: 'error', message: err.message || 'Failed to load settings' });
      } finally {
        setIsSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

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
      await api.updateSettings(settings);
      setSettingsStatus({ type: 'success', message: 'Engine settings successfully updated and applied' });
      if (onFleetReload) onFleetReload();
    } catch (err: any) {
      setSettingsStatus({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailTestStatus(null);
    try {
      setIsTestingEmail(true);
      const res = await api.testSmtpSettings();
      setEmailTestStatus({ type: 'success', message: res.message });
    } catch (err: any) {
      setEmailTestStatus({ type: 'error', message: err.message || 'SMTP test failed' });
    } finally {
      setIsTestingEmail(false);
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

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    try {
      setIsImportingCsv(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', csvFile);

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
      setScanStatus(`Fleet re-seeded: ${data.count} channels.`);
      if (onFleetReload) onFleetReload();
    } catch (err: any) {
      alert(`Re-seed failed: ${err.message}`);
    } finally {
      setIsReSeeding(false);
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
            Enterprise single-gatekeeper configuration, engine telemetry tuning, and audit administration.
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

        {/* 1. Account & Security Sub-View */}
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

        {/* 2. Engine Tuning Sub-View */}
        <TabsContent value="engine" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                Monitoring Engine Telemetry Tuning
              </CardTitle>
              <CardDescription>
                Configure background polling cadence, TCP timeout limits, and failure thresholds.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveSettings}>
              <CardContent className="space-y-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">TCP Ping Interval (seconds)</label>
                    <Input
                      type="number"
                      value={settings.ping_interval_seconds || '30'}
                      onChange={(e) => setSettings({ ...settings, ping_interval_seconds: e.target.value })}
                      disabled={isSettingsLoading}
                      min="5"
                      max="300"
                    />
                    <p className="text-[11px] text-muted-foreground">Cycle frequency for TCP liveness probe.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Socket Timeout (ms)</label>
                    <Input
                      type="number"
                      value={settings.socket_timeout_ms || '3000'}
                      onChange={(e) => setSettings({ ...settings, socket_timeout_ms: e.target.value })}
                      disabled={isSettingsLoading}
                      min="500"
                      max="10000"
                    />
                    <p className="text-[11px] text-muted-foreground">Maximum wait time for SYN/ACK packet.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Failure Threshold</label>
                    <Input
                      type="number"
                      value={settings.failure_threshold || '2'}
                      onChange={(e) => setSettings({ ...settings, failure_threshold: e.target.value })}
                      disabled={isSettingsLoading}
                      min="1"
                      max="10"
                    />
                    <p className="text-[11px] text-muted-foreground">Consecutive failures before declaring OFFLINE outage.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Max Concurrency per Host</label>
                    <Input
                      type="number"
                      value={settings.max_concurrency_per_host || '2'}
                      onChange={(e) => setSettings({ ...settings, max_concurrency_per_host: e.target.value })}
                      disabled={isSettingsLoading}
                      min="1"
                      max="8"
                    />
                    <p className="text-[11px] text-muted-foreground">Throttles simultaneous RTSP probes to a single physical NVR.</p>
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
                    <p className="text-[11px] text-muted-foreground">Cadence for periodic JPEG thumbnail grabs.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Time Format</label>
                    <div className="flex items-center gap-3 pt-2">
                      <span className={`text-xs ${settings.time_format === '12h' ? 'font-bold text-primary' : 'text-muted-foreground'}`}>12-Hour</span>
                      <Switch
                        checked={settings.time_format === '24h'}
                        onCheckedChange={(checked) => setSettings({ ...settings, time_format: checked ? '24h' : '12h' })}
                        disabled={isSettingsLoading}
                      />
                      <span className={`text-xs ${settings.time_format === '24h' ? 'font-bold text-primary' : 'text-muted-foreground'}`}>24-Hour (Military)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={isSavingSettings || isSettingsLoading} className="gap-2">
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                  Save Engine Settings
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* 3. Alert Notification Channels */}
        <TabsContent value="alerts" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                SMTP Email Alert Dispatcher
              </CardTitle>
              <CardDescription>
                Configure automated email dispatch upon camera outage and incident resolution.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveSettings}>
              <CardContent className="space-y-4">
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

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Recipient Email Addresses</label>
                  <Input
                    placeholder="it-alerts@company.com, cctv-ops@company.com"
                    value={settings.email_recipients || ''}
                    onChange={(e) => setSettings({ ...settings, email_recipients: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">Separate multiple recipients with commas.</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
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
                <Button type="submit" disabled={isSavingSettings} className="gap-2 text-xs">
                  Save Alert Configuration
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* 4. Fleet Operations Sub-View */}
        <TabsContent value="fleet" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-primary" />
                  Fleet Diagnostic Actions
                </CardTitle>
                <CardDescription>Instant background triggers and maintenance actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/40 border space-y-2">
                  <h4 className="text-xs font-semibold">Trigger Fleet Health Rescan</h4>
                  <p className="text-xs text-muted-foreground">
                    Immediately pings all 266 camera channels across all NVRs concurrently.
                  </p>
                  <Button onClick={handleTriggerFleetScan} disabled={isScanning} size="sm" className="gap-2">
                    <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    Trigger Fleet Scan
                  </Button>
                  {scanStatus && (
                    <p className="text-xs text-primary font-mono mt-1">{scanStatus}</p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                  <h4 className="text-xs font-semibold text-destructive">Danger Zone: Re-seed Master Fleet</h4>
                  <p className="text-xs text-muted-foreground">
                    Resets fleet data back to original factory configuration.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setIsReSeedModalOpen(true)}
                    className="gap-2 text-xs"
                  >
                    Re-seed Fleet
                  </Button>
                </div>
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

        {/* 5. Diagnostics & Audit Logs Sub-View */}
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
