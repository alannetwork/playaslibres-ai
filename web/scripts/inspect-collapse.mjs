// Test específico de los paneles colapsables.
import { chromium } from "playwright";

const URL = "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addCookies([
  { name: "playas-libres-disclaimer-accepted", value: "1", url: URL },
]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof window.__map !== "undefined");
await page.waitForFunction(() => window.__map.isStyleLoaded());
await page.waitForTimeout(2500);

// Estado inicial: ¿los 3 chips son visibles?
const initial = await page.evaluate(() => {
  const find = (text) =>
    [...document.querySelectorAll("button, a")].find((el) =>
      el.textContent?.includes(text),
    );
  return {
    capasChip: !!find("Capas"),
    mareaChip: !!find(" m"),
    creditosChip: !!find("Créditos"),
    bottomBarHeight: document.querySelector(".pointer-events-auto.flex")?.getBoundingClientRect().height ?? null,
  };
});
console.log("=== Estado colapsado ===", initial);

await page.screenshot({ path: "/tmp/playas_collapsed.png" });

// Click en "Capas" → debe expandirse
await page.locator('button:has-text("Capas")').first().click();
await page.waitForTimeout(300);
const afterCapas = await page.evaluate(() => {
  const sw = document.querySelectorAll('[role="switch"]');
  return { switches: sw.length };
});
console.log("=== Tras click Capas ===", afterCapas);

await page.screenshot({ path: "/tmp/playas_capas_expanded.png" });

// Cerrar Capas (botón X)
await page.locator('button[aria-label="Minimizar"]').first().click();
await page.waitForTimeout(200);

// Click en chip de marea (tiene " m" en el texto)
const mareaChip = page.locator('button:has-text("m"):has(svg)').first();
await mareaChip.click();
await page.waitForTimeout(300);
const afterMarea = await page.evaluate(() => {
  const sliders = document.querySelectorAll('[role="slider"]');
  return { sliders: sliders.length };
});
console.log("=== Tras click Marea ===", afterMarea);

await page.screenshot({ path: "/tmp/playas_marea_expanded.png" });

// Click en Créditos
await page.locator('button[aria-label="Minimizar"]').first().click();
await page.waitForTimeout(200);
await page.locator('button:has-text("Créditos")').first().click();
await page.waitForTimeout(200);
const afterCreds = await page.evaluate(() =>
  document.body.innerText.includes("Capas referenciales"),
);
console.log("=== Tras click Créditos: aparece disclaimer largo? ===", afterCreds);

await page.screenshot({ path: "/tmp/playas_creditos_expanded.png" });

// Volver todo a colapsado
await page.locator('button[aria-label="Minimizar"]').first().click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/playas_collapsed_again.png" });

await browser.close();
console.log("\n✓ Screenshots: /tmp/playas_collapsed.png /tmp/playas_capas_expanded.png /tmp/playas_marea_expanded.png /tmp/playas_creditos_expanded.png");
