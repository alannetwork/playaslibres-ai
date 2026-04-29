// Inspección end-to-end del mapa con Playwright headless.
// Uso: node scripts/inspect-map.mjs
// Espera dev server en http://localhost:3000.

import { chromium } from "playwright";
import fs from "fs";

const URL = process.env.URL ?? "http://localhost:3000/";
const TIMEOUT_MS = 60_000;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  // Pre-aceptar el disclaimer
  storageState: undefined,
});
await ctx.addCookies([
  {
    name: "playas-libres-disclaimer-accepted",
    value: "1",
    url: URL,
  },
]);

const page = await ctx.newPage();

const consoleMessages = [];
const networkErrors = [];
const pageErrors = [];

page.on("console", (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  pageErrors.push(err.message);
});
page.on("requestfailed", (req) => {
  networkErrors.push(`${req.failure()?.errorText} ${req.url()}`);
});

console.log(`→ Navegando a ${URL}`);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

console.log("→ Esperando window.__map...");
await page.waitForFunction(() => typeof window.__map !== "undefined", {
  timeout: TIMEOUT_MS,
});

console.log("→ Esperando style + idle...");
await page.waitForFunction(() => window.__map.isStyleLoaded(), {
  timeout: TIMEOUT_MS,
});
await page.waitForTimeout(5000); // dar tiempo a que carguen tiles

const inspect = async (label) => {
  const state = await page.evaluate(() => {
    const m = window.__map;
    const ids = [
      "sentinel-raster",
      "zofemat-pleamar-oficial",
      "zofemat-zona-federal",
      "zofemat-playa",
      "zofemat-terrenos-ganados",
      "zofemat-mangle",
      "zofemat-muelle",
      "pleamar-max",
      "pleamar-dynamic",
    ];
    const out = {};
    for (const id of ids) {
      const layer = m.getLayer(id);
      if (!layer) {
        out[id] = { exists: false };
        continue;
      }
      const vis = m.getLayoutProperty(id, "visibility") ?? "visible";
      const featCount =
        layer.type === "raster"
          ? null
          : m.queryRenderedFeatures({ layers: [id] }).length;
      out[id] = { exists: true, type: layer.type, visibility: vis, featCount };
    }
    return out;
  });
  console.log(`\n=== ${label} ===`);
  for (const [k, v] of Object.entries(state)) {
    if (!v.exists) {
      console.log(`  ${k.padEnd(20)} MISSING`);
    } else if (v.type === "raster") {
      console.log(
        `  ${k.padEnd(20)} type=raster  vis=${v.visibility}`,
      );
    } else {
      console.log(
        `  ${k.padEnd(20)} type=${v.type}  vis=${v.visibility}  features=${v.featCount}`,
      );
    }
  }
  return state;
};

await inspect("Estado inicial");

// Screenshot full
const shotInitial = "/tmp/playas_map_initial.png";
await page.screenshot({ path: shotInitial, fullPage: false });
console.log(`Screenshot inicial: ${shotInitial}`);

// Buscar los toggles y clickearlos
console.log("\n→ Buscando toggles...");
const toggleSelectors = [
  'label:has-text("Sentinel-2") button[role="switch"]',
  'label:has-text("Sentinel-2") [role="switch"]',
  'label:has-text("Sentinel-2") button',
  'label:has-text("Sentinel-2") input[type="checkbox"]',
];
let sentinelToggle = null;
for (const sel of toggleSelectors) {
  const el = page.locator(sel).first();
  if ((await el.count()) > 0) {
    sentinelToggle = el;
    console.log(`  encontrado con selector: ${sel}`);
    break;
  }
}
if (!sentinelToggle) {
  console.log("  ⚠ no se encontró el toggle de Sentinel");
  // Listar lo que hay en el DOM dentro de "CAPAS"
  const capasHtml = await page.evaluate(() => {
    const cap = [...document.querySelectorAll("*")].find((e) =>
      e.textContent.includes("CAPAS"),
    );
    return cap?.outerHTML?.slice(0, 2000);
  });
  console.log("  HTML de CAPAS (truncado):", capasHtml);
}

if (sentinelToggle) {
  console.log("→ Clic en toggle Sentinel-2 (off)");
  await sentinelToggle.click();
  await page.waitForTimeout(500);
  await inspect("Tras clic Sentinel OFF");

  console.log("→ Clic en toggle Sentinel-2 (on)");
  await sentinelToggle.click();
  await page.waitForTimeout(500);
  await inspect("Tras clic Sentinel ON");
}

// Toggle Pleamar
const pleamarToggle = page
  .locator('label:has-text("Pleamar estimada") [role="switch"]')
  .first();
if ((await pleamarToggle.count()) > 0) {
  console.log("\n→ Clic en toggle Pleamar (off)");
  await pleamarToggle.click();
  await page.waitForTimeout(400);
  await inspect("Tras clic Pleamar OFF");

  console.log("→ Clic en toggle Pleamar (on)");
  await pleamarToggle.click();
  await page.waitForTimeout(400);
  await inspect("Tras clic Pleamar ON");
}

// Hacer zoom a Las Cocinas para validar visualmente las líneas
await page.evaluate(() => {
  window.__map.flyTo({
    center: [-105.539, 20.772],
    zoom: 16,
    duration: 0,
  });
});
await page.waitForTimeout(2500);

const stateZoomed = await page.evaluate(() => {
  const m = window.__map;
  const ids = [
    "zofemat-pleamar-oficial",
    "zofemat-zona-federal",
    "zofemat-playa",
    "zofemat-terrenos-ganados",
    "pleamar-max",
    "pleamar-dynamic",
  ];
  return Object.fromEntries(
    ids.map((id) => [
      id,
      m.getLayer(id)
        ? m.queryRenderedFeatures({ layers: [id] }).length
        : "MISSING",
    ]),
  );
});
console.log("\n=== Features en Las Cocinas (z=16) ===");
for (const [k, v] of Object.entries(stateZoomed)) {
  console.log(`  ${k.padEnd(28)} ${v}`);
}

const shotZoom = "/tmp/playas_map_lascocinas.png";
await page.screenshot({ path: shotZoom, fullPage: false });
console.log(`\nScreenshot Las Cocinas (z=16): ${shotZoom}`);

// Screenshot final con sólo el mapa visible
const shotFinal = "/tmp/playas_map_final.png";
await page.screenshot({ path: shotFinal, fullPage: false });
console.log(`Screenshot final: ${shotFinal}`);

console.log("\n=== Errores y warnings ===");
const interesting = consoleMessages.filter(
  (m) =>
    m.type === "error" ||
    (m.type === "warning" && !m.text.includes("DialogClose")),
);
if (interesting.length === 0) console.log("  (sin errores ni warnings relevantes)");
for (const m of interesting.slice(0, 30)) {
  console.log(`  [${m.type}] ${m.text.slice(0, 200)}`);
}
if (pageErrors.length) {
  console.log("\n=== pageerror ===");
  pageErrors.forEach((e) => console.log(`  ${e}`));
}
if (networkErrors.length) {
  console.log("\n=== requests fallidos ===");
  networkErrors.slice(0, 20).forEach((e) => console.log(`  ${e}`));
}

await browser.close();
