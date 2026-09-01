// =========================================================
// SUPABASE CONNECTION
// =========================================================

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


// =========================================================
// RENDER DATA WATERFLOW
// =========================================================

function renderWaterflow(row) {

    const flowRate = document.getElementById("flow-rate");
    const totalVolume = document.getElementById("total-volume");
    const clock = document.getElementById("clock");
    const status = document.getElementById("status");
    const notif = document.getElementById("notification");

    const monitorFlow =
        document.getElementById("flow-rate-monitor");

    const monitorStatus =
        document.getElementById("pump-status");

    const waterAnimation =
        document.getElementById("water-animation");


    // Flow Rate
    if (flowRate) {
        flowRate.textContent =
            Number(row.flow_rate).toFixed(1) + " L/min";
    }


    // Total Volume
    if (totalVolume) {
        totalVolume.textContent =
            Number(row.total_volume).toFixed(1) + " L";
    }


    // Last Update
    if (clock && row.created_at) {
        clock.textContent =
            new Date(row.created_at).toLocaleString("id-ID");
    }


    // Monitoring Flow Rate
    if (monitorFlow) {
        monitorFlow.textContent =
            Number(row.flow_rate).toFixed(1) + " L/min";
    }


    // Pump Status
    const isOn = row.status === "ON";

    if (status) {

        status.innerHTML =
            isOn ? "🟢 ON" : "🔴 OFF";

        status.style.color =
            isOn ? "#22c55e" : "#ef4444";
    }


    // Monitoring Pump Status
    if (monitorStatus) {

        monitorStatus.innerHTML =
            isOn ? "🟢 ON" : "🔴 OFF";

        monitorStatus.style.color =
            isOn ? "#22c55e" : "#ef4444";
    }


    // Notification
    if (notif) {

        notif.innerHTML =
            isOn
                ? "🟢 Air Mengalir"
                : "🔴 Air Tidak Mengalir";

        notif.style.color =
            isOn ? "#22c55e" : "#ef4444";
    }


    // Water Animation
    if (waterAnimation) {

        waterAnimation.style.display =
            isOn ? "block" : "none";
    }
}


// =========================================================
// CONNECTION STATUS
// =========================================================

function updateConnectionStatus(label, color) {

    const badge =
        document.getElementById("connection-badge");

    const scenarioStatus =
        document.getElementById("scenario-status");

    if (badge) {

        badge.textContent = label;

        if (badge.parentElement) {
            badge.parentElement.style.background = color;
        }
    }


    if (scenarioStatus) {

        if (label.includes("REALTIME")) {

            scenarioStatus.textContent =
                "Realtime Supabase aktif";

        } else if (label.includes("ONLINE")) {

            scenarioStatus.textContent =
                "Terhubung ke Supabase";

        } else {

            scenarioStatus.textContent =
                "AUTO: simulasi aktif sampai data realtime tersedia";
        }
    }


    // Update status database
    const dbStatus =
        document.getElementById("db-status");

    if (dbStatus) {

        if (
            label.includes("REALTIME") ||
            label.includes("ONLINE")
        ) {

            dbStatus.innerHTML =
                "🟢 Connected";

        } else {

            dbStatus.innerHTML =
                "🟡 Connecting";
        }
    }
}


// =========================================================
// SIMULATION
// =========================================================

function createSimulationRow() {

    const isOn = Math.random() > 0.22;

    const flowRate =
        isOn
            ? 8 + Math.random() * 9
            : 0;

    simulatedVolume += flowRate / 60;

    return {

        flow_rate: flowRate,

        total_volume: simulatedVolume,

        status: isOn ? "ON" : "OFF",

        created_at:
            new Date().toISOString()
    };
}


