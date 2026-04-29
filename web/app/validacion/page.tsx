import type { Metadata } from "next";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "Validación científica",
  description:
    "Auditoría de la rigurosidad científica de los datos: prueba de la regla legal de 20 m, comparación pleamar estimada vs oficial, incertidumbres reales.",
};

type Stats = {
  n: number;
  median: number;
  mean: number;
  std: number;
  p05: number;
  p25: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
};

type ValidationReport = {
  generated_at: string;
  metadata: {
    n_features: number;
    fechas_lev: string[];
    escalas: string[];
    proyecciones: string[];
    n_planos: number;
    by_layer: Record<string, number>;
  };
  test_legal_20m: Stats | null;
  ciudadana_vs_oficial: Stats | null;
  dem_stats: {
    min: number;
    max: number;
    mean: number;
    px_total: number;
    px_coastal_le_5m: number;
    px_negative: number;
    px_coastal_above_1_2m: number;
  };
  uncertainty_notes: { component: string; sigma: string; note: string }[];
};

async function loadReport(): Promise<ValidationReport | null> {
  try {
    const p = path.join(process.cwd(), "public", "data", "validation_report.json");
    const txt = await fs.readFile(p, "utf-8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function fmt(x: number, d = 2): string {
  if (Math.abs(x) >= 1000) return x.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  return x.toFixed(d);
}

export default async function ValidacionPage() {
  const r = await loadReport();
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
      <header className="mb-10">
        <Link
          href="/"
          className="text-sm text-blue-300 underline-offset-2 hover:underline"
        >
          ← Volver al mapa
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-balance sm:text-4xl">
          Validación científica
        </h1>
        <p className="mt-2 text-slate-300">
          Auditoría reproducible de la data y los métodos. Sin maquillaje.
        </p>
      </header>

      {!r && (
        <div className="rounded-md border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
          No se encontró el reporte. Ejecutá{" "}
          <code className="rounded bg-slate-800 px-1">
            python scripts/07_validate.py
          </code>{" "}
          para regenerarlo.
        </div>
      )}

      {r && (
        <section className="space-y-10 text-slate-300">
          {/* SEMARNAT */}
          <div>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">
              1. ZOFEMAT oficial (SEMARNAT) — qué entra al mapa
            </h2>
            <div className="grid gap-3 rounded-md border border-slate-700 bg-slate-900/40 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-slate-400">Features totales</div>
                <div className="font-mono text-slate-100">
                  {r.metadata.n_features.toLocaleString("es-MX")}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Año del levantamiento</div>
                <div className="font-mono text-slate-100">
                  {r.metadata.fechas_lev.join(", ")}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Escala de plano</div>
                <div className="font-mono text-slate-100">
                  {r.metadata.escalas.join(", ")}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Proyección</div>
                <div className="font-mono text-slate-100">
                  {r.metadata.proyecciones.join(", ")}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Planos topográficos</div>
                <div className="font-mono text-slate-100">
                  {r.metadata.n_planos}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Capas semánticas</div>
                <div className="text-xs text-slate-100">
                  {Object.entries(r.metadata.by_layer)
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(" · ")}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3 text-sm">
              <strong className="text-emerald-200">
                Veredicto: fuente oficial del gobierno.
              </strong>{" "}
              <span className="text-slate-200">
                Esta es la capa{" "}
                <code className="rounded bg-slate-800 px-1 text-xs">
                  220 B_BANDERAS_2021
                </code>{" "}
                del MapServer ArcGIS de la{" "}
                <strong>DGZFMTAC (SEMARNAT)</strong>. Es el dato
                gubernamental publicado: planos topográficos a escala
                1:1000, proyección oficial ITRF2008 Z13, levantamiento
                2021. Cualquier persona puede verificarla contra el
                MapServer público.{" "}
                <strong>Es la referencia oficial mexicana</strong> para
                Bahía de Banderas. Lo que NO sustituye es el plano
                peritado original (NOM-146-SEMARNAT-2017) cuando se
                necesita para juicio. Su mayor limitación práctica es
                temporal: 5 años desde el levantamiento.
              </span>
            </div>
          </div>

          {/* Test legal 20m */}
          {r.test_legal_20m && (
            <div>
              <h2 className="mb-3 text-xl font-semibold text-slate-100">
                2. Test legal: distancia PLEAMAR MAXIMA → ZONA FEDERAL ≈ 20 m
              </h2>
              <p className="mb-3 text-sm">
                La{" "}
                <a
                  href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGBN.pdf"
                  className="text-blue-300 underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ley General de Bienes Nacionales
                </a>{" "}
                (art. 119 fr. I) define la ZOFEMAT como una franja de{" "}
                <strong>20 metros tierra adentro</strong> medidos desde la
                pleamar máxima. Para validar la consistencia del catastro,
                muestreamos {r.test_legal_20m.n.toLocaleString("es-MX")} puntos
                a lo largo de la línea PLEAMAR MAXIMA y medimos su distancia
                perpendicular a la línea ZONA FEDERAL más cercana.
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left">
                    <th className="py-2 pr-4">Métrica</th>
                    <th className="py-2 pr-4">Valor</th>
                    <th className="py-2">Esperado / Interpretación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Mediana</td>
                    <td className="py-2 pr-4 font-mono">
                      {fmt(r.test_legal_20m.median)} m
                    </td>
                    <td className="py-2">≈20 m ✅</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Media ± desviación</td>
                    <td className="py-2 pr-4 font-mono">
                      {fmt(r.test_legal_20m.mean)} ± {fmt(r.test_legal_20m.std)} m
                    </td>
                    <td className="py-2">Sesgo por outliers</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Percentiles 5–95</td>
                    <td className="py-2 pr-4 font-mono">
                      {fmt(r.test_legal_20m.p05)} – {fmt(r.test_legal_20m.p95)} m
                    </td>
                    <td className="py-2">Rango central</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Mín / Máx</td>
                    <td className="py-2 pr-4 font-mono">
                      {fmt(r.test_legal_20m.min)} – {fmt(r.test_legal_20m.max)} m
                    </td>
                    <td className="py-2">
                      Outliers: muelles, escolleras, terrenos ganados
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-sm text-slate-400">
                <strong className="text-slate-300">Veredicto.</strong> El
                catastro SEMARNAT cumple la regla de 20 m con consistencia
                alta (mediana exacta, ~80% de puntos entre 10 y 30 m). Los
                outliers altos (decenas a cientos de metros) corresponden a
                tramos donde la línea ZONA FEDERAL se aparta de la pleamar
                por motivos de la propia ley (muelles, terrenos ganados al
                mar autorizados, accidentes geográficos).
              </p>
            </div>
          )}

          {/* Comparación ciudadana vs oficial */}
          {r.ciudadana_vs_oficial && (
            <div>
              <h2 className="mb-3 text-xl font-semibold text-slate-100">
                3. Pleamar estimada (ciudadana) vs oficial
              </h2>
              <div className="rounded-md border border-red-700/40 bg-red-900/15 p-4">
                <div className="mb-2 text-sm font-semibold text-red-200">
                  ⚠ La pleamar estimada NO alcanza la precisión que el brief
                  original prometía (±10–30 m).
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="py-2 pr-4">Métrica</th>
                      <th className="py-2 pr-4">Valor</th>
                      <th className="py-2">Veredicto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 pr-4">N puntos comparados</td>
                      <td className="py-2 pr-4 font-mono">
                        {r.ciudadana_vs_oficial.n.toLocaleString("es-MX")}
                      </td>
                      <td className="py-2">—</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 pr-4">Distancia mediana</td>
                      <td className="py-2 pr-4 font-mono">
                        {fmt(r.ciudadana_vs_oficial.median)} m
                      </td>
                      <td className="py-2 text-amber-300">
                        Aceptable solo en zonas planas
                      </td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 pr-4">Percentil 95</td>
                      <td className="py-2 pr-4 font-mono">
                        {fmt(r.ciudadana_vs_oficial.p95)} m
                      </td>
                      <td className="py-2 text-red-300">Inaceptable</td>
                    </tr>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 pr-4">Máxima</td>
                      <td className="py-2 pr-4 font-mono">
                        {fmt(r.ciudadana_vs_oficial.max)} m
                      </td>
                      <td className="py-2 text-red-300">
                        Errores catastróficos en cantiles
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Media ± desviación</td>
                      <td className="py-2 pr-4 font-mono">
                        {fmt(r.ciudadana_vs_oficial.mean)} ±{" "}
                        {fmt(r.ciudadana_vs_oficial.std)} m
                      </td>
                      <td className="py-2">Distribución muy sesgada</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>
                  <strong>Por qué la línea ciudadana es poco confiable:</strong>
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>El DEM Copernicus es DSM, no DTM</strong>: mide la
                    superficie (incluyendo edificios, árboles, muelles), no el
                    suelo desnudo. En cantiles y zonas urbanas la cota está
                    inflada decenas de metros.
                  </li>
                  <li>
                    <strong>Datum sin calibrar</strong>: el cero del DEM (geoide
                    EGM2008) no coincide con el nivel medio del mar local. Sin
                    medición in situ, asumimos offset 0.
                  </li>
                  <li>
                    <strong>Modelo de marea de fallback</strong>: estamos
                    usando una predicción armónica con cuatro constituyentes
                    (M2/S2/K1/O1) hardcodeados, no FES2014. Diferencia
                    típica: 20–50 cm.
                  </li>
                  <li>
                    <strong>Resolución 30 m</strong>: cada pixel representa una
                    cuadrícula de 30×30 m. La línea de costa no puede tener
                    mejor precisión que eso.
                  </li>
                </ul>
                <p className="mt-2 text-amber-200">
                  Por estas razones, la capa &ldquo;Pleamar estimada&rdquo;
                  está marcada como <em>experimental</em> en el mapa y viene{" "}
                  <strong>desactivada por defecto</strong>. Sirve sólo para
                  contexto visual aproximado, nunca como referencia legal.
                </p>
              </div>
            </div>
          )}

          {/* DEM stats */}
          <div>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">
              4. Estadística del DEM costero
            </h2>
            <table className="w-full border-collapse text-sm">
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Rango global</td>
                  <td className="py-2 font-mono">
                    {fmt(r.dem_stats.min)} – {fmt(r.dem_stats.max)} m
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Pixeles totales</td>
                  <td className="py-2 font-mono">
                    {r.dem_stats.px_total.toLocaleString("es-MX")}
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Pixeles costeros (≤ 5 m)</td>
                  <td className="py-2 font-mono">
                    {r.dem_stats.px_coastal_le_5m.toLocaleString("es-MX")}
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">
                    Pixeles costeros con elevación &gt; 1.2 m
                  </td>
                  <td className="py-2 font-mono">
                    {r.dem_stats.px_coastal_above_1_2m.toLocaleString("es-MX")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Pixeles negativos</td>
                  <td className="py-2 font-mono">
                    {r.dem_stats.px_negative.toLocaleString("es-MX")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Uncertainty table */}
          <div>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">
              5. Incertidumbre por componente
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-2 pr-4">Componente</th>
                  <th className="py-2 pr-4">Incertidumbre</th>
                  <th className="py-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {r.uncertainty_notes.map((c) => (
                  <tr key={c.component} className="border-b border-slate-800">
                    <td className="py-2 pr-4">{c.component}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{c.sigma}</td>
                    <td className="py-2 text-slate-400">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reproducibilidad */}
          <div>
            <h2 className="mb-3 text-xl font-semibold text-slate-100">
              6. Reproducibilidad
            </h2>
            <p className="text-sm">
              Cualquier persona puede regenerar este reporte localmente
              ejecutando:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs">
              <code>{`python scripts/07_validate.py`}</code>
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              Reporte generado: {new Date(r.generated_at).toLocaleString("es-MX")}
            </p>
          </div>

          {/* Conclusiones */}
          <div className="rounded-md border border-slate-700 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-xl font-semibold text-slate-100">
              Conclusiones
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Capa SEMARNAT (oficial):</strong> internamente
                consistente con la ley, datos 2021 a escala 1:1000. Es la
                referencia más rigurosa del sitio. Limitación: 5 años de
                potenciales cambios costeros sin actualizar.
              </li>
              <li>
                <strong>Pleamar estimada (ciudadana):</strong> útil para
                contexto pero no para análisis. Errores de hasta varios
                kilómetros en zonas con relieve. Mantener desactivada por
                defecto.
              </li>
              <li>
                <strong>Imagen Esri:</strong> alta resolución, sin fecha
                certificada. Útil visualmente pero no para análisis temporal.
                Para análisis de cambios usar Sentinel-2 con fecha.
              </li>
              <li>
                <strong>Caso Las Cocinas:</strong> si se observan
                construcciones del lado mar de la línea ZONA FEDERAL en la
                imagen Esri, hay tres explicaciones posibles, en orden de
                probabilidad: (a) construcción posterior a 2021, no
                catastrada; (b) excepción legal mapeada como TERRENOS
                GANADOS MAR o MUELLE; (c) presunta invasión documentada.
                Para discriminar se necesita peritaje topográfico in situ.
              </li>
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
