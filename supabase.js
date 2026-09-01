const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let chart = null;
let scenarioMode = "auto";
let realtimeConnected = false;
let latestRows = [];
let simulationTimer = null;
let simulatedVolume = 0;

function renderWaterflow(row) {
    const flowRate = document.getElementById("flow-rate");
    const totalVolume = document.getElementById("total-volume");
    const clock = document.getElementById("clock");
    const status = document.getElementById("status");
    const notif = document.getElementById("notification");
    const monitorFlow = document.getElementById("flow-rate-monitor");
    const monitorStatus = document.getElementById("pump-status");
    const waterAnimation = document.getElementById("water-animation");

    if (flowRate) flowRate.textContent = Number(row.flow_rate).toFixed(1) + " L/min";
    if (totalVolume) totalVolume.textContent = Number(row.total_volume).toFixed(1) + " L";
    if (clock) clock.textContent = new Date(row.created_at).toLocaleString("id-ID");
    if (monitorFlow) monitorFlow.textContent = Number(row.flow_rate).toFixed(1) + " L/min";

    const isOn = row.status === "ON";
    if (status) {
        status.innerHTML = isOn ? "🟢 ON" : "🔴 OFF";
        status.style.color = isOn ? "#22c55e" : "#ef4444";
    }
    if (monitorStatus) {
        monitorStatus.innerHTML = isOn ? "🟢 ON" : "🔴 OFF";
        monitorStatus.style.color = isOn ? "#22c55e" : "#ef4444";
    }
    if (notif) {
        notif.innerHTML = isOn ? "🟢 Air Mengalir" : "🔴 Air Tidak Mengalir";
        notif.style.color = isOn ? "#22c55e" : "#ef4444";
    }
    if (waterAnimation) waterAnimation.style.display = isOn ? "block" : "none";
}

function updateConnectionStatus(label, color) {
    const badge = document.getElementById("connection-badge");
    const scenarioStatus = document.getElementById("scenario-status");
    if (badge) {
        badge.textContent = label;
        badge.parentElement.style.background = color;
    }
    if (scenarioStatus) scenarioStatus.textContent = scenarioMode === "auto"
        ? "AUTO: simulasi aktif sampai data realtime tersedia"
        : "REALTIME: menunggu event dari Supabase";
}

function createSimulationRow() {
    const isOn = Math.random() > 0.22;
    const flowRate = isOn ? 8 + Math.random() * 9 : 0;
    simulatedVolume += flowRate / 60;
    return {
        flow_rate: flowRate,
        total_volume: simulatedVolume,
        status: isOn ? "ON" : "OFF",
        created_at: new Date().toISOString()
    };
}

function renderRows(rows) {
    latestRows = rows;
    if (!rows.length) return;
    renderWaterflow(rows[0]);

    const tbody = document.querySelector("#historyTable tbody");
    if (tbody) tbody.innerHTML = rows.map(item => `
        <tr><td>${new Date(item.created_at).toLocaleTimeString("id-ID")}</td>
        <td>${Number(item.flow_rate).toFixed(1)} L/min</td><td>${item.status}</td></tr>
    `).join("");

    const ctx = document.getElementById("flowChart");
    if (ctx && typeof Chart !== "undefined") {
        if (chart) chart.destroy();
        const orderedRows = [...rows].reverse();
        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: orderedRows.map(item => new Date(item.created_at).toLocaleTimeString("id-ID")),
                datasets: [{ label: "Flow Rate", data: orderedRows.map(item => item.flow_rate), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,.15)", borderWidth: 3, fill: true, tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function startSimulation() {
    if (simulationTimer || scenarioMode !== "auto" || realtimeConnected) return;
    const tick = () => {
        if (scenarioMode !== "auto" || realtimeConnected) return;
        renderRows([createSimulationRow(), ...latestRows].slice(0, 10));
    };
    tick();
    simulationTimer = setInterval(tick, 3000);
}

function stopSimulation() {
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = null;
}

async function loadDashboard() {

    const { data, error } = await supabaseClient
        .from("waterflow")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        updateConnectionStatus("🟡 AUTO MODE", "#854d0e");
        startSimulation();
        return;
    }

    if (!data || data.length === 0) {
        updateConnectionStatus("🟡 AUTO MODE", "#854d0e");
        startSimulation();
        return;
    }

    simulatedVolume = Number(data[0].total_volume) || 0;
    renderRows(data);
    updateConnectionStatus(realtimeConnected ? "🟢 REALTIME" : "🟢 ONLINE", "#14532d");
    if (!realtimeConnected) startSimulation();

}

// =========================
// LOAD PERTAMA
// =========================

loadDashboard();

// =========================
// REALTIME SUPABASE
// =========================

supabaseClient
.channel("waterflow-channel")
.on(
    "postgres_changes",
    {
        event: "*",
        schema: "public",
        table: "waterflow"
    },
    (status) => {

        if (status === "SUBSCRIBED") {
            console.log("Realtime Connected");
            realtimeConnected = true;
            stopSimulation();
            updateConnectionStatus("🟢 REALTIME", "#14532d");
            loadDashboard();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("Realtime unavailable:", status);
            realtimeConnected = false;
            updateConnectionStatus("🟡 AUTO MODE", "#854d0e");
            startSimulation();
        }

    }
)
.subscribe();

const autoMode = document.getElementById("auto-mode");
const realtimeMode = document.getElementById("realtime-mode");
if (autoMode && realtimeMode) {
    autoMode.addEventListener("click", () => {
        scenarioMode = "auto";
        realtimeConnected = false;
        autoMode.classList.add("active");
        realtimeMode.classList.remove("active");
        updateConnectionStatus("🟡 AUTO MODE", "#854d0e");
        startSimulation();
    });
    realtimeMode.addEventListener("click", () => {
        scenarioMode = "realtime";
        stopSimulation();
        realtimeMode.classList.add("active");
        autoMode.classList.remove("active");
        updateConnectionStatus("🟡 CONNECTING", "#854d0e");
    });
}