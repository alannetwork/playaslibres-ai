// Test del modal de bienvenida + franja playa libre + sub-capas.
import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
const page = await ctx.newPage();

// 1. Cargar SIN cookie de welcome → debe aparecer tutorial (4 slides)
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForSelector('button:has-text("Continuar")', { timeout: 30_000 });

const slide1Visible = await page.evaluate(() =>
  document.body.innerText.includes("¿Hasta dónde llega tu playa?"),
);
console.log("Slide 1 visible (bienvenida):", slide1Visible);
await page.screenshot({ path: "/tmp/playas_welcome_1.png" });

// Avanzar slides 1 → 4 con el botón Continuar
for (let i = 1; i <= 3; i++) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.trim().startsWith("Continuar"),
    );
    btn?.click();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `/tmp/playas_welcome_${i + 1}.png` });
}

const slide4Visible = await page.evaluate(() =>
  document.body.innerText.includes("Descargo de responsabilidad"),
);
console.log("Slide 4 visible (legal):", slide4Visible);

// Aceptar tutorial
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Entendido"),
  );
  btn?.click();
});
await page.waitForTimeout(800);

// 2. Verificar que existe la capa playa-libre-fill y la franja se ve
await page.waitForFunction(() => typeof window.__map !== "undefined");
await page.waitForFunction(() => window.__map.isStyleLoaded());
await page.waitForTimeout(2500);

const playaLibreState = await page.evaluate(() => {
  const m = window.__map;
  if (!m.getLayer("playa-libre-fill")) return { exists: false };
  const feats = m.queryRenderedFeatures({ layers: ["playa-libre-fill"] });
  return {
    exists: true,
    visibility: m.getLayoutProperty("playa-libre-fill", "visibility") ?? "visible",
    rendered: feats.length,
  };
});
console.log("Capa Playa Libre:", playaLibreState);

// 3. Esperar a que disputas se cargue + marker aparezca
await page.waitForFunction(
  () => document.querySelectorAll(".maplibregl-marker").length > 0,
  { timeout: 15_000 },
).catch(() => console.log("⚠ No apareció ningún marker tras 15s"));

const lcInfo = await page.evaluate(() => {
  const markers = document.querySelectorAll(".maplibregl-marker");
  const out = [];
  markers.forEach((m) => {
    const rect = m.getBoundingClientRect();
    const btn = m.querySelector("button");
    out.push({
      title: btn?.title ?? null,
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      visible: rect.width > 0 && rect.height > 0,
      transform: m.style.transform,
    });
  });
  return out;
});
console.log("Markers MapLibre detectados:", lcInfo);

await page.screenshot({ path: "/tmp/playas_main.png" });

// 4. Abrir Capas, verificar sub-capas ZOFEMAT
await page.locator('button:has-text("Capas")').first().click();
await page.waitForTimeout(400);

const subSwitches = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")].map(
    (l) => l.textContent ?? "",
  );
  return labels.filter((t) =>
    t.match(/Playa libre|Pleamar máxima|Zona federal|Manglar|Muelle|Terrenos/),
  );
});
console.log("Sub-capas ZOFEMAT visibles en panel:", subSwitches);

await page.screenshot({ path: "/tmp/playas_capas_subcapas.png" });

// 5. Activar terrenos ganados al mar
const tg = page
  .locator('label:has-text("Terrenos ganados") [role="switch"]')
  .first();
if ((await tg.count()) > 0) {
  await tg.click();
  await page.waitForTimeout(500);
  const tgVis = await page.evaluate(() =>
    window.__map.getLayoutProperty("zofemat-terrenos-ganados", "visibility"),
  );
  console.log("Terrenos ganados al mar visibility tras toggle:", tgVis);
}

// 6. Zoom a Las Cocinas con coords corregidas
await page.evaluate(() => {
  window.__map.flyTo({
    center: [-105.5085, 20.7714],
    zoom: 17,
    duration: 0,
  });
});
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/playas_lc_real.png" });
console.log("\nScreenshots: /tmp/playas_welcome.png /tmp/playas_main.png /tmp/playas_capas_subcapas.png /tmp/playas_lc_real.png");

await browser.close();