function renderRows(rows) {

    latestRows = rows;

    if (!rows || rows.length === 0) {
        return;
    }


    // Render data terbaru
    renderWaterflow(rows[0]);


    // =====================================================
    // HISTORY TABLE
    // =====================================================

    const tbody =
        document.querySelector("#historyTable tbody");

    if (tbody) {

        tbody.innerHTML =
            rows.map((item) => `

                <tr>

                    <td>
                        ${new Date(item.created_at)
                            .toLocaleString("id-ID")}
                    </td>

                    <td>
                        ${Number(item.flow_rate).toFixed(1)}
                        L/min
                    </td>

                    <td>
                        ${item.status}
                    </td>

                    <td>
                        ${Number(item.total_volume).toFixed(3)}
                        L
                    </td>

                </tr>

            `).join("");
    }


    // =====================================================
    // CHART
    // =====================================================

    const ctx =
        document.getElementById("flowChart");

    if (
        ctx &&
        typeof Chart !== "undefined"
    ) {

        if (chart) {
            chart.destroy();
        }


        const orderedRows =
            [...rows].reverse();


        chart = new Chart(ctx, {

            type: "line",

            data: {

                labels:
                    orderedRows.map(item =>
                        new Date(item.created_at)
                            .toLocaleTimeString("id-ID")
                    ),

                datasets: [

                    {

                        label: "Flow Rate",

                        data:
                            orderedRows.map(
                                item => item.flow_rate
                            ),

                        borderColor: "#3b82f6",

                        backgroundColor:
                            "rgba(59,130,246,.15)",

                        borderWidth: 3,

                        fill: true,

                        tension: 0.4

                    }

                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}


// =========================================================
// START SIMULATION
// =========================================================

function startSimulation() {

    if (
        simulationTimer ||
        scenarioMode !== "auto" ||
        realtimeConnected
    ) {
        return;
    }


    const tick = () => {

        if (
            scenarioMode !== "auto" ||
            realtimeConnected
        ) {
            return;
        }


        renderRows(
            [
                createSimulationRow(),
                ...latestRows
            ].slice(0, 10)
        );
    };


    tick();

    simulationTimer =
        setInterval(tick, 3000);
}


// =========================================================
// STOP SIMULATION
// =========================================================

function stopSimulation() {

    if (simulationTimer) {

        clearInterval(simulationTimer);
    }

    simulationTimer = null;
}


// =========================================================
// LOAD DATA FROM SUPABASE
// =========================================================

async function loadDashboard() {

    console.log("Mengambil data dari Supabase...");


    try {

        const {
            data,
            error
        } = await supabaseClient

            .from("waterflow")

            .select("*")

            .order(
                "created_at",
                {
                    ascending: false
                }
            )

            .limit(10);


        // =================================================
        // ERROR
        // =================================================

        if (error) {

            console.error(
                "Supabase Error:",
                error
            );

            updateConnectionStatus(
                "🟡 AUTO MODE",
                "#854d0e"
            );

            startSimulation();

            return;
        }


        console.log(
            "Data Supabase:",
            data
        );


        // =================================================
        // DATA KOSONG
        // =================================================

        if (
            !data ||
            data.length === 0
        ) {

            console.warn(
                "Tidak ada data pada tabel waterflow."
            );

            updateConnectionStatus(
                "🟢 ONLINE",
                "#14532d"
            );

            startSimulation();

            return;
        }


        // =================================================
        // DATA BERHASIL
        // =================================================

        simulatedVolume =
            Number(data[0].total_volume) || 0;


        renderRows(data);


        updateConnectionStatus(
            realtimeConnected
                ? "🟢 REALTIME"
                : "🟢 ONLINE",
            "#14532d"
        );


        if (!realtimeConnected) {

            startSimulation();
        }

    }

    catch (error) {

        console.error(
            "Connection Error:",
            error
        );


        updateConnectionStatus(
            "🟡 AUTO MODE",
            "#854d0e"
        );


        startSimulation();
    }
}


// =========================================================
// LOAD PERTAMA
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDashboard();

    }
);


// =========================================================
// REALTIME SUPABASE
// =========================================================

const waterflowChannel =
    supabaseClient

        .channel("waterflow-channel")


        .on(

            "postgres_changes",

            {

                event: "*",

                schema: "public",

                table: "waterflow"

            },

            (payload) => {

                console.log(
                    "Data realtime masuk:",
                    payload
                );


                // Data terbaru
                if (payload.new) {

                    renderWaterflow(
                        payload.new
                    );
                }


                // Refresh data
                loadDashboard();

            }

        )


        .subscribe(

            (status) => {

                console.log(
                    "Supabase Realtime Status:",
                    status
                );


                // =========================================
                // REALTIME BERHASIL
                // =========================================

                if (status === "SUBSCRIBED") {

                    console.log(
                        "✅ Supabase Realtime Connected"
                    );


                    realtimeConnected = true;


                    stopSimulation();


                    updateConnectionStatus(
                        "🟢 REALTIME",
                        "#14532d"
                    );

                }


                // =========================================
                // REALTIME ERROR
                // =========================================

                else if (

                    status === "CHANNEL_ERROR" ||

                    status === "TIMED_OUT"

                ) {

                    console.warn(
                        "Realtime unavailable:",
                        status
                    );


                    realtimeConnected = false;


                    updateConnectionStatus(
                        "🟡 AUTO MODE",
                        "#854d0e"
                    );


                    startSimulation();
                }

            }

        );


// =========================================================
// MODE BUTTON
// =========================================================

const autoMode =
    document.getElementById("auto-mode");

const realtimeMode =
    document.getElementById("realtime-mode");


if (
    autoMode &&
    realtimeMode
) {


    // =====================================================
    // AUTO MODE
    // =====================================================

    autoMode.addEventListener(
        "click",
        () => {

            scenarioMode = "auto";

            realtimeConnected = false;


            autoMode.classList.add(
                "active"
            );

            realtimeMode.classList.remove(
                "active"
            );


            updateConnectionStatus(
                "🟡 AUTO MODE",
                "#854d0e"
            );


            startSimulation();

        }
    );


    // =====================================================
    // REALTIME MODE
    // =====================================================

    realtimeMode.addEventListener(
        "click",
        () => {

            scenarioMode = "realtime";


            stopSimulation();


            realtimeMode.classList.add(
                "active"
            );

            autoMode.classList.remove(
                "active"
            );


            updateConnectionStatus(
                "🟡 CONNECTING",
                "#854d0e"
            );


            loadDashboard();

        }
    );
}
