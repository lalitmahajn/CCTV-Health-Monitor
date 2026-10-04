// CCTV Health Monitor - Frontend SPA Logic

let cameras = [];
let soundEnabled = true;
let audioCtx = null;

// Initialize Web Audio API for zero-dependency sound chimes
function playChime(isOutage = true) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (isOutage) {
      // Urgent double beep
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(330, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else {
      // Pleasant upward recovery chime
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

function showToast(title, message, isOutage = true) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${isOutage ? 'down' : 'up'}`;
  
  const iconSvg = isOutage 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-offline)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-online)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

  toast.innerHTML = `
    <span style="display: flex; align-items: center;">${iconSvg}</span>
    <div>
      <div style="font-weight: 600;">${title}</div>
      <div style="font-size: 0.76rem; color: var(--text-muted);">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Tab Switching
document.querySelectorAll(".nav-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.getAttribute("data-tab");
    document.getElementById(target).classList.add("active");

    if (target === "tab-visuals") renderVisuals();
    if (target === "tab-incidents") loadIncidents();
    if (target === "tab-cameras") renderInventoryTable();
    if (target === "tab-settings") loadSettings();
  });
});

// Sound Toggle
const btnAudio = document.getElementById("btn-audio-toggle");
btnAudio.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  btnAudio.textContent = soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
  if (soundEnabled && !audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
});

let nvrMetadata = {};

// Load Cameras
async function loadCameras() {
  try {
    const [camsRes, nvrsRes] = await Promise.all([
      fetch("/api/cameras"),
      fetch("/api/nvrs")
    ]);
    cameras = await camsRes.json();
    const nvrsList = await nvrsRes.json();
    nvrMetadata = {};
    nvrsList.forEach(n => { nvrMetadata[n.name] = n; });

    updateStats();
    populateNvrFilter();
    renderNvrGroupedTables();
    renderInventoryTable();
    renderVisuals();
  } catch (e) {
    console.error("Failed to load cameras", e);
  }
}

function updateStats() {
  const activeCams = cameras.filter(c => !c.is_no_cam);
  const total = activeCams.length;
  const online = activeCams.filter(c => c.status === "ONLINE").length;
  const warning = activeCams.filter(c => c.status === "WARNING").length;
  const offline = activeCams.filter(c => c.status === "OFFLINE").length;
  const noCamCount = cameras.filter(c => c.is_no_cam).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-online").textContent = online;
  document.getElementById("stat-warning").textContent = warning;
  document.getElementById("stat-offline").textContent = offline;
  const noCamElem = document.getElementById("stat-nocam");
  if (noCamElem) noCamElem.textContent = noCamCount;
}

// State for open/closed accordions and No Cam visibility
let nvrAccordionState = {};
let showNoCamState = {};

window.toggleShowNoCam = function(groupName) {
  showNoCamState[groupName] = !showNoCamState[groupName];
  renderNvrGroupedTables();
};

window.toggleNoCam = async function(id) {
  try {
    const res = await fetch(`/api/cameras/${id}/toggle-no-cam`, { method: "POST" });
    const data = await res.json();
    showToast("Camera Updated", data.message, false);
    loadCameras();
  } catch (e) {
    console.error("Failed to toggle no cam", e);
  }
};

