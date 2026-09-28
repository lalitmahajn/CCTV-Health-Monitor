import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Server, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Zap, 
  Sliders, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import type { Camera } from '@/lib/types';
import * as api from '@/lib/api';

interface CameraInventoryViewProps {
  cameras: Camera[];
  onRefresh: () => void;
  onInspectCamera: (camera: Camera) => void;
}

export const CameraInventoryView: React.FC<CameraInventoryViewProps> = ({
  cameras,
  onRefresh,
  onInspectCamera,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dvr_nvr_name: '',
    location: '',
    ip_address: '',
    port: 554,
    channel_no: '',
    rtsp_url: '',
    is_enabled: true,
    is_no_cam: false,
  });

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Filtered cameras
  const filteredCameras = cameras.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.ip_address.toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.dvr_nvr_name || '').toLowerCase().includes(q) ||
      String(c.channel_no || '').includes(q)
    );
  });

  const totalPages = Math.ceil(filteredCameras.length / pageSize) || 1;
  const paginatedCameras = filteredCameras.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenAdd = () => {
    setEditingCamera(null);
    setFormData({
      name: '',
      dvr_nvr_name: 'NVR 01',
      location: '',
      ip_address: '',
      port: 554,
      channel_no: '1',
      rtsp_url: 'rtsp://admin:password@ip:554/cam/realmonitor?channel=1&subtype=0',
      is_enabled: true,
      is_no_cam: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cam: Camera) => {
    setEditingCamera(cam);
    setFormData({
      name: cam.name,
      dvr_nvr_name: cam.dvr_nvr_name || '',
      location: cam.location || '',
      ip_address: cam.ip_address,
      port: cam.port || 554,
      channel_no: cam.channel_no || '',
      rtsp_url: cam.rtsp_url,
      is_enabled: Boolean(cam.is_enabled),
      is_no_cam: Boolean(cam.is_no_cam),
    });
    setIsModalOpen(true);
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCamera) {
        await api.updateCamera(editingCamera.id, formData);
      } else {
        await api.createCamera(formData);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save camera';
      alert(msg);
    }
  };

  const handleDeleteCamera = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete camera "${name}"?`)) return;
    try {
      await api.deleteCamera(id);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete camera';
      alert(msg);
    }
  };

  const handleToggleNoCam = async (id: number) => {
    try {
      await api.toggleCameraNoCam(id);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle spare status';
      alert(msg);
    }
  };

  const handleQuickPing = async (id: number) => {
    try {
      const res = await api.checkCamera(id);
      alert(`Ping result: Camera ${res.camera_id} is ${res.status}. ${res.message}`);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ping probe failed';
      alert(msg);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    try {
      setImportStatus('Uploading and parsing CSV...');
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/cameras/csv/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImportStatus(`Successfully imported ${data.imported_count} cameras.`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportStatus(null);
        setImportFile(null);
        onRefresh();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setImportStatus(`Error: ${msg}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Camera Fleet Inventory
              <Badge variant="outline" className="font-mono text-xs">
                {cameras.length} Total Registered
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage NVR bay channel assignments, RTSP streaming credentials, and hardware endpoints
            </p>
          </div>
        </div>

        {/* Action Buttons: Add, Import, Export */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={handleOpenAdd}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Camera</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            asChild
          >
            <a href="/api/cameras/excel/export" download>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Export Excel</span>
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            asChild
          >
            <a href="/api/cameras/csv/export" download>
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Export CSV</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by camera name, IP, NVR bay, or location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Page {page} of {totalPages} ({filteredCameras.length} cameras)
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">CH</th>
                <th className="py-2.5 px-3">Camera Name</th>
                <th className="py-2.5 px-3">NVR Bay</th>
                <th className="py-2.5 px-3">IP Endpoint</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginatedCameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground font-mono">
                    No camera records found matching search query.
                  </td>
                </tr>
              ) : (
                paginatedCameras.map((cam) => {
                  const isNoCam = Boolean(cam.is_no_cam);
                  const isOnline = !isNoCam && cam.status === 'ONLINE';

                  return (
                    <tr key={cam.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {cam.channel_no ? String(cam.channel_no).padStart(2, '0') : '--'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{cam.name}</div>
                        {cam.location && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {cam.location}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {cam.dvr_nvr_name || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div>{cam.ip_address}:{cam.port || 554}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          {cam.masked_url || cam.rtsp_url}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {isNoCam ? (
                          <Badge variant="spare" className="text-[10px] h-4">SPARE</Badge>
                        ) : isOnline ? (
                          <Badge variant="success" className="text-[10px] h-4 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ONLINE
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] h-4">OFFLINE</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {isOnline && cam.latency_ms ? `${Math.round(cam.latency_ms)}ms` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Inspect in sliding drawer"
                            onClick={() => onInspectCamera(cam)}
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Run manual ping check"
                            onClick={() => handleQuickPing(cam.id)}
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={isNoCam ? 'Mark as Active Camera' : 'Mark as Spare Port'}
                            onClick={() => handleToggleNoCam(cam.id)}
                          >
                            <Sliders className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit camera parameters"
                            onClick={() => handleOpenEdit(cam)}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete camera record"
                            onClick={() => handleDeleteCamera(cam.id, cam.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="text-xs h-7 gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="text-xs h-7 gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </Card>

      {/* Add / Edit Camera Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingCamera ? 'Edit Camera Parameters' : 'Register New Camera'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCamera} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Camera Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground"
                    placeholder="e.g. Main Gate Camera"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">NVR Bay Name</label>
                  <input
                    type="text"
                    value={formData.dvr_nvr_name}
                    onChange={(e) => setFormData({ ...formData, dvr_nvr_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground"
                    placeholder="e.g. NVR 01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-muted-foreground mb-1 font-semibold">IP Address</label>
                  <input
                    type="text"
                    required
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground font-mono"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 554 })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Channel Number</label>
                  <input
                    type="text"
                    value={formData.channel_no}
                    onChange={(e) => setFormData({ ...formData, channel_no: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground font-mono"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Physical Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground"
                    placeholder="e.g. Sector 4 East Perimeter"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-semibold">RTSP Stream URL</label>
                <input
                  type="text"
                  required
                  value={formData.rtsp_url}
                  onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-foreground font-mono text-[11px]"
                  placeholder="rtsp://admin:password@ip:554/cam/realmonitor?channel=1&subtype=0"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                    className="rounded border-input text-primary"
                  />
                  <span>Monitoring Enabled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_no_cam}
                    onChange={(e) => setFormData({ ...formData, is_no_cam: e.target.checked })}
                    className="rounded border-input text-primary"
                  />
                  <span>Mark as Spare (No Cam)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm">
                  {editingCamera ? 'Update Camera' : 'Create Camera'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <span>Bulk Import Cameras via CSV</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Upload a CSV spreadsheet with headers: <code className="bg-muted px-1 rounded">name, dvr_nvr_name, ip_address, port, channel_no, rtsp_url, location</code>.
              </p>

              <div>
                <a
                  href="/api/cameras/csv/template"
                  download
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Sample CSV Template</span>
                </a>
              </div>

              <div className="p-4 border-2 border-dashed border-border rounded-lg text-center cursor-pointer hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground"
                />
              </div>

              {importStatus && (
                <div className="p-2 rounded bg-muted text-xs font-mono text-foreground">
                  {importStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" disabled={!importFile}>
                  Upload & Import
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
