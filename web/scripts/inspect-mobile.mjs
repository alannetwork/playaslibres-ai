// QA del layout responsive y zoom Esri.
import { chromium, devices } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();

async function checkViewport(name, viewport, hasTouch = false) {
  const ctx = await browser.newContext({ viewport, hasTouch });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });

  // Cerrar welcome
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Entendido"),
    );
    btn?.click();
  });
  await page.waitForFunction(() => typeof window.__map !== "undefined");
  await page.waitForFunction(() => window.__map.isStyleLoaded());
  await page.waitForTimeout(1500);

  // Sin scroll horizontal
  const horizontalOverflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    cliW: document.documentElement.clientWidth,
  }));

  // Header chip text
  const headerText = await page.evaluate(() => {
    const c = document.querySelector(
      'div.pointer-events-auto[class*="rounded-md"][class*="bg-slate-950"]',
    );
    return c ? c.textContent?.trim() : null;
  });

  // Bottom panels visible
  const bottomCount = await page.evaluate(() => {
    return document
      .querySelectorAll(
        ".pointer-events-auto button, .pointer-events-auto [data-slot=card]",
      ).length;
  });

  // Expandir capas (desktop) / chip de capas (mobile)
  await page.evaluate(() => {
    const capas = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Capas"),
    );
    capas?.click();
  });
  await page.waitForTimeout(400);

  const expandedFitsViewport = await page.evaluate(() => {
    const card = document.querySelector(
      '[data-slot="card"]',
    );
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      right: Math.round(r.right),
      viewport: window.innerWidth,
      overflows: r.right > window.innerWidth + 1,
    };
  });

  // Test zoom alto: zoom in 4x con map.zoomTo
  await page.evaluate(() => window.__map.zoomTo(20, { duration: 0 }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/mobile_${name}_zoom20.png` });
  const zoomLevel = await page.evaluate(() => window.__map.getZoom());

  console.log(`\n[${name} ${viewport.width}x${viewport.height}]`);
  console.log("  horizontalOverflow:", horizontalOverflow);
  console.log("  headerText:", headerText);
  console.log("  bottomCount:", bottomCount);
  console.log("  expandedFitsViewport:", expandedFitsViewport);
  console.log("  zoom max:", zoomLevel);

  await page.screenshot({ path: `/tmp/mobile_${name}_layout.png` });
  await ctx.close();
}

await checkViewport("iphone", { width: 390, height: 844 }, true);
await checkViewport("small", { width: 320, height: 568 }, true);
await checkViewport("desktop", { width: 1400, height: 900 });

await browser.close();
