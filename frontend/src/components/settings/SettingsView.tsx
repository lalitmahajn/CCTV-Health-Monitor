import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon, 
  Save, 
  Bell, 
  Mail, 
  Send, 
  Database, 
  RefreshCw,
  HardDrive
} from 'lucide-react';
import * as api from '@/lib/api';

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

  // Simulator state
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.fetchSettings();
      setSettings(data);
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card shadow-xs">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            System & Notification Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure scan frequencies, notification thresholds, remote dispatch webhooks, and fleet presets
          </p>
        </div>
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

        {/* 2. Email Notifications */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              <span>SMTP Email Dispatch</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Automated email incident reports to security supervisor and IT infrastructure teams
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-muted-foreground mb-1.5 font-medium">SMTP Host</label>
                <Input
                  type="text"
                  placeholder="smtp.example.com"
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
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">Sender Email</label>
                <Input
                  type="email"
                  placeholder="alerts@domain.com"
                  value={settings['smtp_user'] || ''}
                  onChange={(e) => handleChange('smtp_user', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1.5 font-medium">Recipient List</label>
                <Input
                  type="text"
                  placeholder="security@domain.com, admin@domain.com"
                  value={settings['email_recipients'] || ''}
                  onChange={(e) => handleChange('email_recipients', e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
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
