// Test específico: marker hover (no se desplaza) y click → InfoPanel con evidencia
import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addCookies([
  { name: "playas-libres-welcome-v2", value: "1", url: URL },
]);
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForFunction(() => typeof window.__map !== "undefined");
await page.waitForFunction(() => window.__map.isStyleLoaded());
await page.waitForFunction(
  () => document.querySelectorAll(".maplibregl-marker").length > 0,
  { timeout: 15_000 },
);
await page.waitForTimeout(1500);

// Posición inicial del marker
const initialPos = await page.evaluate(() => {
  const m = document.querySelector(".maplibregl-marker");
  const rect = m.getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top) };
});
console.log("Pos inicial marker:", initialPos);

// Hover sobre el marker
await page.evaluate(() => {
  const m = document.querySelector(".maplibregl-marker button");
  m.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
});
await page.waitForTimeout(400);

const hoverPos = await page.evaluate(() => {
  const m = document.querySelector(".maplibregl-marker");
  const rect = m.getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top) };
});
console.log("Pos hover marker:", hoverPos);

const dx = Math.abs(hoverPos.left - initialPos.left);
const dy = Math.abs(hoverPos.top - initialPos.top);
console.log(`Δ posición: (${dx}, ${dy}) — debería ser ~0`);

// Click en el marker
await page.evaluate(() => {
  document.querySelector(".maplibregl-marker button").click();
});
await page.waitForTimeout(800);

// Verificar que el InfoPanel apareció con evidencia
const panelText = await page.evaluate(() => document.body.innerText);
const hasEvidence =
  panelText.includes("OBJECTID") &&
  panelText.includes("344") &&
  panelText.includes("F13C58-49") &&
  panelText.includes("MapServer");
console.log("InfoPanel con evidencia visible:", hasEvidence);

// Lista de links en el panel
const panelLinks = await page.evaluate(() => {
  const dialog = document.querySelector("[role='dialog']");
  if (!dialog) return [];
  return [...dialog.querySelectorAll("a")].map((a) => ({
    label: a.textContent?.trim().slice(0, 80),
    href: a.href,
  }));
});
console.log("Links en el InfoPanel:", panelLinks.length);
panelLinks.slice(0, 8).forEach((l) => console.log(`  · ${l.label}`));

await page.screenshot({ path: "/tmp/playas_infopanel.png" });
console.log("\nScreenshot: /tmp/playas_infopanel.png");

await browser.close();
