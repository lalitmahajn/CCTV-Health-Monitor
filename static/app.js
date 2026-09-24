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
  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${isOutage ? '🚨' : '✅'}</span>
    <div>
      <div style="font-weight: 600;">${title}</div>
      <div style="font-size: 0.78rem; opacity: 0.85;">${message}</div>
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

// Load Cameras
async function loadCameras() {
  try {
    const res = await fetch("/api/cameras");
    cameras = await res.json();
    updateStats();
    populateNvrFilter();
    renderNvrGroupedTables();
    renderInventoryTable();
  } catch (e) {
    console.error("Failed to load cameras", e);
  }
}

function updateStats() {
  const total = cameras.length;
  const online = cameras.filter(c => c.status === "ONLINE").length;
  const warning = cameras.filter(c => c.status === "WARNING").length;
  const offline = cameras.filter(c => c.status === "OFFLINE").length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-online").textContent = online;
  document.getElementById("stat-warning").textContent = warning;
  document.getElementById("stat-offline").textContent = offline;
}

// State for open/closed accordions
let nvrAccordionState = {};

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
      matchesStatus = c.status === "OFFLINE" || c.status === "WARNING";
    } else if (statusFilter !== "ALL") {
      matchesStatus = c.status === statusFilter;
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
    const totalInGroup = g.cameras.length;
    const onlineInGroup = g.cameras.filter(c => c.status === "ONLINE").length;
    const offlineInGroup = g.cameras.filter(c => c.status === "OFFLINE").length;
    const warningInGroup = g.cameras.filter(c => c.status === "WARNING").length;

    // Card status indicator
    let cardClass = "nvr-card";
    if (offlineInGroup > 0) cardClass += " has-offline";
    else if (warningInGroup > 0) cardClass += " has-warning";

    // Check if open in state (default open if has offline or search active)
    const isOpen = nvrAccordionState[groupName] ?? (offlineInGroup > 0 || search.length > 0 || true);
    if (isOpen) cardClass += " open";

    const rowsHtml = g.cameras.map(c => {
      let rowClass = "";
      if (c.status === "OFFLINE") rowClass = "offline-row";
      else if (c.status === "WARNING") rowClass = "warning-row";

      const dotClass = c.status === "ONLINE" ? "online" : (c.status === "WARNING" ? "warning" : "offline");

      return `
        <tr class="${rowClass}">
          <td style="white-space: nowrap;">
            <span class="status-dot ${dotClass}"></span>
            <span class="badge ${dotClass}">${c.status || 'UNKNOWN'}</span>
          </td>
          <td style="font-weight: 600; color: var(--text-muted);">${c.channel_no ? 'Ch ' + c.channel_no : '---'}</td>
          <td style="font-weight: 600;">${c.name || 'Unnamed'}</td>
          <td>${c.location || '---'}</td>
          <td style="font-family: monospace; font-size: 0.78rem;">${c.ip_address}:${c.port || 554}</td>
          <td>${c.status === 'ONLINE' ? c.latency_ms + 'ms' : '---'}</td>
          <td style="font-size: 0.78rem; color: ${c.status === 'OFFLINE' ? 'var(--offline)' : 'var(--text-muted)'};">
            ${c.status === 'ONLINE' ? 'Healthy' : (c.last_error || 'Outage')}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-sm" onclick="checkCamera(${c.id})">🔍 Check</button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="${cardClass}" id="nvr-card-${CSS.escape(groupName)}">
        <div class="nvr-header" onclick="toggleNvrAccordion('${escapeHtml(groupName)}')">
          <div class="nvr-title-group">
            <span class="nvr-chevron">▶</span>
            <span style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(groupName)}</span>
            <span style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">(${g.ip})</span>
          </div>

          <div class="nvr-badges">
            <span style="color: var(--text-muted); margin-right: 0.4rem;">${totalInGroup} Cams:</span>
            <span class="badge online">🟢 ${onlineInGroup}</span>
            ${warningInGroup > 0 ? `<span class="badge warning">🟡 ${warningInGroup}</span>` : ''}
            ${offlineInGroup > 0 ? `<span class="badge offline">🔴 ${offlineInGroup}</span>` : ''}
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
                <th style="width: 80px; text-align: right;">Action</th>
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
  for (const c of cameras.slice(0, 10)) { // quick sample scan
    await fetch(`/api/cameras/${c.id}/check`, { method: "POST" });
  }
  btn.disabled = false;
  btn.textContent = "🔄 Scan All Now";
  loadCameras();
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

// Camera Inventory Table & Form Modal
function renderInventoryTable() {
  const tbody = document.getElementById("camera-inventory-body");
  if (cameras.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No cameras configured. Click "+ Add Camera" or import a CSV!</td></tr>`;
    return;
  }
  tbody.innerHTML = cameras.map(c => `
    <tr>
      <td style="font-weight: 600;">${c.name}</td>
      <td>${c.dvr_nvr_name || 'N/A'}</td>
      <td>${c.channel_no || 'N/A'}</td>
      <td>${c.location || 'N/A'}</td>
      <td>${c.ip_address}</td>
      <td>${c.port || 554}</td>
      <td style="font-family: monospace; font-size: 0.75rem;">${c.masked_url}</td>
      <td><span class="badge ${c.status === 'ONLINE' ? 'online' : (c.status === 'WARNING' ? 'warning' : 'offline')}">${c.status}</span></td>
      <td>
        <button class="btn btn-sm" onclick="editCamera(${c.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCamera(${c.id})">Delete</button>
      </td>
    </tr>
  `).join("");
}

const modal = document.getElementById("camera-modal");
document.getElementById("btn-add-camera").addEventListener("click", () => {
  document.getElementById("modal-title").textContent = "Add Camera";
  document.getElementById("camera-form").reset();
  document.getElementById("form-cam-id").value = "";
  modal.classList.add("active");
});

document.getElementById("btn-close-modal").addEventListener("click", () => modal.classList.remove("active"));
document.getElementById("btn-cancel-modal").addEventListener("click", () => modal.classList.remove("active"));

document.getElementById("camera-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("form-cam-id").value;
  const payload = {
    name: document.getElementById("form-cam-name").value,
    dvr_nvr_name: document.getElementById("form-cam-nvr").value,
    location: document.getElementById("form-cam-location").value,
    ip_address: document.getElementById("form-cam-ip").value,
    port: parseInt(document.getElementById("form-cam-port").value) || 554,
    channel_no: document.getElementById("form-cam-ch").value,
    rtsp_url: document.getElementById("form-cam-url").value
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
  document.getElementById("form-cam-nvr").value = c.dvr_nvr_name || "";
  document.getElementById("form-cam-location").value = c.location || "";
  document.getElementById("form-cam-ip").value = c.ip_address;
  document.getElementById("form-cam-port").value = c.port || 554;
  document.getElementById("form-cam-ch").value = c.channel_no || "";
  document.getElementById("form-cam-url").value = c.rtsp_url;
  modal.classList.add("active");
};

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
