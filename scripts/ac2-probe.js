// Extended AC probe: decision + chat + evaluation cases (CommonJS).
// Usage: node scripts/ac2-probe.js <baseUrl>
const http = require("http");
const base = (process.argv[2] || "http://localhost:3110").replace(/\/$/, "");

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
        res.on("end", () => {
          let j = null;
          try { j = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode, json: j, raw: raw.slice(0, 200) });
        });
      },
    );
    req.on("error", (e) => resolve({ status: -1, json: null, raw: String(e) }));
    req.write(data);
    req.end();
  });
}

const D = (solar, load, batt, ev, loadsCap) => ({
  solarProductionW: solar, consumptionW: load, excessEnergyW: Math.max(solar - load, 0),
  battery: { available: true, capacityWh: 5000, levelPercent: batt },
  ev: { available: ev, charging: false },
  loads: { available: loadsCap > 0, totalCapacityW: loadsCap },
});

let pass = 0, fail = 0;
const check = (id, cond, extra = "") => {
  if (cond) { pass++; console.log(`AC-${id} PASS ${extra}`); }
  else { fail++; console.log(`AC-${id} FAIL ${extra}`); }
};

(async () => {
  // AC-01/02/03 + AC-12/13 exactness
  const r1 = await post("/api/ai/decision", D(1000, 300, 40, true, 800));
  const c1 = r1.json?.calculated || {};
  check("01", r1.status === 200 && c1.netEnergyW === 700 && c1.excessEnergyW === 700 && c1.energyShortageW === 0, JSON.stringify(c1));
  const r2 = await post("/api/ai/decision", D(300, 700, 60, false, 800));
  const c2 = r2.json?.calculated || {};
  check("02", r2.status === 200 && c2.netEnergyW === -400 && c2.excessEnergyW === 0 && c2.energyShortageW === 400, JSON.stringify(c2));
  const r3 = await post("/api/ai/decision", D(500, 500, 60, true, 800));
  const c3 = r3.json?.calculated || {};
  check("03", r3.status === 200 && c3.netEnergyW === 0 && c3.excessEnergyW === 0 && c3.energyShortageW === 0 && c3.status === "BALANCED", JSON.stringify(c3));
  const r12 = await post("/api/ai/decision", D(50, 300, 40, true, 800));
  const c12 = r12.json?.calculated || {};
  check("12", r12.status === 200 && c12.solarProductionW === 50 && c12.netEnergyW === -250 && c12.energyShortageW === 250, JSON.stringify(c12));
  const r13 = await post("/api/ai/decision", D(1000, 300, 40, true, 800));
  check("13", r13.status === 200 && (r13.json?.calculated?.solarProductionW) === 1000, "");

  // AC-04 AI decision works (real model)
  check("04", r1.status === 200 && r1.json?.success === true && r1.json?.source === "ai" && typeof r1.json?.decision?.reason === "string",
    `source=${r1.json?.source} action=${r1.json?.decision?.recommendedAction}`);

  // AC-05 chat works
  const chatBody = { state: D(1000, 300, 40, true, 800), decision: r1.json?.decision, lang: "ar",
    messages: [{ role: "user", content: "ليش اخترت هذا القرار؟" }] };
  const rc = await post("/api/ai/chat", chatBody);
  check("05", rc.status === 200 && rc.json?.success === true && typeof rc.json?.reply === "string" && rc.json.reply.length > 10,
    `source=${rc.json?.source} len=${rc.json?.reply?.length}`);

  // AC-06 chat receives current state (server echoes recomputed calc for the SENT state)
  const chat50 = { state: D(50, 300, 40, true, 800), lang: "ar", messages: [{ role: "user", content: "هل عندي فائض الآن؟" }] };
  const rc50 = await post("/api/ai/chat", chat50);
  const cc = rc50.json?.calculated || {};
  check("06", rc50.status === 200 && cc.net === -250 && cc.excess === 0 && cc.shortage === 250, JSON.stringify(cc));

  // AC-07/08 context changes with inputs
  const chA = await post("/api/ai/chat", { state: D(1000, 300, 40, true, 800), lang: "ar", messages: [{ role: "user", content: "إيش القرار الآن؟" }] });
  const chB = await post("/api/ai/chat", { state: D(200, 300, 40, true, 800), lang: "ar", messages: [{ role: "user", content: "إيش القرار الآن؟" }] });
  check("07/08", chA.json?.calculated?.net === 700 && chB.json?.calculated?.net === -100, `700 vs -100`);

  // AC-09 invalid chat input rejected (validation), decision tested separately with bad key
  const rbad = await post("/api/ai/chat", { state: D(1000, 300, 40, true, 800), lang: "ar", messages: [] });
  check("09a", rbad.status === 400 && rbad.json?.error === "INVALID_INPUT", `status=${rbad.status}`);

  // AC-15 evaluation matrix
  const matrix = [
    [D(1000, 300, 40, true, 800), "battery_storage"],
    [D(1000, 300, 90, true, 800), "ev_charging"],
    [{ ...D(1000, 300, 95, false, 800) }, "additional_load"],
    [D(300, 700, 60, false, 800), "energy_shortage"],
    [D(500, 500, 60, true, 800), "no_action"],
  ];
  let okAll = true;
  for (const [body, exp] of matrix) {
    const r = await post("/api/ai/decision", body);
    const got = r.json?.decision?.recommendedAction;
    const ok = r.status === 200 && got === exp;
    if (!ok) okAll = false;
    console.log(`  eval exp=${exp} got=${got} src=${r.json?.source} ${ok ? "ok" : "MISMATCH"}`);
  }
  check("15", okAll, "");

  console.log(`\nTOTAL pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
