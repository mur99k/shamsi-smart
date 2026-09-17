import { test, expect, type Page } from "@playwright/test";

async function english(page: Page, path = "/simulator") {
  await page.goto(path);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test("50W is immediate; shared state, decision and language survive navigation", async ({ page }) => {
  await english(page);
  const input = page.getByRole("spinbutton", { name: "Solar production exact value" });
  await input.fill("50");
  await expect(page.getByRole("slider", { name: "Solar production", exact: true })).toHaveValue("50");
  await expect(page.locator(".metrics")).toContainText("-250");
  await expect(page.locator('[data-sink][data-active="true"]')).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "Assistant", exact: true }).click();
  await expect(page.locator(".system-context")).toContainText("50 W");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  let body: Record<string, unknown> = {};
  await page.route("**/api/ai/chat", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, reply: "Received 50W snapshot", source: "fallback" } });
  });
  await page.getByRole("textbox", { name: "Your question" }).fill("Current production?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Received 50W snapshot", { exact: true })).toBeVisible();
  expect(body.state).toMatchObject({ solarProductionW: 50, consumptionW: 300, excessEnergyW: 0 });
  expect(body.decision).toMatchObject({ recommendedAction: "energy_shortage" });
  await page.getByRole("navigation").getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator(".metrics")).toContainText("50");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator(".chat-workspace")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "Assistant", exact: true }).click();
  await expect(page.getByText("Received 50W snapshot", { exact: true })).toBeVisible();
});

test("late analysis cannot replace a new simulation state", async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/ai/decision", async route => {
    requested = true;
    await gate;
    await route.fulfill({ json: { success: true, source: "ai", decision: { recommendedAction: "battery_storage", reason: "OLD RESPONSE MUST NOT APPEAR", confidence: .9 }, calculated: { solarProductionW: 1500, consumptionW: 300, netEnergyW: 1200, excessEnergyW: 1200, energyShortageW: 0, status: "SURPLUS" } } }).catch(() => {});
  });
  await english(page);
  await page.getByRole("button", { name: "Analyze state", exact: true }).first().click();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole("spinbutton", { name: "Solar production exact value" }).fill("50");
  release();
  await expect(page.locator(".recommendation")).toContainText("Energy Shortage");
  await expect(page.getByText("OLD RESPONSE MUST NOT APPEAR")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze state", exact: true }).first()).toBeEnabled();
});

