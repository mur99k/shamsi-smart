// AC test/probe script (CommonJS, PowerShell 5.1-safe via node).
// Usage: node scripts/ac-probe.js [baseUrl]
const http = require("http");

const base = (process.argv[2] || "http://localhost:3103").replace(/\/$/, "");

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const u = new URL(base + path);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      },
    );
    req.on("error", (e) => resolve({ status: -1, body: String(e) }));
    req.write(data);
    req.end();
  });
}

const valid = {
  solarProductionW: 1000, consumptionW: 300, excessEnergyW: 700,
  battery: { available: true, capacityWh: 5000, levelPercent: 40 },
  ev: { available: true, charging: false },
  loads: { available: true, totalCapacityW: 1000 },
  environment: { currentTime: "2026-09-16T20:00:00+03:00", estimatedSolarProductionNextHourW: 800 },
};

(async () => {
  const r1 = await post("/api/ai/decision", valid);
  console.log("AC04 valid-status=" + r1.status);
  console.log("AC04 body=" + r1.body.slice(0, 900));

  const badLevel = JSON.parse(JSON.stringify(valid));
  badLevel.battery.levelPercent = 150;
  const r2 = await post("/api/ai/decision", badLevel);
  console.log("AC05 invalid-level-status=" + r2.status);
  console.log("AC05 body=" + r2.body.slice(0, 300));

  const badExcess = JSON.parse(JSON.stringify(valid));
  badExcess.excessEnergyW = 999;
  const r3 = await post("/api/ai/decision", badExcess);
  console.log("EXCESS-MISMATCH status=" + r3.status);
  console.log("EXCESS-MISMATCH body=" + r3.body.slice(0, 300));

  // §29 scenario matrix (expected *state*, not necessarily the action)
  const matrix = [
    { name: "High Surplus", solar: 1500, load: 300 },
    { name: "Low Surplus", solar: 500, load: 450 },
    { name: "Balanced", solar: 500, load: 500 },
    { name: "Shortage", solar: 300, load: 700 },
    { name: "Full Battery", solar: 1200, load: 300 },
  ];
  for (const m of matrix) {
    const b = JSON.parse(JSON.stringify(valid));
    b.solarProductionW = m.solar; b.consumptionW = m.load;
    b.excessEnergyW = Math.max(m.solar - m.load, 0);
    const r = await post("/api/ai/decision", b);
    let calc = {};
    try { calc = JSON.parse(r.body).calculated || {}; } catch {}
    console.log(`${m.name}: status=${r.status} net=${calc.netEnergyW} excess=${calc.excessEnergyW} shortage=${calc.energyShortageW} state=${calc.status}`);
  }

  // Optional-body variant (no environment)
  const noEnv = JSON.parse(JSON.stringify(valid));
  delete noEnv.environment;
  const r4 = await post("/api/ai/decision", noEnv);
  console.log("NO-ENV status=" + r4.status);
})().catch((e) => { console.error(e); process.exit(1); });
