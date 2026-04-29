import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Metodología",
  description:
    "Cómo se calcula la línea estimada de pleamar y qué significa la capa oficial de ZOFEMAT.",
};

export default function MetodologiaPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-10">
        <Link
          href="/"
          className="text-sm text-blue-300 underline-offset-2 hover:underline"
        >
          ← Volver al mapa
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-balance sm:text-4xl">
          Metodología
        </h1>
        <p className="mt-2 text-slate-300">
          Para periodistas, abogados y cualquier persona que quiera entender
          de dónde sale cada línea del mapa.
        </p>
      </header>

      <section className="space-y-8 text-slate-300">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            Fuentes de datos
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Sentinel-2 L2A</strong> · imágenes RGB libres de
              Copernicus, vía el catálogo STAC abierto de{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                href="https://earth-search.aws.element84.com/v1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Element84 / AWS Open Data
              </a>
              . Seleccionamos la mejor escena 2025 con menos de 5% de nubes
              sobre la bahía.
            </li>
            <li>
              <strong>Copernicus DEM 30 m</strong> · modelo digital de
              elevación global, referido al geoide EGM2008. Recortado al
              bounding box de Bahía de Banderas.
            </li>
            <li>
              <strong>FES2014</strong> · modelo global de mareas (CNES /
              LEGOS / CLS). Requiere registro en AVISO+. Si no está
              disponible, usamos un fallback armónico aproximado con cuatro
              constituyentes (M2, S2, K1, O1) marcado explícitamente como tal.
            </li>
            <li>
              <strong>ZOFEMAT SEMARNAT</strong> · capa pública publicada por
              la Dirección General de Zona Federal Marítimo-Terrestre y
              Ambientes Costeros (DGZFMTAC) vía MapServer ArcGIS.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            Cómo se calcula la línea ciudadana de pleamar
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Recortamos el DEM a la bahía y mantenemos sólo la franja costera (≤ 5 m).</li>
            <li>
              Para cada altura discreta de marea (de −1.0 m a +1.2 m en pasos
              de 0.2 m), calculamos la máscara <code>dem ≤ altura + offset</code>.
            </li>
            <li>Vectorizamos el contorno con <code>rasterio.features.shapes</code>.</li>
            <li>
              Simplificamos la geometría con shapely (tolerancia ≈ 10 m) y
              guardamos un GeoJSON por altura.
            </li>
            <li>
              Convertimos a PMTiles con tippecanoe y los servimos como
              archivos estáticos.
            </li>
            <li>
              En el navegador, el slider del año mueve un timestamp; con el
              JSON de mareas calculamos la altura instantánea, redondeamos al
              múltiplo de 0.2 m más cercano y filtramos la capa por{" "}
              <code>tide_m</code>.
            </li>
          </ol>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            Qué es la capa &ldquo;oficial&rdquo;
          </h2>
          <p>
            Es la representación digital de los planos de la ZOFEMAT
            publicados por SEMARNAT. <strong>No es</strong> el plano firmado
            por perito autorizado al que se refiere la NOM-146-SEMARNAT-2017
            como única fuente con valor jurídico; es la versión digital
            difundida por la propia secretaría con fines informativos. Para
            efectos legales, la única fuente válida es el plano peritado
            validado por la DGZFMTAC.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            Qué NO se puede concluir de este sitio
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              No se puede usar como prueba pericial ni como plano legal.
            </li>
            <li>
              No es válido para acreditar invasión, despojo o cualquier hecho
              jurídico individual.
            </li>
            <li>
              Las diferencias visuales entre la capa estimada y la oficial
              pueden deberse a errores del DEM, del modelo de marea o de la
              propia capa SEMARNAT.
            </li>
            <li>
              No reemplaza al levantamiento topográfico de campo ni al trabajo
              del perito.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            Tabla de incertidumbres
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-2 pr-4">Componente</th>
                  <th className="py-2 pr-4">Resolución</th>
                  <th className="py-2">Incertidumbre típica</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">DEM Copernicus 30 m</td>
                  <td className="py-2 pr-4">~30 m horizontal</td>
                  <td className="py-2">±2 a ±4 m vertical</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Modelo de marea FES2014</td>
                  <td className="py-2 pr-4">Global, ~1/16°</td>
                  <td className="py-2">±10–20 cm en costa</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Fallback armónico (M2/S2/K1/O1)</td>
                  <td className="py-2 pr-4">10 min</td>
                  <td className="py-2">±20–40 cm aprox.</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Offset de datum (DEM ↔ NMM)</td>
                  <td className="py-2 pr-4">Constante por bahía</td>
                  <td className="py-2">±50 cm si no se calibra in situ</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Línea estimada (combinada)</td>
                  <td className="py-2 pr-4">—</td>
                  <td className="py-2">±10 a 30 m horizontal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