function populateNvrFilter() {
  const select = document.getElementById("filter-nvr");
  const currentVal = select.value;
  const nvrs = [...new Set(cameras.map(c => c.dvr_nvr_name || "Direct IP / Unassigned"))].sort();
  select.innerHTML = `<option value="ALL">All NVRs / DVRs</option>`;
  nvrs.forEach(nvr => {
    const opt = document.createElement("option");
    opt.value = nvr;
    opt.textContent = nvr;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// Render NVR-Grouped Compact Tables
function renderNvrGroupedTables() {
  const container = document.getElementById("nvr-groups-container");
  const search = document.getElementById("cam-search").value.toLowerCase();
  const statusFilter = document.getElementById("filter-status").value;
  const nvrFilter = document.getElementById("filter-nvr").value;

  // Filter cameras
  const filtered = cameras.filter(c => {
    const matchesSearch = !search || 
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.ip_address && c.ip_address.includes(search)) ||
      (c.dvr_nvr_name && c.dvr_nvr_name.toLowerCase().includes(search)) ||
      (c.location && c.location.toLowerCase().includes(search)) ||
      (c.channel_no && c.channel_no.toString().includes(search));

    let matchesStatus = true;
    if (statusFilter === "PROBLEMS") {
      matchesStatus = !c.is_no_cam && (c.status === "OFFLINE" || c.status === "WARNING");
    } else if (statusFilter === "NO_CAM") {
      matchesStatus = !!c.is_no_cam;
    } else if (statusFilter !== "ALL") {
      matchesStatus = !c.is_no_cam && c.status === statusFilter;
    }

    const nvrKey = c.dvr_nvr_name || "Direct IP / Unassigned";
    const matchesNvr = nvrFilter === "ALL" || nvrKey === nvrFilter;

    return matchesSearch && matchesStatus && matchesNvr;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="stat-card" style="text-align: center; color: var(--text-muted); padding: 3rem;">No cameras match the selected search/status filter.</div>`;
    return;
  }

  // Group by NVR
  const groups = {};
  filtered.forEach(cam => {
    const groupName = cam.dvr_nvr_name || "Direct IP / Unassigned";
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        ip: cam.ip_address,
        cameras: []
      };
    }
    groups[groupName].cameras.push(cam);
  });

  const sortedGroupNames = Object.keys(groups).sort();

  container.innerHTML = sortedGroupNames.map(groupName => {
    const g = groups[groupName];
    const realCameras = g.cameras.filter(c => !c.is_no_cam);
    const noCamCameras = g.cameras.filter(c => c.is_no_cam);
    const activeInGroup = realCameras.length;
    const noCamInGroup = noCamCameras.length;
    const onlineInGroup = realCameras.filter(c => c.status === "ONLINE").length;
    const offlineInGroup = realCameras.filter(c => c.status === "OFFLINE").length;
    const warningInGroup = realCameras.filter(c => c.status === "WARNING").length;

    // Card status indicator
    let cardClass = "nvr-card";
    if (offlineInGroup > 0) cardClass += " has-offline";
    else if (warningInGroup > 0) cardClass += " has-warning";

    // Check if open in state (default open if has offline or search active)
    const isOpen = nvrAccordionState[groupName] ?? (offlineInGroup > 0 || search.length > 0 || true);
    if (isOpen) cardClass += " open";

    // Determine which cameras to show in table: hide No Cam unless user clicked showing or filtered by NO_CAM
    let visibleList = [];
    if (statusFilter === "NO_CAM") {
      visibleList = noCamCameras;
    } else if (showNoCamState[groupName] || search.length > 0) {
      visibleList = g.cameras;
    } else {
      visibleList = realCameras; // Default: HIDE No Cam from dashboard
    }

    const rowsHtml = visibleList.map(c => {
      let rowClass = "";
      if (c.is_no_cam) {
        rowClass = "nocam-row";
      } else if (c.status === "OFFLINE") {
        rowClass = "offline-row";
      } else if (c.status === "WARNING") {
        rowClass = "warning-row";
      }

      let dotClass = "";
      let badgeHtml = "";
      let statusReason = "";

      if (c.is_no_cam) {
        badgeHtml = `<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px dashed rgba(255,255,255,0.2);">NO CAM</span>`;
        statusReason = `<span style="color: var(--text-muted); font-size: 0.76rem;">Spare / Unassigned Port</span>`;
      } else {
        dotClass = c.status === "ONLINE" ? "online" : (c.status === "WARNING" ? "warning" : "offline");
        badgeHtml = `<span class="status-dot ${dotClass}"></span><span class="badge ${dotClass}">${c.status || 'UNKNOWN'}</span>`;
        statusReason = c.status === 'ONLINE' ? 'Healthy' : (c.last_error || 'Outage');
      }

      const actionButtons = c.is_no_cam ? `
        <button class="btn btn-sm" onclick="takeSnapshot(${c.id})" title="Capture live snapshot to verify camera view and OSD name" style="margin-right: 3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Snap
        </button>
        <button class="btn btn-sm" style="color: #60a5fa; font-size: 0.72rem; padding: 0.15rem 0.45rem;" onclick="toggleNoCam(${c.id})" title="Restore to active camera monitoring">Unmark</button>
      ` : `
        <button class="btn btn-sm" onclick="takeSnapshot(${c.id})" title="Capture live snapshot to verify camera view and OSD name" style="margin-right: 3px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Snap
        </button>
        <button class="btn btn-sm" onclick="checkCamera(${c.id})">Check</button>
        <button class="btn btn-sm" style="color: var(--text-muted); font-size: 0.72rem; padding: 0.15rem 0.45rem; margin-left: 3px;" onclick="toggleNoCam(${c.id})" title="Mark as empty/spare channel and hide from dashboard">No Cam</button>
      `;

      return `
        <tr class="${rowClass}">
          <td style="white-space: nowrap;">${badgeHtml}</td>
          <td style="font-weight: 600; color: var(--text-muted);">${c.channel_no ? 'Ch ' + c.channel_no : '---'}</td>
          <td style="font-weight: 600; ${c.is_no_cam ? 'color: var(--text-muted);' : ''}">${c.name || 'Unnamed'}</td>
          <td style="${c.is_no_cam ? 'color: var(--text-muted);' : ''}">${c.location || '---'}</td>
          <td style="font-family: monospace; font-size: 0.78rem;">${c.ip_address}:${c.port || 554}</td>
          <td>${!c.is_no_cam && c.status === 'ONLINE' ? c.latency_ms + 'ms' : '---'}</td>
          <td style="font-size: 0.78rem; color: ${!c.is_no_cam && c.status === 'OFFLINE' ? 'var(--offline)' : 'var(--text-muted)'};">
            ${statusReason}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join("");

    const meta = nvrMetadata[groupName] || {};
    const totalPorts = meta.total_channels || g.cameras.length;
    const usedPorts = meta.used_channels || g.cameras.length;
    const freePorts = Math.max(0, totalPorts - usedPorts);

    return `
      <div class="${cardClass}" id="nvr-card-${CSS.escape(groupName)}">
        <div class="nvr-header" onclick="toggleNvrAccordion('${escapeHtml(groupName)}')">
          <div class="nvr-title-group">
            <span class="nvr-chevron">▶</span>
            <span style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(groupName)}</span>
            ${groupName !== 'Direct IP / Unassigned' ? `
              <button class="btn-nvr-rename" onclick="event.stopPropagation(); openRenameNvrModal('${escapeHtml(groupName)}')" title="Rename recorder and all attached cameras">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Rename
              </button>
            ` : ''}
            <span style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">(${g.ip})</span>
            <span style="background: rgba(255,255,255,0.06); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; color: var(--text-secondary);">
              Ports: ${usedPorts}/${totalPorts} in use ${freePorts > 0 ? `(${freePorts} free)` : '(Full)'}
            </span>
          </div>

          <div class="nvr-badges">
            <span style="color: var(--text-muted); margin-right: 0.3rem;">${activeInGroup} Cams:</span>
            <span class="badge online">${onlineInGroup} Online</span>
            ${warningInGroup > 0 ? `<span class="badge warning">${warningInGroup} Warning</span>` : ''}
            ${offlineInGroup > 0 ? `<span class="badge offline">${offlineInGroup} Offline</span>` : ''}
            ${noCamInGroup > 0 ? `
              <button class="badge" style="cursor: pointer; background: rgba(255,255,255,0.06); border: 1px dashed var(--border-active); font-size: 0.72rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.3rem;" onclick="event.stopPropagation(); toggleShowNoCam('${escapeHtml(groupName)}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ${noCamInGroup} No Cam (${showNoCamState[groupName] ? 'Showing' : 'Hidden'})
              </button>
            ` : ''}
            <button class="btn btn-sm" style="margin-left: 0.4rem; padding: 0.2rem 0.55rem; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 0.35rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-active);" onclick="event.stopPropagation(); auditNvrChannels('${escapeHtml(groupName)}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 6 12 12 16 14"/></svg>
              Scan Ports
            </button>
          </div>
        </div>

        <div class="nvr-body">
          <table class="compact-table">
            <thead>
              <tr>
                <th style="width: 110px;">Status</th>
                <th style="width: 70px;">Channel</th>
                <th>Camera Name</th>
                <th>Location</th>
                <th>IP & Port</th>
                <th style="width: 80px;">Latency</th>
                <th>Status / Error Reason</th>
                <th style="width: 110px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.toggleNvrAccordion = function(groupName) {
  const card = document.getElementById(`nvr-card-${CSS.escape(groupName)}`);
  if (!card) return;
  const isCurrentlyOpen = card.classList.contains("open");
  if (isCurrentlyOpen) {
    card.classList.remove("open");
    nvrAccordionState[groupName] = false;
  } else {
    card.classList.add("open");
    nvrAccordionState[groupName] = true;
  }
};

document.getElementById("btn-expand-all").addEventListener("click", () => {
  document.querySelectorAll(".nvr-card").forEach(c => c.classList.add("open"));
  Object.keys(nvrAccordionState).forEach(k => nvrAccordionState[k] = true);
});

document.getElementById("btn-collapse-all").addEventListener("click", () => {
  document.querySelectorAll(".nvr-card").forEach(c => c.classList.remove("open"));
  Object.keys(nvrAccordionState).forEach(k => nvrAccordionState[k] = false);
});

document.getElementById("cam-search").addEventListener("input", renderNvrGroupedTables);
document.getElementById("filter-status").addEventListener("change", renderNvrGroupedTables);
document.getElementById("filter-nvr").addEventListener("change", renderNvrGroupedTables);

// Render Visuals & Heatmap Tab
function renderVisuals() {
  if (!cameras || cameras.length === 0) return;

  // 1. Group cameras by NVR for Rack Bay Heatmap
  const nvrMap = {};
  cameras.forEach(cam => {
    const nvr = cam.dvr_nvr_name || "Direct IP / Unassigned";
    if (!nvrMap[nvr]) {
      nvrMap[nvr] = {
        name: nvr,
        ip: cam.ip_address,
        cameras: []
      };
    }
    nvrMap[nvr].cameras.push(cam);
  });

  const sortedNvrKeys = Object.keys(nvrMap).sort();
  const heatmapGrid = document.getElementById("heatmap-grid");

  heatmapGrid.innerHTML = sortedNvrKeys.map(nvrKey => {
    const bay = nvrMap[nvrKey];
    const total = bay.cameras.length;
    const online = bay.cameras.filter(c => c.status === "ONLINE").length;
    const offline = bay.cameras.filter(c => c.status === "OFFLINE").length;
    const warning = bay.cameras.filter(c => c.status === "WARNING").length;

    let bayClass = "rack-bay";
    if (offline > 0) bayClass += " has-offline";

    const tilesHtml = bay.cameras.map((c, idx) => {
      const isNoCam = !!c.is_no_cam;
      const status = isNoCam ? 'NO_CAM' : (c.status || 'UNKNOWN');
      const ch = c.channel_no ? c.channel_no : (idx + 1);
      const title = isNoCam 
        ? `${c.name || 'Spare Channel'} (Ch ${ch}) • NO CAM (Spare Port)\nClick to inspect, snap, or restore to active` 
        : `${c.name || 'Camera'} (Ch ${ch}) • ${status}\nClick to inspect, snap, test connection, or toggle No Cam`;
      return `
        <div class="heatmap-cell status-${status}" 
             title="${title}" 
             onclick="openCameraQuickModal(${c.id})">
          ${ch}
        </div>
      `;
    }).join("");

    return `
      <div class="${bayClass}">
        <div class="rack-bay-label">
          <div class="rack-bay-name" title="${bay.name}">${bay.name}</div>
          <div class="rack-bay-sub">${bay.ip} • ${online}/${total} Online</div>
        </div>
        <div class="rack-bay-strip">
          ${tilesHtml}
        </div>
      </div>
    `;
  }).join("");

  // 2. NVR Health Bars
  const nvrHealthContainer = document.getElementById("nvr-health-bars");
  const groups = {};
  cameras.forEach(cam => {
    const nvr = cam.dvr_nvr_name || "Direct IP / Unassigned";
    if (!groups[nvr]) groups[nvr] = [];
    groups[nvr].push(cam);
  });

  const sortedNvrs = Object.keys(groups).sort();
  nvrHealthContainer.innerHTML = sortedNvrs.map(nvr => {
    const list = groups[nvr];
    const total = list.length;
    const online = list.filter(c => c.status === "ONLINE").length;
    const warning = list.filter(c => c.status === "WARNING").length;
    const offline = list.filter(c => c.status === "OFFLINE").length;

    const meta = nvrMetadata[nvr] || {};
    const totalPorts = meta.total_channels || total;
    const usedPorts = meta.used_channels || total;
    const freePorts = Math.max(0, totalPorts - usedPorts);

    const pctOnline = Math.round((online / totalPorts) * 100);
    const pctWarning = Math.round((warning / totalPorts) * 100);
    const pctOffline = Math.round((offline / totalPorts) * 100);
    const pctFree = Math.round((freePorts / totalPorts) * 100);

    return `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 600;">${nvr}</span>
          <span style="color: var(--text-muted); font-size: 0.76rem;">
            ${online} Online • ${usedPorts}/${totalPorts} Ports Used (${freePorts} Free)
          </span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-segment online" style="width: ${pctOnline}%;" title="${online} Online"></div>
          <div class="progress-segment warning" style="width: ${pctWarning}%;" title="${warning} Warning"></div>
          <div class="progress-segment offline" style="width: ${pctOffline}%;" title="${offline} Offline"></div>
        </div>
      </div>
    `;
  }).join("");

  // 3. Latency Distribution Tiles
  const fast = cameras.filter(c => c.status === "ONLINE" && c.latency_ms < 50).length;
  const normal = cameras.filter(c => c.status === "ONLINE" && c.latency_ms >= 50 && c.latency_ms < 200).length;
  const slow = cameras.filter(c => c.status === "ONLINE" && c.latency_ms >= 200).length;
  const down = cameras.filter(c => c.status === "OFFLINE").length;

  const latContainer = document.getElementById("latency-distribution");
  latContainer.innerHTML = `
    <div class="latency-tile">
      <div class="val" style="color: var(--status-online);">${fast}</div>
      <div class="lbl">Fast (&lt;50ms)</div>
    </div>
    <div class="latency-tile">
      <div class="val" style="color: #60a5fa;">${normal}</div>
      <div class="lbl">Normal (50-200ms)</div>
    </div>
    <div class="latency-tile">
      <div class="val" style="color: var(--status-warning);">${slow}</div>
      <div class="lbl">Slow (&gt;200ms)</div>
    </div>
    <div class="latency-tile">
      <div class="val" style="color: var(--status-offline);">${down}</div>
      <div class="lbl">Unreachable</div>
    </div>
  `;

  // 4. Physical Zone Breakdown
  const zones = {};
  cameras.forEach(c => {
    const z = c.location || "Unassigned Zone";
    if (!zones[z]) zones[z] = { total: 0, online: 0, offline: 0 };
    zones[z].total++;
    if (c.status === "ONLINE") zones[z].online++;
    if (c.status === "OFFLINE") zones[z].offline++;
  });

  const zoneList = document.getElementById("zone-summary-list");
  zoneList.innerHTML = Object.keys(zones).sort().map(z => {
    const item = zones[z];
    const isClean = item.offline === 0;
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary); padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem;">
        <span style="font-weight: 500;">${z}</span>
        <div>
          <span style="color: var(--text-muted); margin-right: 0.5rem;">${item.online}/${item.total}</span>
          <span class="badge ${isClean ? 'online' : 'offline'}">${isClean ? 'All Healthy' : item.offline + ' Down'}</span>
        </div>
      </div>
    `;
  }).join("");
}

// Manual Camera Re-Check
window.checkCamera = async function(id) {
  try {
    const res = await fetch(`/api/cameras/${id}/check`, { method: "POST" });
    const data = await res.json();
    showToast(`Checked Camera #${id}`, `${data.status}: ${data.message || ''}`, data.status !== 'ONLINE');
    loadCameras();
  } catch (e) {
    console.error("Check failed", e);
  }
};

// Scan All Now
document.getElementById("btn-scan-all").addEventListener("click", async () => {
  const btn = document.getElementById("btn-scan-all");
  btn.disabled = true;
  btn.textContent = "Scanning...";
  try {
    await fetch("/api/cameras/scan-all", { method: "POST" });
    showToast("Scan Started", "Scanning all 266 cameras across all NVRs in background...", false);
    // Poll updates every 2 seconds for a few moments
    let count = 0;
    const interval = setInterval(() => {
      loadCameras();
      count++;
      if (count > 5) clearInterval(interval);
    }, 2000);
  } catch (e) {
    console.error("Scan all failed", e);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Scan All Now";
    }, 4000);
  }
});

