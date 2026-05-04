// Verifica que TideSlider expandido y InfoPanel del caso queden bien en mobile.
import { chromium } from "playwright";
const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Entendido"),
  );
  btn?.click();
});
await page.waitForTimeout(1500);

// Expandir TideSlider (chip con altura "-0.86 m")
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.match(/-?\d+\.\d{2}\s*m/),
  );
  btn?.click();
});
await page.waitForTimeout(400);

const tideOverflow = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-slot=card]")];
  return cards.map((c) => {
    const r = c.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      right: Math.round(r.right),
      overflows: r.right > window.innerWidth + 1,
    };
  });
});
console.log("Cards después de abrir tide:", tideOverflow);
await page.screenshot({ path: "/tmp/mobile_tide_open.png" });

// Cerrar el chip (collapse), abrir el panel del caso clickeando el marker
await page.evaluate(() => {
  const closeBtns = document.querySelectorAll('[aria-label="Minimizar"]');
  closeBtns.forEach((b) => b.click());
});
await page.waitForTimeout(300);

await page.evaluate(() => {
  const marker = document.querySelector(".maplibregl-marker button");
  marker?.click();
});
await page.waitForTimeout(800);

const dialogFit = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const r = dlg.getBoundingClientRect();
  return {
    width: Math.round(r.width),
    left: Math.round(r.left),
    right: Math.round(r.right),
    overflows: r.right > window.innerWidth + 1 || r.left < -1,
    viewport: window.innerWidth,
  };
});
console.log("InfoPanel mobile:", dialogFit);
await page.screenshot({ path: "/tmp/mobile_panel_open.png", fullPage: true });

await browser.close();
