import { test, expect } from "@playwright/test";

const routes = ["/", "/dashboard", "/simulator", "/assistant", "/evaluation", "/project", "/hardware"];
test.describe.configure({ mode: "parallel" });
for (const width of [390, 768, 1024, 1440]) {
  for (const lang of ["ar", "en"]) {
    test(`actual navigation clicks ${width} ${lang}`, async ({ page }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 900 });
      for (const from of routes) {
        await page.goto(from);
        if (lang === "en") {
          const menuToggle = page.locator(".menu-button");
          if (await menuToggle.isVisible()) {
            await menuToggle.click();
            await page.getByRole("button", { name: "Switch to English" }).click();
            await page.keyboard.press("Escape");
          } else {
            await page.getByRole("button", { name: "Switch to English" }).click();
          }
        }
        for (const to of routes) {
          if (width <= 850 && to !== "/") await page.locator(".menu-button").click();
          await page.locator(to === "/" ? ".brand" : `#primary-nav a[href="${to}"]`).click();
          await expect(page).toHaveURL(to);
          await expect(page.locator("h1")).toBeVisible();
          if (width <= 850) await expect(page.locator(".menu-button")).toHaveAttribute("aria-expanded", "false");
          if (to !== from) {
            if (width <= 850 && from !== "/") await page.locator(".menu-button").click();
            await page.locator(from === "/" ? ".brand" : `#primary-nav a[href="${from}"]`).click();
            await expect(page).toHaveURL(from);
          }
        }
        const destinations = await page.locator('main a[href^="/"], footer a[href^="/"]').evaluateAll(links => links.map(link => link.getAttribute("href")!));
        for (let i = 0; i < destinations.length; i++) {
          await page.locator('main a[href^="/"], footer a[href^="/"]').nth(i).click();
          await expect(page).toHaveURL(destinations[i]);
          if (destinations[i] === from) continue;
          await page.goBack();
          await expect(page).toHaveURL(from);
        }
      }
    });
  }
}
