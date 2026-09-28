import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Bell, 
  Mail, 
  Send, 
  Database, 
  RefreshCw,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldCheck,
  FlaskConical,
  Clock
} from 'lucide-react';
import * as api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTimeFormat, getTimezoneInfo, formatTime, type TimeFormat } from '@/lib/timeUtils';

interface SettingsViewProps {
  onFleetReload: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onFleetReload }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // NVR rename state
  const [nvrOldName, setNvrOldName] = useState('NVR 01');
  const [nvrNewName, setNvrNewName] = useState('');
  const [renameStatus, setRenameStatus] = useState<string | null>(null);

  // Email section expand state
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);

  // Simulator state
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Time format state & live preview clock
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
    handleChange('time_format', fmt);
    try {
      await api.updateSettings({ time_format: fmt });
    } catch (e) {
      console.warn('Could not persist time format:', e);
    }
  };


  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.fetchSettings();
      setSettings(data);
      if (data.time_format === '12h' || data.time_format === '24h') {
        setTimeFormatState(data.time_format);
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveMessage(null);
      await api.updateSettings(settings);
      setSaveMessage('System settings successfully saved!');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setSaveMessage(`Error: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameNvr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nvrNewName.trim()) return;
    try {
      setRenameStatus('Renaming recorder...');
      const res = await api.renameNvr(nvrOldName, nvrNewName);
      setRenameStatus(`Success: ${res.message}`);
      setNvrNewName('');
      onFleetReload();
      setTimeout(() => setRenameStatus(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      setRenameStatus(`Error: ${msg}`);
    }
  };

  const handleSeedSimulator = async () => {
    if (!window.confirm('Warning: This will clear current camera data and generate 270 synthetic test cameras. Continue?')) {
      return;
    }
    try {
      setIsSeeding(true);
      setSeedStatus('Seeding 270 cameras across 9 NVR bays...');
      const res = await fetch('/api/simulator/seed-270', { method: 'POST' });
      const data = await res.json();
      setSeedStatus(`Success: ${data.message}`);
      onFleetReload();
      setTimeout(() => setSeedStatus(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seeding failed';
      setSeedStatus(`Error: ${msg}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setIsTestingEmail(true);
      setTestEmailStatus(null);
      const res = await fetch('/api/settings/test-email', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setTestEmailStatus(`Error: ${data.detail || 'Failed to send test email'}`);
      } else {
        setTestEmailStatus(`✓ ${data.message}`);
      }
      setTimeout(() => setTestEmailStatus(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setTestEmailStatus(`Error: ${msg}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Derive enabled state from settings for the toggle display
  const emailEnabled = settings['enable_email_alerts'] === 'true';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          System Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure probe frequencies, alert thresholds, webhook dispatches, and recorder presets.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4">
        {/* 1. Engine Core Timing */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span>Scanning Engine & Alert Thresholds</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Controls asynchronous probe cycles and failure confirmation before incident escalation
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">
                  Scan Interval (seconds)
                </label>
                <Input
                  type="number"
                  value={settings['scan_interval'] || '30'}
                  onChange={(e) => handleChange('scan_interval', e.target.value)}
                  className="h-9 font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Time between automatic fleet health check cycles
                </span>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">
                  Consecutive Failure Threshold
                </label>
                <Input
                  type="number"
                  value={settings['failure_threshold'] || '3'}
                  onChange={(e) => handleChange('failure_threshold', e.target.value)}
                  className="h-9 font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Number of failed pings before declaring an outage and sounding alarm
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Time & Regional Display */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Time & Regional Display</span>
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border/60">
                {tzInfo.offset} • {tzInfo.name}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Configure clock display and timestamp formatting across the fleet dashboard, uptime charts, and incident logs
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div>
              <label className="block text-muted-foreground mb-2 font-medium">
                Select Time Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 12-Hour Option */}
                <button
                  type="button"
                  data-testid="time-format-12h"
                  onClick={() => handleTimeFormatChange('12h')}
                  className={cn(
                    "flex items-start justify-between p-3.5 rounded-lg border text-left cursor-pointer transition-all w-full",
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
                    "flex items-start justify-between p-3.5 rounded-lg border text-left cursor-pointer transition-all w-full",
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

            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Detected Client Timezone
              </span>
              <span className="font-mono font-medium text-foreground">{tzInfo.name} ({tzInfo.offset})</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Email Notifications — Collapsible */}
        <Card className="border-border/80 shadow-xs">

          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <CardTitle className="text-sm font-semibold">
                  SMTP Email Dispatch
                </CardTitle>
                <Badge
                  variant={emailEnabled ? 'default' : 'secondary'}
                  className="text-[10px] font-mono"
                >
                  {emailEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground gap-1"
                onClick={() => setEmailExpanded(!emailExpanded)}
              >
                {emailExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Configure</span>
                  </>
                )}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Automated email incident reports to security supervisor and IT infrastructure teams
            </CardDescription>
          </CardHeader>

          {emailExpanded && (
            <CardContent className="p-4 pt-0 space-y-4 text-xs border-t border-border/40">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Enable Email Alerts</div>
                    <div className="text-[10px] text-muted-foreground">Send outage/recovery emails when incidents trigger</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={emailEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px] px-3"
                  onClick={() => handleChange('enable_email_alerts', emailEnabled ? 'false' : 'true')}
                >
                  {emailEnabled ? 'On' : 'Off'}
                </Button>
              </div>

              {/* Server */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-muted-foreground mb-1.5 font-medium">SMTP Host</label>
                  <Input
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={settings['smtp_host'] || ''}
                    onChange={(e) => handleChange('smtp_host', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">SMTP Port</label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={settings['smtp_port'] || '587'}
                    onChange={(e) => handleChange('smtp_port', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">587 = STARTTLS, 465 = SSL</span>
                </div>
              </div>

              {/* Auth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">SMTP Username</label>
                  <Input
                    type="email"
                    placeholder="alerts@yourcompany.com"
                    value={settings['smtp_user'] || ''}
                    onChange={(e) => handleChange('smtp_user', e.target.value)}
                    className="h-9 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Usually the sender email address</span>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    SMTP Password
                  </label>
                  <Input
                    type="password"
                    placeholder="App password or SMTP credential"
                    value={settings['smtp_password'] || ''}
                    onChange={(e) => handleChange('smtp_password', e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">For Gmail, use an App Password (not your login password)</span>
                </div>
              </div>

              {/* TLS + Recipients */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1.5 font-medium">Use TLS Encryption</label>
                  <Button
                    type="button"
                    variant={settings['smtp_use_tls'] !== 'false' ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 w-full text-xs"
                    onClick={() => handleChange('smtp_use_tls', settings['smtp_use_tls'] === 'false' ? 'true' : 'false')}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    {settings['smtp_use_tls'] !== 'false' ? 'TLS Enabled' : 'TLS Disabled'}
                  </Button>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-muted-foreground mb-1.5 font-medium">Recipient List</label>
                  <Input
                    type="text"
                    placeholder="security@domain.com, admin@domain.com"
                    value={settings['email_recipients'] || ''}
                    onChange={(e) => handleChange('email_recipients', e.target.value)}
                    className="h-9 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Comma-separated email addresses</span>
                </div>
              </div>

              {/* Test Email Button */}
              <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleSendTestEmail}
                  disabled={isTestingEmail}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{isTestingEmail ? 'Sending...' : 'Send Test Email'}</span>
                </Button>
                {testEmailStatus && (
                  <span className={`text-xs font-mono ${testEmailStatus.startsWith('✓') ? 'text-emerald-400' : 'text-destructive'}`}>
                    {testEmailStatus}
                  </span>
                )}
              </div>
            </CardContent>
          )}
        </Card>


        {/* 3. Telegram Bot Notifications */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Telegram Bot Outage Broadcast</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Instant push alerts directly to security on-duty Telegram channels
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">Telegram Bot Token</label>
                <Input
                  type="password"
                  placeholder="123456789:ABCDefgh..."
                  value={settings['telegram_bot_token'] || ''}
                  onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">Telegram Chat ID</label>
                <Input
                  type="text"
                  placeholder="-1001234567890"
                  value={settings['telegram_chat_id'] || ''}
                  onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {saveMessage ? (
            <span className="text-xs font-mono text-emerald-400">{saveMessage}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Changes apply immediately to running daemon.</span>
          )}
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isSaving}
            className="gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        </div>
      </form>

      {/* 4. Recorder Bay Utilities */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <span>NVR Recorder Bay Renaming</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Batch-rename all camera channels assigned to an NVR bay across the entire fleet
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 text-xs">
          <form onSubmit={handleRenameNvr} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-1/3">
              <label className="block text-muted-foreground mb-1.5 font-medium">Current Bay Name</label>
              <Input
                type="text"
                required
                value={nvrOldName}
                onChange={(e) => setNvrOldName(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="e.g. NVR 01"
              />
            </div>
            <div className="w-full sm:w-1/3">
              <label className="block text-muted-foreground mb-1.5 font-medium">New Bay Name</label>
              <Input
                type="text"
                required
                value={nvrNewName}
                onChange={(e) => setNvrNewName(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="e.g. Main Gate Rack 1"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Rename Bay
            </Button>
          </form>
          {renameStatus && (
            <p className="mt-2 text-xs font-mono text-primary">{renameStatus}</p>
          )}
        </CardContent>
      </Card>

      {/* 5. Demo Simulator Tools */}
      <Card className="border-red-500/20 bg-red-950/5 shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-red-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Database className="w-4 h-4 text-amber-500" />
              <span>Test Simulator & Synthetic Fleet Generator</span>
            </CardTitle>
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 font-mono text-[10px]">
              Sandbox
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Used for sandbox demonstrations and stress testing the 270-channel UI matrix
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 text-xs space-y-3">
          <p className="text-muted-foreground">
            Generate 270 dummy camera channels across 9 simulated NVRs for load testing and demonstration.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 h-8"
              onClick={handleSeedSimulator}
              disabled={isSeeding}
            >
              <Bell className="w-3.5 h-3.5 mr-1" />
              <span>{isSeeding ? 'Generating Fleet...' : 'Seed 270 Test Cameras'}</span>
            </Button>
            {seedStatus && (
              <span className="text-xs font-mono text-muted-foreground">{seedStatus}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