// Incidents
async function loadIncidents() {
  try {
    const res = await fetch("/api/incidents");
    const data = await res.json();

    const activeBody = document.getElementById("active-incidents-body");
    if (!data.active || data.active.length === 0) {
      activeBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1rem;">No active outages. All cameras healthy!</td></tr>`;
    } else {
      activeBody.innerHTML = data.active.map(inc => `
        <tr>
          <td style="font-weight: 600;">${inc.camera_name}</td>
          <td>${inc.dvr_nvr_name || 'N/A'}</td>
          <td>${inc.channel_no || 'N/A'}</td>
          <td>${inc.location || 'N/A'}</td>
          <td>${inc.started_at}</td>
          <td style="color: var(--offline);">${inc.error_reason}</td>
          <td><button class="btn btn-sm" onclick="ackIncident(${inc.id})">Acknowledge</button></td>
        </tr>
      `).join("");
    }

    const histBody = document.getElementById("history-incidents-body");
    if (!data.history || data.history.length === 0) {
      histBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1rem;">No incident history recorded.</td></tr>`;
    } else {
      histBody.innerHTML = data.history.map(inc => `
        <tr>
          <td>${inc.camera_name}</td>
          <td>${inc.dvr_nvr_name || 'N/A'}</td>
          <td>${inc.channel_no || 'N/A'}</td>
          <td>${inc.location || 'N/A'}</td>
          <td>${inc.started_at}</td>
          <td>${inc.resolved_at || '<span style="color: var(--offline)">Ongoing</span>'}</td>
          <td>${inc.duration_seconds ? inc.duration_seconds + 's' : '---'}</td>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${inc.error_reason}</td>
        </tr>
      `).join("");
    }
  } catch (e) {
    console.error("Failed to load incidents", e);
  }
}