test("validated decision persists during navigation and is invalidated by an edit", async ({ page }) => {
  await page.route("**/api/ai/decision", route => route.fulfill({ json: { success: true, source: "ai", decision: { recommendedAction: "ev_charging", reason: "Validated current snapshot", confidence: .8 }, calculated: { solarProductionW: 1500, consumptionW: 300, netEnergyW: 1200, excessEnergyW: 1200, energyShortageW: 0, status: "SURPLUS" } } }));
  await english(page, "/dashboard");
  await page.getByRole("button", { name: "Analyze state" }).click();
  await expect(page.getByText("Validated current snapshot", { exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Assistant", exact: true }).click();
  await expect(page.locator(".system-context")).toContainText("Charge EV");
  await page.getByRole("navigation").getByRole("link", { name: "Simulator", exact: true }).click();
  await expect(page.getByText("Validated current snapshot", { exact: true })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Solar production exact value" }).fill("50");
  await expect(page.getByText("Validated current snapshot", { exact: true })).toHaveCount(0);
  await expect(page.locator(".recommendation")).toContainText("Local preview");
});

test("scenarios synchronize exact inputs; balanced and shortage never route surplus", async ({ page }) => {
  await english(page);
  await page.getByRole("radio", { name: /^Balanced/ }).check();
  await expect(page.getByRole("spinbutton", { name: "Solar production exact value" })).toHaveValue("500");
  await expect(page.getByRole("spinbutton", { name: "Consumption exact value" })).toHaveValue("500");
  await expect(page.locator('[data-sink][data-active="true"]')).toHaveCount(0);
  await expect(page.locator(".balance-totals")).toHaveText(/Available surplus0 WUncovered shortage0 W/);
  await expect(page.locator(".recommendation h3")).toHaveText("No Action");
  await page.getByRole("radio", { name: /^Shortage/ }).check();
  await expect(page.locator('[data-sink][data-active="true"]')).toHaveCount(0);
  await expect(page.locator(".balance-totals")).toContainText("400 W");
});

test("chat stays bounded, preserves pending reply across routes, and shows loading", async ({ page }) => {
  const payloads: { messages: { content: string; role: string }[] }[] = [];
  let releaseReply: (() => void) | undefined;
  await page.route("**/api/ai/chat", async route => {
    payloads.push(route.request().postDataJSON());
    await new Promise<void>(resolve => { releaseReply = resolve; });
    await route.fulfill({ json: { success: true, source: "ai", reply: `Reply ${payloads.length}: ${"x".repeat(1100)}` } });
  });
  await english(page, "/assistant");
  for (let i = 0; i < 22; i++) {
    await page.getByRole("textbox", { name: "Your question" }).fill(`Question ${i}`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator(".chat-loading")).toBeVisible();
    await expect.poll(() => Boolean(releaseReply)).toBe(true);
    releaseReply!();
    releaseReply = undefined;
    await expect(page.locator(".chat-loading")).toHaveCount(0);
    await expect(page.locator(".message.assistant")).toHaveCount(Math.min(i + 1, 20));
  }
  expect(payloads.at(-1)?.messages.length).toBeLessThanOrEqual(10);
  expect(payloads.every(payload => payload.messages.every(message => message.content.length <= 1000))).toBe(true);
  await page.getByRole("textbox", { name: "Your question" }).fill("A pending question");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => Boolean(releaseReply)).toBe(true);
  await page.getByRole("navigation").getByRole("link", { name: "Simulator", exact: true }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Assistant", exact: true }).click();
  await expect(page.locator(".chat-loading")).toBeVisible();
  releaseReply!();
  await expect(page.locator(".message.assistant").last()).toContainText("Reply 23:");
  await expect(page.locator(".message.assistant")).toHaveCount(20);
  await expect(page.locator(".message")).toHaveCount(40);
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(page.locator(".message")).toHaveCount(0);
});

test("chat and analysis errors have recovery states", async ({ page }) => {
  await page.route("**/api/ai/chat", route => route.fulfill({ status: 500, json: { error: "test" } }));
  await page.route("**/api/ai/decision", route => route.abort());
  await english(page, "/assistant");
  await page.getByRole("textbox", { name: "Your question" }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".error-text")).toContainText("Could not get a reply");
  await page.getByRole("navigation").getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Analyze state" }).click();
  await expect(page.locator(".error-text")).toContainText("Analysis unavailable");
  await expect(page.locator(".recommendation")).toContainText("Local preview");
});

test("evaluation runs the existing five requests and reports results", async ({ page }) => {
  let count = 0;
  const actions = ["battery_storage", "ev_charging", "additional_load", "energy_shortage", "no_action"];
  await page.route("**/api/ai/decision", route => route.fulfill({ json: { success: true, source: "fallback", decision: { recommendedAction: actions[count++] } } }));
  await english(page, "/evaluation");
  await page.getByRole("button", { name: "Run tests" }).click();
  await expect(page.getByText("Run complete", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  expect(count).toBe(5);
});

test("all routes render in AR/EN at desktop and mobile without page overflow", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const lang of ["ar", "en"]) {
      for (const route of ["/", "/dashboard", "/simulator", "/assistant", "/evaluation", "/project", "/hardware"]) {
        await page.goto(route);
        if (lang === "en") await page.getByRole("button", { name: "Switch to English" }).click();
        await expect(page.locator("h1")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        if (route === "/hardware") await expect(page.locator("main")).toContainText("Raspberry Pi");
        if (route === "/") await expect(page.locator(".landing-hero-clean")).toBeVisible();
        if (route === "/" || route === "/dashboard" || route === "/simulator") await page.screenshot({ path: `artifacts/gateway-${width}-${lang}-${route === "/" ? "home" : route.slice(1)}.png`, fullPage: true });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("home is a gateway; overview reads shared state and links to simulator edits", async ({ page }) => {
  await english(page, "/");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator(".recommendation")).toHaveCount(0);
  await page.getByRole("link", { name: "View overview" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.locator('[data-flow="surplus"]')).toHaveAttribute("data-running", "true");
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(page.locator('[data-flow="surplus"]')).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "Resume motion" }).click();
  await page.locator('[data-sink="battery_storage"]').click();
  await expect(page.locator("#sink-explanation")).toContainText("Simulated level 20%");
  await page.locator('[data-sink="battery_storage"]').click();
  await expect(page.locator("#sink-explanation")).toBeHidden();
  await page.getByRole("link", { name: "Edit in simulator" }).click();
  await page.getByRole("radio", { name: /^Balanced/ }).check();
  await expect(page.locator('[data-flow="surplus"]')).toHaveAttribute("data-running", "false");
  await expect(page.locator('[data-sink][data-active="true"]')).toHaveCount(0);
  await page.getByRole("radio", { name: /^High Surplus/ }).check();
  await page.getByRole("spinbutton", { name: "Solar production exact value" }).fill("50");
  await expect(page.locator(".metrics")).toContainText("-250");
  await expect(page.locator('[data-flow="surplus"]')).toHaveAttribute("data-running", "false");
  await page.getByRole("spinbutton", { name: "Solar production exact value" }).fill("0");
  await expect(page.locator('[data-flow="home"]')).toHaveAttribute("data-running", "false");
  await page.getByRole("spinbutton", { name: "Solar production exact value" }).fill("50");
  await page.getByRole("spinbutton", { name: "Consumption exact value" }).fill("125");
  await expect(page.getByRole("spinbutton", { name: "Solar production exact value" })).toHaveValue("50");
  await page.getByRole("navigation").getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator(".metrics")).toContainText("-75");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await page.getByRole("link", { name: "Edit in simulator" }).click();
  await expect(page.getByRole("spinbutton", { name: "Solar production exact value" })).toHaveValue("50");
  await expect(page.getByRole("spinbutton", { name: "Consumption exact value" })).toHaveValue("125");
  await page.getByRole("navigation").getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByText("How are these numbers calculated?", { exact: true }).click();
  await expect(page.getByText(/Net power is generation minus consumption/)).toBeVisible();
});

test("reduced motion retains state without animated power paths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await english(page, "/dashboard");
  await expect(page.locator('[data-flow="surplus"]')).toHaveCSS("animation-name", "none");
  await expect(page.locator('[data-sink="battery_storage"]')).toHaveAttribute("data-active", "true");
  await page.getByRole("link", { name: "Edit in simulator" }).click();
  await page.getByRole("radio", { name: /^Full Battery/ }).check();
  await expect(page.locator('[data-sink="ev_charging"]')).toHaveAttribute("data-active", "true");
});

test("mobile menu has correct state, closes on navigation and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await english(page, "/dashboard");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await expect(page.getByRole("navigation")).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation").getByRole("link", { name: "Simulator", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("real API health and invalid-input contracts remain available", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const invalid = await request.post("/api/ai/decision", { data: { solarProductionW: -1 } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: "INVALID_INPUT" });
});
