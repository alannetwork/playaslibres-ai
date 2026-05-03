import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Entendido"),
  );
  btn?.click();
});
await page.waitForTimeout(1000);

await page.waitForFunction(
  () => document.querySelectorAll(".maplibregl-marker").length > 0,
  { timeout: 15_000 },
);

// Click the marker
await page.evaluate(() => {
  const marker = document.querySelector(".maplibregl-marker button");
  marker?.click();
});
await page.waitForTimeout(800);

// Inspect dialog content
const panel = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { open: false };
  const text = dlg.textContent || "";
  return {
    open: true,
    hasTitle: text.includes("Playa Las Cocinas"),
    hasSuspendido: text.includes("Suspendido"),
    hasResponsable: text.includes("Cantiles de Mita"),
    hasObjectIDs: text.includes("344") && text.includes("358"),
    hasExpediente: text.includes("suspension temporal") || text.includes("suspension_temporal") || text.includes("Suspensión"),
    hasTimeline: text.includes("Cronología"),
    hasFuentesOficiales: text.includes("Fuentes oficiales"),
    hasPrensa: text.includes("Cobertura periodística"),
    hasCambiosSat: text.includes("Cambios satelitales"),
    hasMarcoLegal: text.includes("Marco legal") && text.includes("art. 27"),
    hasContribuyente: text.includes("@playaslibres-mx"),
    timelineCount: dlg.querySelectorAll("ol li").length,
    snippet: text.slice(0, 400),
  };
});
console.log(JSON.stringify(panel, null, 2));

await page.screenshot({ path: "/tmp/playas_panel_caso.png", fullPage: true });

await browser.close();