document.getElementById("btn-refresh-incidents").addEventListener("click", loadIncidents);

window.ackIncident = async function(id) {
  await fetch(`/api/incidents/${id}/ack`, { method: "POST" });
  loadIncidents();
};

// Copy stream URL helper
window.copyStreamUrl = function(id) {
  const cam = cameras.find(c => c.id === id);
  if (!cam) return;
  const url = cam.masked_url || cam.rtsp_url;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast("Copied to Clipboard", "RTSP stream URL copied", false);
    }).catch(() => {
      prompt("Copy RTSP URL:", url);
    });
  } else {
    prompt("Copy RTSP URL:", url);
  }
};

// Camera Inventory Table & Form Modal
function renderInventoryTable() {
  const tbody = document.getElementById("camera-inventory-body");
  const countBadge = document.getElementById("inventory-count");
  const searchFilter = (document.getElementById("inventory-search")?.value || "").trim().toLowerCase();

  let list = cameras;
  if (searchFilter) {
    list = cameras.filter(c => 
      (c.name && c.name.toLowerCase().includes(searchFilter)) ||
      (c.dvr_nvr_name && c.dvr_nvr_name.toLowerCase().includes(searchFilter)) ||
      (c.location && c.location.toLowerCase().includes(searchFilter)) ||
      (c.ip_address && c.ip_address.includes(searchFilter)) ||
      (c.channel_no && String(c.channel_no).includes(searchFilter))
    );
  }

  if (countBadge) {
    countBadge.textContent = `${list.length} of ${cameras.length} cameras`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">${cameras.length === 0 ? 'No cameras configured. Click "+ Add Camera" or import a CSV!' : 'No cameras match your search filter.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr class="${c.is_no_cam ? 'nocam-row' : ''}">
      <td style="font-weight: 600; white-space: nowrap; ${c.is_no_cam ? 'color: var(--text-muted);' : ''}">
        ${c.name}
      </td>
      <td style="white-space: nowrap; ${c.is_no_cam ? 'color: var(--text-muted);' : ''}">
        <div style="display: inline-flex; align-items: center; gap: 0.45rem;">
          <span>${c.dvr_nvr_name || 'N/A'}</span>
          <span class="ch-tag">${c.channel_no ? 'Ch ' + c.channel_no : '---'}</span>
        </div>
      </td>
      <td style="white-space: nowrap; ${c.is_no_cam ? 'color: var(--text-muted);' : ''}">
        ${c.location || 'N/A'}
      </td>
      <td style="font-family: monospace; font-size: 0.8rem; white-space: nowrap;">
        ${c.ip_address}:${c.port || 554}
      </td>
      <td>
        <div class="stream-url-pill" onclick="copyStreamUrl(${c.id})" title="Click to copy stream URL: ${c.masked_url}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span class="stream-url-text">${c.masked_url}</span>
        </div>
      </td>
      <td style="white-space: nowrap;">
        ${c.is_no_cam 
          ? `<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px dashed rgba(255,255,255,0.2);">NO CAM</span>` 
          : `<span class="badge ${c.status === 'ONLINE' ? 'online' : (c.status === 'WARNING' ? 'warning' : 'offline')}">${c.status}</span>`
        }
      </td>
      <td style="white-space: nowrap; text-align: right;">
        <div class="row-actions">
          <button class="btn btn-sm" onclick="takeSnapshot(${c.id})" title="Capture live snapshot" style="display: inline-flex; align-items: center; gap: 3px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Snap
          </button>
          <button class="btn btn-sm" onclick="editCamera(${c.id})">Edit</button>
          <button class="btn btn-sm ${c.is_no_cam ? 'btn-nocam-active' : ''}" onclick="toggleNoCam(${c.id})" title="${c.is_no_cam ? 'Restore to active' : 'Mark as spare'}">
            ${c.is_no_cam ? 'Unmark' : 'No Cam'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCamera(${c.id})">Del</button>
        </div>
      </td>
    </tr>
  `).join("");
}

const invSearchInput = document.getElementById("inventory-search");
if (invSearchInput) {
  invSearchInput.addEventListener("input", renderInventoryTable);
}

const modal = document.getElementById("camera-modal");
document.getElementById("btn-add-camera").addEventListener("click", () => {
  document.getElementById("modal-title").textContent = "Add Camera";
  document.getElementById("camera-form").reset();
  document.getElementById("form-cam-id").value = "";
  document.getElementById("form-cam-nocam").checked = false;

  const nvrInput = document.getElementById("form-cam-nvr");
  nvrInput.readOnly = false;
  nvrInput.style.cursor = "text";
  nvrInput.style.opacity = "1";
  nvrInput.removeAttribute("title");
  const hint = document.getElementById("form-cam-nvr-hint");
  if (hint) hint.style.display = "none";

  modal.classList.add("active");
});

document.getElementById("btn-close-modal").addEventListener("click", () => modal.classList.remove("active"));
document.getElementById("btn-cancel-modal").addEventListener("click", () => modal.classList.remove("active"));

document.getElementById("camera-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("form-cam-id").value;
  const isNoCam = document.getElementById("form-cam-nocam").checked;
  const payload = {
    name: document.getElementById("form-cam-name").value,
    dvr_nvr_name: document.getElementById("form-cam-nvr").value,
    location: document.getElementById("form-cam-location").value,
    ip_address: document.getElementById("form-cam-ip").value,
    port: parseInt(document.getElementById("form-cam-port").value) || 554,
    channel_no: document.getElementById("form-cam-ch").value,
    rtsp_url: document.getElementById("form-cam-url").value,
    is_no_cam: isNoCam
  };

  try {
    if (id) {
      await fetch(`/api/cameras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch("/api/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
    modal.classList.remove("active");
    loadCameras();
  } catch (err) {
    alert("Failed to save camera: " + err);
  }
});

window.editCamera = function(id) {
  const c = cameras.find(cam => cam.id === id);
  if (!c) return;
  document.getElementById("modal-title").textContent = "Edit Camera";
  document.getElementById("form-cam-id").value = c.id;
  document.getElementById("form-cam-name").value = c.name;

  const nvrInput = document.getElementById("form-cam-nvr");
  nvrInput.value = c.dvr_nvr_name || "";
  nvrInput.readOnly = true;
  nvrInput.style.cursor = "not-allowed";
  nvrInput.style.opacity = "0.75";
  nvrInput.title = "Recorder name is managed per-NVR. Use Rename on Dashboard to rename this recorder across all cameras.";
  const hint = document.getElementById("form-cam-nvr-hint");
  if (hint) hint.style.display = "block";

  document.getElementById("form-cam-location").value = c.location || "";
  document.getElementById("form-cam-ip").value = c.ip_address;
  document.getElementById("form-cam-port").value = c.port || 554;
  document.getElementById("form-cam-ch").value = c.channel_no || "";
  document.getElementById("form-cam-url").value = c.rtsp_url;
  document.getElementById("form-cam-nocam").checked = !!c.is_no_cam;
  modal.classList.add("active");
};

// NVR Rename Modal Handlers
window.openRenameNvrModal = function(nvrName) {
  const nvrCams = cameras.filter(c => (c.dvr_nvr_name || "").toLowerCase() === nvrName.toLowerCase());
  document.getElementById("rename-nvr-old-name").value = nvrName;
  document.getElementById("rename-nvr-new-name").value = nvrName;
  document.getElementById("rename-nvr-title").textContent = `Rename Recorder: ${nvrName}`;
  document.getElementById("rename-nvr-cam-count").textContent = `${nvrCams.length} cameras`;
  document.getElementById("rename-nvr-modal").classList.add("active");
  setTimeout(() => {
    const input = document.getElementById("rename-nvr-new-name");
    input.focus();
    input.select();
  }, 100);
};

document.getElementById("btn-close-rename-nvr").addEventListener("click", () => {
  document.getElementById("rename-nvr-modal").classList.remove("active");
});
document.getElementById("btn-cancel-rename-nvr").addEventListener("click", () => {
  document.getElementById("rename-nvr-modal").classList.remove("active");
});

document.getElementById("rename-nvr-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const oldName = document.getElementById("rename-nvr-old-name").value.trim();
  const newName = document.getElementById("rename-nvr-new-name").value.trim();
  if (!newName) {
    alert("Please enter a valid recorder name.");
    return;
  }
  if (oldName === newName) {
    document.getElementById("rename-nvr-modal").classList.remove("active");
    return;
  }

  const btn = document.getElementById("btn-submit-rename-nvr");
  btn.disabled = true;
  btn.textContent = "Renaming...";

  try {
    const res = await fetch(`/api/nvrs/${encodeURIComponent(oldName)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: newName })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Rename failed");
    }

    // Preserve accordion open state
    if (nvrAccordionState[oldName]) {
      nvrAccordionState[newName] = true;
      delete nvrAccordionState[oldName];
    }

    showToast("Recorder Renamed", data.message, false);
    document.getElementById("rename-nvr-modal").classList.remove("active");
    await loadCameras();
  } catch (err) {
    alert("Error renaming recorder: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Rename All Cameras";
  }
});

window.deleteCamera = async function(id) {
  if (!confirm("Are you sure you want to delete this camera?")) return;
  await fetch(`/api/cameras/${id}`, { method: "DELETE" });
  loadCameras();
};

// CSV Upload
document.getElementById("btn-upload-csv").addEventListener("click", async () => {
  const fileInput = document.getElementById("csv-file-input");
  if (!fileInput.files[0]) {
    alert("Please select a CSV file first");
    return;
  }
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  const userIn = document.getElementById("csv-username-input");
  const passIn = document.getElementById("csv-password-input");
  if (userIn && userIn.value.trim()) {
    formData.append("default_username", userIn.value.trim());
  }
  if (passIn && passIn.value) {
    formData.append("default_password", passIn.value);
  }

  const resDiv = document.getElementById("csv-upload-result");
  resDiv.textContent = "Uploading & importing...";

  try {
    const res = await fetch("/api/cameras/csv/import", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    resDiv.innerHTML = `<span style="color: var(--online)">Successfully imported ${data.imported_count} cameras!</span>`;
    if (data.errors && data.errors.length > 0) {
      resDiv.innerHTML += `<div style="color: var(--warning); margin-top: 0.5rem;">Warnings / Errors:</div><ul>` +
        data.errors.map(err => `<li>${err}</li>`).join("") + `</ul>`;
    }
    loadCameras();
  } catch (e) {
    resDiv.innerHTML = `<span style="color: var(--offline)">Failed to upload CSV: ${e}</span>`;
  }
});

// Settings Form
async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const s = await res.json();
    if (s.failure_threshold) document.getElementById("setting-failure-threshold").value = s.failure_threshold;
    if (s.socket_timeout_ms) document.getElementById("setting-socket-timeout").value = s.socket_timeout_ms;
    if (s.ping_interval_seconds) document.getElementById("setting-ping-interval").value = s.ping_interval_seconds;
    if (s.latency_warning_threshold_ms) document.getElementById("setting-latency-warning").value = s.latency_warning_threshold_ms;
    if (s.max_concurrency_per_host) document.getElementById("setting-max-concurrency").value = s.max_concurrency_per_host;
  } catch (e) {
    console.error("Failed to load settings", e);
  }
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    failure_threshold: document.getElementById("setting-failure-threshold").value,
    socket_timeout_ms: document.getElementById("setting-socket-timeout").value,
    ping_interval_seconds: document.getElementById("setting-ping-interval").value,
    latency_warning_threshold_ms: document.getElementById("setting-latency-warning").value,
    max_concurrency_per_host: document.getElementById("setting-max-concurrency").value
  };
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  showToast("Settings Saved", "Monitoring thresholds have been updated", false);
});

// Seed 270 Demo Cameras
document.getElementById("btn-seed-270").addEventListener("click", async () => {
  if (!confirm("This will replace current cameras with 270 realistic mock cameras across 10 NVRs. Proceed?")) return;
  const res = await fetch("/api/simulator/seed-270", { method: "POST" });
  const data = await res.json();
  showToast("Simulation Loaded", data.message, false);
  loadCameras();
});

// Connect to Live SSE Event Stream
function connectSSE() {
  const evtSource = new EventSource("/api/events");
  evtSource.onmessage = function(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "CAMERA_DOWN") {
        playChime(true);
        showToast(`🚨 Camera Down: ${msg.camera.name}`, `${msg.incident.error_reason}`, true);
        loadCameras();
      } else if (msg.type === "CAMERA_RECOVERED") {
        playChime(false);
        showToast(`✅ Camera Recovered: ${msg.camera.name}`, `Back online after ${msg.duration_seconds}s downtime`, false);
        loadCameras();
      } else if (msg.type === "CAMERA_UPDATE") {
        loadCameras();
      }
    } catch (e) {
      console.error("Error parsing SSE event", e);
    }
  };
  evtSource.onerror = function() {
    setTimeout(connectSSE, 3000);
  };
}

// Initial Boot
window.addEventListener("DOMContentLoaded", () => {
  loadCameras();
  connectSSE();
});

// NVR Port Diagnostics Modal Logic
const nvrAuditModal = document.getElementById("nvr-audit-modal");
const btnCloseNvrAudit = document.getElementById("btn-close-nvr-audit");

if (btnCloseNvrAudit) {
  btnCloseNvrAudit.addEventListener("click", () => {
    nvrAuditModal.classList.remove("active");
  });
}

window.auditNvrChannels = async function(nvrName) {
  nvrAuditModal.classList.add("active");
  const title = document.getElementById("nvr-audit-title");
  const subtitle = document.getElementById("nvr-audit-subtitle");
  const content = document.getElementById("nvr-audit-content");

  title.textContent = `Diagnostic Port Audit: ${nvrName}`;
  subtitle.textContent = "Connecting via RTSP DESCRIBE (Digest Auth)...";
  content.innerHTML = `
    <div style="text-align: center; padding: 3rem 1rem;">
      <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--status-online); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.3rem;">Sweeping NVR Ports via RTSP DESCRIBE...</div>
      <div style="color: var(--text-muted); font-size: 0.8rem; max-width: 480px; margin: 0 auto;">
        Testing each physical channel for active video stream headers. Throttled to 2 concurrent requests to maintain zero NVR CPU load.
      </div>
    </div>
  `;

  try {
    const res = await fetch(`/api/nvrs/${encodeURIComponent(nvrName)}/audit-channels`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Diagnostic audit request failed");
    }
    const data = await res.json();
    renderNvrAuditResults(data);
  } catch (err) {
    content.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--status-offline);">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">Diagnostic Probe Failed</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); font-family: monospace;">${escapeHtml(err.message)}</div>
      </div>
    `;
  }
};

function renderNvrAuditResults(data) {
  const subtitle = document.getElementById("nvr-audit-subtitle");
  const content = document.getElementById("nvr-audit-content");

  subtitle.innerHTML = `
    Host: <strong style="color: var(--text-primary);">${data.ip_address}:${data.port}</strong> • 
    Total Hardware Ports: <strong style="color: var(--text-primary);">${data.total_channels}</strong>
  `;

  const rows = data.channels.map(ch => {
    let statusBadge = "";
    let rowBg = "";
    if (ch.status === "STREAMING") {
      statusBadge = `<span class="badge online">Streaming (200 OK)</span>`;
    } else if (ch.status === "EMPTY") {
      statusBadge = `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Empty (404)</span>`;
    } else {
      statusBadge = `<span class="badge offline">${escapeHtml(ch.status)}</span>`;
    }

    let discrepancy = "";
    if (ch.is_configured && ch.status === "EMPTY") {
      discrepancy = `<div style="color: var(--status-warning); font-size: 0.72rem; margin-top: 2px;">⚠️ Configured in system, but hardware port returned 404 (camera dead or unplugged)</div>`;
      rowBg = "background: rgba(245, 158, 11, 0.04);";
    } else if (!ch.is_configured && ch.status === "STREAMING") {
      discrepancy = `<div style="color: #60a5fa; font-size: 0.72rem; margin-top: 2px;">💡 Active camera detected streaming on unconfigured channel</div>`;
      rowBg = "background: rgba(96, 165, 250, 0.04);";
    }

    const codecText = ch.codec && ch.codec !== "Unknown" ? `${ch.codec} ${ch.fps ? '@ ' + ch.fps + 'fps' : ''}` : '---';

    return `
      <tr style="${rowBg}">
        <td style="font-weight: 700; font-family: monospace; font-size: 0.85rem;">Ch ${ch.channel < 10 ? '0' + ch.channel : ch.channel}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.8rem; font-family: monospace; color: var(--text-secondary);">${codecText}</td>
        <td style="font-size: 0.8rem;">${ch.latency_ms > 0 ? ch.latency_ms + 'ms' : '---'}</td>
        <td>
          <div style="font-weight: 600; font-size: 0.82rem;">${escapeHtml(ch.camera_name || 'Unassigned Port')}</div>
          ${ch.location ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(ch.location)}</div>` : ''}
          ${discrepancy}
        </td>
      </tr>
    `;
  }).join("");

  content.innerHTML = `
    <!-- Top Summary Metric Cards -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
      <div class="stat-card" style="padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: var(--text-muted);">Hardware Ports</div>
        <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${data.total_channels}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: var(--text-muted);">Configured Cams</div>
        <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${data.configured_channels}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: var(--text-muted);">Active Streaming</div>
        <div style="font-size: 1.25rem; font-weight: 700; color: var(--status-online);">${data.detected_streaming}</div>
      </div>
      <div class="stat-card" style="padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: var(--text-muted);">Empty / Free Ports</div>
        <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-muted);">${data.detected_empty}</div>
      </div>
    </div>

    <!-- Diagnostic Channel Table -->
    <table class="compact-table" style="font-size: 0.8rem;">
      <thead>
        <tr>
          <th style="width: 70px;">Port</th>
          <th style="width: 140px;">RTSP Status</th>
          <th style="width: 140px;">Codec & FPS</th>
          <th style="width: 80px;">Latency</th>
          <th>Configured Camera & Diagnostic Findings</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Snapshot Preview Modal Logic
const snapshotModal = document.getElementById("snapshot-modal");
const btnCloseSnapshot = document.getElementById("btn-close-snapshot");
const btnRefreshSnapshot = document.getElementById("btn-refresh-snapshot");
let currentSnapshotCamId = null;

if (btnCloseSnapshot) {
  btnCloseSnapshot.addEventListener("click", () => {
    snapshotModal.classList.remove("active");
  });
}

if (btnRefreshSnapshot) {
  btnRefreshSnapshot.addEventListener("click", () => {
    if (currentSnapshotCamId) takeSnapshot(currentSnapshotCamId);
  });
}

window.takeSnapshot = async function(id) {
  currentSnapshotCamId = id;
  snapshotModal.classList.add("active");

  const title = document.getElementById("snapshot-title");
  const subtitle = document.getElementById("snapshot-subtitle");
  const body = document.getElementById("snapshot-body");
  const meta = document.getElementById("snapshot-meta");

  const cam = cameras.find(c => c.id === id) || { name: `Camera #${id}`, location: "" };
  title.textContent = `Snapshot: ${cam.name}`;
  subtitle.textContent = `Connecting to stream and capturing live frame...`;
  body.innerHTML = `
    <div style="padding: 3rem 1rem;">
      <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--status-online); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.3rem;">Capturing Live Frame...</div>
      <div style="color: var(--text-muted); font-size: 0.8rem;">Decoding single JPEG from RTSP feed to verify physical view and OSD timestamp</div>
    </div>
  `;

  try {
    const res = await fetch(`/api/cameras/${id}/snapshot`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to capture snapshot");
    }
    const data = await res.json();
    subtitle.innerHTML = `NVR: <strong>${data.dvr_nvr_name || 'N/A'}</strong> • Channel: <strong>Ch ${data.channel_no || '---'}</strong> • Location: <strong>${data.location || 'N/A'}</strong>`;
    body.innerHTML = `
      <div style="position: relative; display: inline-block; max-width: 100%;">
        <img src="${data.image_url}" alt="Snapshot of ${data.camera_name}" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--border-active); box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: block;" />
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 0.4rem; padding: 0 0.2rem;">
          <span>↙ OSD Camera Name in bottom-left</span>
          <span>Captured at ${data.captured_at}</span>
          <span>OSD Timestamp in top-right ↗</span>
        </div>
      </div>
    `;
    meta.textContent = `Mean Brightness: ${Math.round(data.mean_intensity || 0)} / 255 • Resolution: 720p`;
  } catch (err) {
    body.innerHTML = `
      <div style="padding: 2.5rem 1rem; color: var(--status-offline);">
        <div style="font-weight: 700; margin-bottom: 0.5rem; font-size: 1rem;">Snapshot Capture Failed</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); font-family: monospace; max-width: 520px; margin: 0 auto;">${escapeHtml(err.message)}</div>
      </div>
    `;
    subtitle.textContent = "Error capturing stream";
  }
};

// Camera Quick Action Modal (Bird's-Eye Heatmap Interaction)
const quickModal = document.getElementById("camera-quick-modal");
const btnCloseQuickModal = document.getElementById("btn-close-quick-modal");
const btnDoneQuickModal = document.getElementById("btn-done-quick-modal");

if (btnCloseQuickModal) {
  btnCloseQuickModal.addEventListener("click", () => {
    if (quickModal) quickModal.classList.remove("active");
  });
}

if (btnDoneQuickModal) {
  btnDoneQuickModal.addEventListener("click", () => {
    if (quickModal) quickModal.classList.remove("active");
  });
}

if (quickModal) {
  quickModal.addEventListener("click", (e) => {
    if (e.target === quickModal) {
      quickModal.classList.remove("active");
    }
  });
}

window.openCameraQuickModal = function(id) {
  const cam = cameras.find(c => c.id === id);
  if (!cam) return;

  const isNoCam = !!cam.is_no_cam;
  const ch = cam.channel_no ? cam.channel_no : '---';

  const nameEl = document.getElementById("quick-cam-name");
  const subEl = document.getElementById("quick-cam-sub");
  const detailsEl = document.getElementById("quick-cam-details");
  const btnSnap = document.getElementById("btn-quick-snap");
  const btnCheck = document.getElementById("btn-quick-check");
  const btnToggle = document.getElementById("btn-quick-toggle-nocam");
  const hintEl = document.getElementById("quick-cam-hint");

  nameEl.innerHTML = `${escapeHtml(cam.name || 'Camera')} <span style="font-weight: 400; color: var(--text-muted); font-size: 0.85rem;">(Ch ${ch})</span>`;
  subEl.innerHTML = `Recorder: <strong style="color: var(--text-primary);">${escapeHtml(cam.dvr_nvr_name || 'Direct IP')}</strong> • Location: <strong style="color: var(--text-primary);">${escapeHtml(cam.location || 'N/A')}</strong>`;

  const statusBadge = isNoCam 
    ? `<span class="badge" style="border: 1px dashed rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); color: var(--text-muted);">SPARE / NO CAM</span>`
    : `<span class="badge ${cam.status ? cam.status.toLowerCase() : 'offline'}">${cam.status || 'UNKNOWN'}</span>`;

  detailsEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; background: var(--bg-primary); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-subtle); margin-top: 0.5rem;">
      <div>
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Monitoring State</div>
        <div style="margin-top: 0.25rem;">${statusBadge}</div>
      </div>
      <div>
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Network Target</div>
        <div style="font-family: monospace; font-size: 0.8rem; margin-top: 0.25rem;">${escapeHtml(cam.ip_address || '---')}:${cam.port || 554}</div>
      </div>
      <div>
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Roundtrip Latency</div>
        <div style="font-size: 0.8rem; margin-top: 0.25rem; font-weight: 500;">${cam.latency_ms ? cam.latency_ms + ' ms' : '---'}</div>
      </div>
      <div>
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Last Health Diagnostic</div>
        <div style="font-size: 0.75rem; margin-top: 0.25rem; color: ${cam.last_error ? 'var(--status-offline)' : 'var(--text-secondary)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(cam.last_error || '')}">
          ${escapeHtml(cam.last_error || (isNoCam ? 'Ignored from outage alerts' : 'Normal / OK'))}
        </div>
      </div>
    </div>
  `;

  // Action: Live Snapshot
  btnSnap.onclick = () => {
    quickModal.classList.remove("active");
    takeSnapshot(cam.id);
  };

  // Action: Test Ping
  btnCheck.onclick = async () => {
    btnCheck.disabled = true;
    btnCheck.textContent = "Checking...";
    try {
      await checkCamera(cam.id);
      openCameraQuickModal(cam.id);
    } finally {
      btnCheck.disabled = false;
      btnCheck.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Test Connection
      `;
    }
  };

  // Action: Toggle No Cam
  if (isNoCam) {
    btnToggle.className = "btn btn-sm";
    btnToggle.style.color = "#60a5fa";
    btnToggle.style.borderColor = "rgba(96, 165, 250, 0.4)";
    btnToggle.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      Restore to Active Camera
    `;
    hintEl.innerHTML = `ℹ️ This channel is currently designated <strong>"No Cam" (Spare)</strong>. It is isolated from offline alerts and uptime stats. Click <em>Restore to Active Camera</em> to monitor this port.`;
  } else {
    btnToggle.className = "btn btn-sm";
    btnToggle.style.color = "var(--text-muted)";
    btnToggle.style.borderColor = "var(--border-subtle)";
    btnToggle.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      Mark as "No Cam" (Spare)
    `;
    hintEl.innerHTML = `ℹ️ "No Cam" designates an empty or spare port on this recorder. Marking it as "No Cam" prevents false offline alarms and isolates unused ports from plant health statistics.`;
  }

  btnToggle.onclick = async () => {
    quickModal.classList.remove("active");
    await toggleNoCam(cam.id);
    renderVisuals();
  };

  quickModal.classList.add("active");
};



