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
    renderCameraGrid();
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

function populateNvrFilter() {
  const select = document.getElementById("filter-nvr");
  const currentVal = select.value;
  const nvrs = [...new Set(cameras.map(c => c.dvr_nvr_name).filter(Boolean))].sort();
  select.innerHTML = `<option value="ALL">All NVRs / DVRs</option>`;
  nvrs.forEach(nvr => {
    const opt = document.createElement("option");
    opt.value = nvr;
    opt.textContent = nvr;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// Render Dashboard Grid
function renderCameraGrid() {
  const container = document.getElementById("camera-container");
  const search = document.getElementById("cam-search").value.toLowerCase();
  const statusFilter = document.getElementById("filter-status").value;
  const nvrFilter = document.getElementById("filter-nvr").value;

  const filtered = cameras.filter(c => {
    const matchesSearch = !search || 
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.ip_address && c.ip_address.includes(search)) ||
      (c.dvr_nvr_name && c.dvr_nvr_name.toLowerCase().includes(search)) ||
      (c.location && c.location.toLowerCase().includes(search)) ||
      (c.channel_no && c.channel_no.toString().includes(search));

    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesNvr = nvrFilter === "ALL" || c.dvr_nvr_name === nvrFilter;

    return matchesSearch && matchesStatus && matchesNvr;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No cameras match the current filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const statusClass = c.status === "ONLINE" ? "online" : (c.status === "WARNING" ? "warning" : "offline");
    return `
      <div class="cam-card status-${c.status}">
        <div class="cam-header">
          <div class="cam-name">${c.name || 'Unnamed Cam'}</div>
          <span class="badge ${statusClass}">
            ● ${c.status || 'UNKNOWN'}
          </span>
        </div>

        <div class="cam-details">
          <div>DVR/NVR: <strong>${c.dvr_nvr_name || 'N/A'}</strong></div>
          <div>Channel: <strong>${c.channel_no ? 'Ch ' + c.channel_no : 'N/A'}</strong></div>
          <div>Location: <strong>${c.location || 'N/A'}</strong></div>
          <div>IP: <strong>${c.ip_address}:${c.port || 554}</strong></div>
        </div>

        <div class="cam-url" title="${c.masked_url}">${c.masked_url}</div>

        <div class="cam-footer">
          <div>
            ${c.status === 'ONLINE' ? `Latency: ${c.latency_ms || 0}ms` : `<span style="color: var(--offline);">${c.last_error || 'Down'}</span>`}
          </div>
          <button class="btn btn-sm" onclick="checkCamera(${c.id})">🔍 Check</button>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("cam-search").addEventListener("input", renderCameraGrid);
document.getElementById("filter-status").addEventListener("change", renderCameraGrid);
document.getElementById("filter-nvr").addEventListener("change", renderCameraGrid);

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
