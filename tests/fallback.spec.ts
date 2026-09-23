import { test, expect } from "@playwright/test";
import { fallbackDecide } from "../src/lib/ai/fallback";
import { buildDecisionRequest, DEFAULT_SIM_STATE } from "../src/lib/energy/scenarios";

const cases = [
  { name: "balanced", patch: { solarProductionW: 500, consumptionW: 500 }, action: "no_action", status: "BALANCED" },
  { name: "zero production and demand", patch: { solarProductionW: 0, consumptionW: 0 }, action: "no_action", status: "BALANCED" },
  { name: "deficit", patch: { solarProductionW: 50, consumptionW: 300 }, action: "energy_shortage", status: "SHORTAGE" },
  { name: "battery first", patch: { batteryLevelPct: 79 }, action: "battery_storage", status: "SURPLUS" },
  { name: "storage threshold", patch: { batteryLevelPct: 80 }, action: "ev_charging", status: "SURPLUS" },
  { name: "full battery", patch: { batteryLevelPct: 100 }, action: "ev_charging", status: "SURPLUS" },
  { name: "zero battery capacity", patch: { batteryCapacityWh: 0 }, action: "ev_charging", status: "SURPLUS" },
  { name: "unavailable battery", patch: { batteryAvailable: false }, action: "ev_charging", status: "SURPLUS" },
  { name: "EV already charging", patch: { batteryLevelPct: 100, evCharging: true }, action: "additional_load", status: "SURPLUS" },
  { name: "no available sinks", patch: { batteryAvailable: false, evAvailable: false, availableLoads: [] }, action: "reduce_solar_input", status: "SURPLUS" },
  { name: "zero capacity is not a sink", patch: { batteryCapacityWh: 0, evAvailable: false, availableLoads: [] }, action: "reduce_solar_input", status: "SURPLUS" },
];

for (const item of cases) {
  test(`local policy: ${item.name}`, () => {
    const state = buildDecisionRequest({ ...DEFAULT_SIM_STATE, ...item.patch });
    expect(fallbackDecide(state).recommendedAction).toBe(item.action);
    // Derived net is authoritative, even if a caller supplies a stale excess field.
    expect(fallbackDecide({ ...state, excessEnergyW: 99999 }).recommendedAction).toBe(item.action);
  });
}

test("battery zero capacity and unavailable sinks update real UI", async ({ page }) => {
  await page.goto("/simulator");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.getByRole("textbox", { name: "Battery capacity exact value" }).fill("0");
  await expect(page.locator(".recommendation h3")).toHaveText("Charge EV");
  await page.getByRole("checkbox", { name: "EV available", exact: true }).uncheck();
  await expect(page.locator(".recommendation h3")).toHaveText("Power Additional Load");
  await page.getByRole("checkbox", { name: "Water Heater — 1500 W" }).uncheck();
  await page.getByRole("checkbox", { name: "AC — 1800 W" }).uncheck();
  await expect(page.locator(".recommendation h3")).toHaveText("Reduce Solar Input");
  await expect(page.locator('[data-sink="battery_storage"]')).toHaveAttribute("data-active", "false");
  await expect(page.locator('[data-sink="reduce_solar_input"]')).toHaveAttribute("data-active", "true");
});

test("real HTTP contracts and server fallback with controlled provider failure", async ({ request }) => {
  test.skip(process.env.CONTROLLED_PROVIDER_FAILURE !== "1", "Requires the isolated server with dummy credentials and unreachable local provider");
  for (const item of cases) {
    const state = buildDecisionRequest({ ...DEFAULT_SIM_STATE, ...item.patch });
    const response = await request.post("/api/ai/decision", { data: state });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, source: "fallback", decision: { recommendedAction: item.action, confidence: null }, calculated: { status: item.status } });
  }
  const legacy = await request.post("/api/decide", { data: { solarProductionW: 500, consumptionW: 500 } });
  expect(await legacy.json()).toMatchObject({ calc: { status: "balanced", excessW: 0 }, decision: { recommendedAction: "no_action", source: "fallback" } });
  const chat = await request.post("/api/ai/chat", { data: { state: buildDecisionRequest(DEFAULT_SIM_STATE), lang: "en", messages: [{ role: "user", content: "What is my surplus?" }] } });
  expect(chat.status()).toBe(200);
  expect(await chat.json()).toMatchObject({ success: true, source: "fallback", reply: expect.any(String), calculated: { excess: 1200 } });
  const curtailed = await request.post("/api/ai/chat", { data: { state: buildDecisionRequest({ ...DEFAULT_SIM_STATE, batteryCapacityWh: 0, evAvailable: false, availableLoads: [] }), lang: "en", messages: [{ role: "user", content: "What should happen?" }] } });
  expect(await curtailed.json()).toMatchObject({ source: "fallback", reply: expect.stringContaining("reducing solar input") });
  expect(await (await request.get("/api/health")).json()).toMatchObject({ status: "ok", mode: "simulation-only" });
  for (const endpoint of ["/api/ai/decision", "/api/ai/chat"]) {
    const invalid = await request.post(endpoint, { data: {} });
    expect(invalid.status()).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "INVALID_INPUT" });
  }
});
