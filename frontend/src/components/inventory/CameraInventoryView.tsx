import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
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
  FileText,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
      const uploadFormData = new FormData();
      uploadFormData.append('file', importFile);
      const res = await fetch('/api/cameras/csv/import', {
        method: 'POST',
        body: uploadFormData,
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
    <div className="space-y-6">
      {/* Official Shadcn Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Camera Inventory
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage channel assignments, RTSP streaming credentials, and hardware endpoints across {cameras.length} cameras.
          </p>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search by camera name, IP, NVR bay, or location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-3 h-9 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Page {page} of {totalPages} ({filteredCameras.length} channels)
        </div>
      </div>

      {/* Shadcn UI Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/60">
                <TableHead className="w-16 font-mono font-bold text-xs">CH</TableHead>
                <TableHead className="text-xs font-semibold">Camera Details</TableHead>
                <TableHead className="text-xs font-semibold">NVR Bay</TableHead>
                <TableHead className="text-xs font-semibold">Endpoint & RTSP</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold font-mono">Latency</TableHead>
                <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCameras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-mono text-xs">
                    No camera records found matching search query.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCameras.map((cam) => {
                  const isNoCam = Boolean(cam.is_no_cam);
                  const isOnline = !isNoCam && cam.status === 'ONLINE';

                  return (
                    <TableRow key={cam.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono font-bold text-foreground">
                        {cam.channel_no ? String(cam.channel_no).padStart(2, '0') : '--'}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground text-xs">{cam.name}</div>
                        {cam.location && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {cam.location}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {cam.dvr_nvr_name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="text-foreground">{cam.ip_address}:{cam.port || 554}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {cam.masked_url || cam.rtsp_url}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isNoCam ? (
                          <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                            Spare
                          </Badge>
                        ) : isOnline ? (
                          <Badge variant="outline" className="text-[10px] h-4 gap-1 font-normal text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] h-4 font-normal">
                            Offline
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {isOnline && cam.latency_ms ? `${Math.round(cam.latency_ms)}ms` : '--'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => onInspectCamera(cam)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                                <span className="sr-only">More actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel>Camera Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onInspectCamera(cam)}>
                                <Eye className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <span>Inspect Drawer</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickPing(cam.id)}>
                                <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                <span>Run Ping Check</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleNoCam(cam.id)}>
                                <Sliders className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <span>{isNoCam ? 'Mark as Active' : 'Mark as Spare'}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(cam)}>
                                <Edit3 className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <span>Edit Parameters</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDeleteCamera(cam.id, cam.name)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                <span>Delete Camera</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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

      {/* Genuine Shadcn Dialog: Add / Edit Camera */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingCamera ? 'Edit Camera Parameters' : 'Register New Camera'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure video recorder channel assignment and RTSP network stream endpoints
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCamera} className="space-y-3.5 text-xs pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Camera Name</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="e.g. Main Gate Camera"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">NVR Bay Name</label>
                <Input
                  value={formData.dvr_nvr_name}
                  onChange={(e) => setFormData({ ...formData, dvr_nvr_name: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. NVR 01"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-muted-foreground mb-1 font-medium">IP Address</label>
                <Input
                  required
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Port</label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 554 })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Channel Number</label>
                <Input
                  value={formData.channel_no}
                  onChange={(e) => setFormData({ ...formData, channel_no: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">Physical Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="e.g. East Perimeter"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">RTSP Stream URL</label>
              <Input
                required
                value={formData.rtsp_url}
                onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                className="h-8 text-xs font-mono text-[11px]"
                placeholder="rtsp://admin:password@ip:554/cam/realmonitor?channel=1&subtype=0"
              />
            </div>

            {/* Radix Switch toggles */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
                />
                <span className="text-xs font-medium">Monitoring Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_no_cam}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_no_cam: checked })}
                />
                <span className="text-xs font-medium text-slate-400">Spare Port (No Cam)</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Genuine Shadcn Dialog: CSV Import */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <span>Bulk Import Cameras via CSV</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Upload a CSV spreadsheet with headers: <code className="bg-muted px-1 py-0.5 rounded font-mono">name, dvr_nvr_name, ip_address, port, channel_no, rtsp_url, location</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportSubmit} className="space-y-4 text-xs pt-1">
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

            <div className="p-4 border border-dashed border-border rounded-lg text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20">
              <Input
                type="file"
                accept=".csv"
                required
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="h-9 cursor-pointer text-xs"
              />
            </div>

            {importStatus && (
              <div className="p-2.5 rounded-md bg-muted text-xs font-mono text-foreground border border-border/60">
                {importStatus}
              </div>
            )}

            <DialogFooter className="pt-2">
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
