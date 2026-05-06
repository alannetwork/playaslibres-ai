import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Metodología",
  description:
    "Cómo se construyen las capas del mapa, qué fuentes usamos y cómo se calcula la franja Playa Libre.",
  alternates: { canonical: "/metodologia" },
  openGraph: {
    type: "article",
    locale: "es_MX",
    siteName: "Playas Libres",
    url: "/metodologia",
    title: "Metodología · Playas Libres",
    description:
      "Cómo se construyen las capas del mapa, qué fuentes usamos y cómo se calcula la franja Playa Libre.",
  },
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
          de dónde sale cada línea del mapa. Para los números y la
          consistencia, ver{" "}
          <Link
            href="/validacion"
            className="text-blue-300 underline-offset-2 hover:underline"
          >
            Validación científica
          </Link>
          .
        </p>
      </header>

      <section className="space-y-8 text-slate-300">
        {/* 1. Fuentes */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            1. Fuentes de datos
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong>ZOFEMAT SEMARNAT</strong> — capa pública 220
              <em> B_BANDERAS_2021</em> publicada por la DGZFMTAC vía
              MapServer ArcGIS.{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer/220"
              >
                Endpoint MapServer
              </a>
              . 1319 features de 7 categorías (PLEAMAR MAXIMA, ZONA FEDERAL,
              PLAYA MARITIMA, TERRENOS GANADOS MAR, MUELLE, MANGLE, MARGEN),
              105 planos topográficos, escala 1:1000, ITRF2008 Z13,
              levantamiento 2021.
            </li>
            <li>
              <strong>Esri World Imagery</strong> — imagen aérea satelital
              de alta resolución (sub-métrica en muchas zonas), sin fecha
              certificada. Usada como fondo visual.{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
              >
                Servicio ArcGIS
              </a>
              .
            </li>
            <li>
              <strong>Sentinel-2 L2A</strong> — escena con fecha conocida
              (mejor escena 2025 con &lt; 5% nubes sobre la bahía: 20 dic
              2025). Catálogo STAC abierto Element84/AWS Open Data, RGB
              visual a 10 m/pixel servido como tiles vía TiTiler.{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://earth-search.aws.element84.com/v1"
              >
                STAC Element84
              </a>
              .
            </li>
            <li>
              <strong>Copernicus DEM 30 m</strong> — modelo digital de
              elevación global (DSM, mide superficie), referido al geoide
              EGM2008. Recortado al bbox de Bahía de Banderas.{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://copernicus-dem-30m.s3.amazonaws.com"
              >
                AWS Open Data
              </a>
              .
            </li>
            <li>
              <strong>FES2014</strong> — modelo global de mareas
              (CNES/LEGOS/CLS). Requiere registro AVISO+. En esta versión
              usamos un fallback armónico (M2/S2/K1/O1) por no disponer del
              modelo; queda etiquetado en el JSON de mareas como{" "}
              <code>harmonic_fallback</code>.
            </li>
            <li>
              <strong>OpenFreeMap Positron</strong> — mapa base vector
              (calles, etiquetas) gratuito y sin API key.{" "}
              <a
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://openfreemap.org"
              >
                openfreemap.org
              </a>
              .
            </li>
          </ul>
        </div>

        {/* 2. Construcción franja Playa Libre */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            2. Cómo se construye la franja &ldquo;Playa Libre&rdquo;
          </h2>
          <p className="mb-2 text-sm">
            La ZOFEMAT (Ley General de Bienes Nacionales art. 119 fr. I)
            es la franja de 20 m tierra adentro de la pleamar máxima — y
            es de uso público inalienable. Para visualizarla como
            polígono, no como dos líneas paralelas:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Cargamos las dos líneas oficiales SEMARNAT:{" "}
              <code>PLEAMAR MAXIMA</code> (296 features) y{" "}
              <code>ZONA FEDERAL</code> (290 features).
            </li>
            <li>
              Reproyectamos a UTM 13N (EPSG:32613) para trabajar en metros
              reales.
            </li>
            <li>
              Hacemos un <em>buffer</em> de 12 m alrededor de cada línea
              (un poco más que la mitad de los 20 m legales).
            </li>
            <li>
              Calculamos la <em>intersección</em> de los dos buffers — el
              área donde ambas franjas se solapan.
            </li>
            <li>
              Reproyectamos el polígono resultante a WGS84 y lo servimos
              como PMTiles.
            </li>
          </ol>
          <p className="mt-2 text-sm">
            Resultado en Bahía de Banderas: <strong>75.4 hectáreas</strong>{" "}
            de zona federal pública mapeada en 496 polígonos. Tramos donde
            la pleamar y la zona federal están a más de 24 m (muelles,
            terrenos ganados, marismas) quedan correctamente sin franja.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Script: <code>scripts/08_compute_playa_libre.py</code> ·
            Reproducible localmente.
          </p>
        </div>

        {/* 3. Pleamar estimada (experimental) */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            3. Pleamar estimada (experimental, off por defecto)
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Recortamos el DEM Copernicus 30 m al bbox de la bahía y
              filtramos la franja costera (≤ 5 m).
            </li>
            <li>
              Para cada altura discreta de marea (de −1.0 m a +1.2 m en
              pasos de 0.2 m) generamos la máscara{" "}
              <code>dem ≤ altura + offset</code>.
            </li>
            <li>
              Vectorizamos el contorno (rasterio.features.shapes),
              simplificamos a ~10 m de tolerancia (shapely) y exportamos
              GeoJSON con propiedad <code>tide_m</code>.
            </li>
            <li>
              Convertimos a PMTiles y lo servimos como capa vectorial.
              El slider del año mueve un timestamp; con el JSON de mareas
              calculamos la altura instantánea, redondeamos al múltiplo
              de 0.2 m más cercano, y filtramos la capa.
            </li>
          </ol>
          <div className="mt-2 rounded-md border border-amber-700/40 bg-amber-900/15 p-3 text-sm">
            <strong className="text-amber-200">Limitaciones críticas.</strong>{" "}
            El DEM Copernicus es un DSM (mide superficie, no suelo
            desnudo) — edificios, cantiles y vegetación inflan la cota.
            El offset de datum DEM↔NMM no está calibrado in situ. La
            marea usa fallback armónico, no FES2014. Resultado:
            mediana 25.9 m de error vs oficial pero p95 = 11 km. Solo
            para contexto visual aproximado, nunca como referencia legal.{" "}
            <Link
              href="/validacion"
              className="text-blue-300 underline-offset-2 hover:underline"
            >
              Números completos
            </Link>
            .
          </div>
        </div>

        {/* 4. Capa oficial */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            4. Qué es la capa &ldquo;ZOFEMAT oficial&rdquo;
          </h2>
          <p className="text-sm">
            <strong className="text-emerald-300">
              Es la fuente oficial publicada por el gobierno mexicano.
            </strong>{" "}
            Específicamente, es la capa <code>220 B_BANDERAS_2021</code>{" "}
            del MapServer ArcGIS de la{" "}
            <strong>
              Dirección General de Zona Federal Marítimo-Terrestre y
              Ambientes Costeros (DGZFMTAC) de SEMARNAT
            </strong>
            . Estos planos topográficos a escala 1:1000 son los datos
            que el propio gobierno publica como referencia de la
            delimitación de la ZOFEMAT en Bahía de Banderas.
          </p>
          <p className="mt-2 text-sm">
            Importante distinción para uso legal: la
            NOM-146-SEMARNAT-2017 establece que los planos con{" "}
            <em>valor jurídico probatorio</em> (es decir, los que sirven
            como prueba en un juicio) son los <strong>originales
            firmados por perito autorizado</strong> y validados por la
            DGZFMTAC. Lo que muestra este sitio es la{" "}
            <strong>publicación digital oficial</strong> de esos planos
            — información gubernamental verídica, ideal para
            transparencia ciudadana y periodismo, pero la copia
            digital no sustituye al plano peritado original cuando
            hay un proceso judicial en curso.
          </p>
          <p className="mt-2 text-sm">
            En resumen:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Para informarte y documentar denuncias:</strong>{" "}
              esta capa es la fuente oficial mexicana, válida y
              verificable contra el MapServer público de SEMARNAT.
            </li>
            <li>
              <strong>Para presentar como prueba en juicio:</strong>{" "}
              hay que solicitar a la DGZFMTAC el plano peritado
              original.
            </li>
          </ul>
        </div>

        {/* 5. Qué NO se puede concluir */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            5. Qué NO se puede concluir de este sitio
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>No se puede usar como prueba pericial ni como plano legal.</li>
            <li>
              No es válido para acreditar invasión, despojo o cualquier
              hecho jurídico individual.
            </li>
            <li>
              Las diferencias visuales entre la imagen actual (Esri) y
              las líneas SEMARNAT 2021 pueden deberse a construcciones
              posteriores, modificaciones de costa o diferencias entre
              las dos vistas, sin que ello implique infracción.
            </li>
            <li>
              No reemplaza al levantamiento topográfico de campo ni al
              trabajo del perito.
            </li>
          </ul>
        </div>

        {/* 6. Referencias legales */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            6. Referencias legales y técnicas
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <a
                href="https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Constitución Política de los Estados Unidos Mexicanos, art. 27
              </a>{" "}
              — playas y ZOFEMAT son bienes nacionales de uso común.
            </li>
            <li>
              <a
                href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LGBN.pdf"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ley General de Bienes Nacionales (LGBN), art. 119
              </a>{" "}
              — define la ZOFEMAT como franja de 20 m tierra adentro de
              la pleamar máxima.
            </li>
            <li>
              <a
                href="https://www.dof.gob.mx/nota_detalle.php?codigo=5485172"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                NOM-146-SEMARNAT-2017
              </a>{" "}
              — procedimiento técnico para delimitar la ZOFEMAT y
              requisitos del plano peritado.
            </li>
            <li>
              <a
                href="https://www.gob.mx/conanp"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Reforma 2025 al Reglamento Nacional de Áreas Protegidas (RNAP)
              </a>{" "}
              — endurece criterios en áreas costeras sensibles.
            </li>
            <li>
              <a
                href="https://www.gob.mx/semar"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Secretaría de Marina (SEMAR)
              </a>{" "}
              — tablas oficiales de predicción de marea por puerto.
            </li>
          </ul>
        </div>

        {/* 7. Datasets / scripts */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            7. Datasets y herramientas
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              <a
                href="https://browser.dataspace.copernicus.eu/"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Copernicus Data Space
              </a>{" "}
              — origen Sentinel-2.
            </li>
            <li>
              <a
                href="https://aws.amazon.com/marketplace/pp/prodview-noaa-cdr-airs"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                AWS Open Data — Copernicus DEM 30 m
              </a>
              .
            </li>
            <li>
              <a
                href="https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                AVISO+ — FES2014 ocean tide model
              </a>
              .
            </li>
            <li>
              <a
                href="https://github.com/protomaps/PMTiles"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                PMTiles
              </a>{" "}
              · vector tiles archivados como un solo archivo.
            </li>
            <li>
              <a
                href="https://github.com/felt/tippecanoe"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                tippecanoe
              </a>{" "}
              · GeoJSON → MVT/PMTiles.
            </li>
            <li>
              <a
                href="https://maplibre.org"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                MapLibre GL JS
              </a>{" "}
              · render del mapa.
            </li>
            <li>
              <a
                href="https://developmentseed.org/titiler"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                TiTiler
              </a>{" "}
              · servidor dinámico de tiles desde COG.
            </li>
            <li>
              <a
                href="https://rasterio.readthedocs.io"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                rasterio
              </a>
              ,{" "}
              <a
                href="https://shapely.readthedocs.io"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                shapely
              </a>
              ,{" "}
              <a
                href="https://pyproj4.github.io/pyproj/"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                pyproj
              </a>{" "}
              · pipeline geoespacial.
            </li>
            <li>
              <a
                href="https://pytmd.readthedocs.io"
                className="text-blue-300 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                pyTMD
              </a>{" "}
              · cálculo de mareas (pendiente FES2014).
            </li>
          </ul>
        </div>

        {/* 8. Tabla incertidumbres */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            8. Tabla resumen de incertidumbres
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-2 pr-4">Componente</th>
                  <th className="py-2 pr-4">Resolución</th>
                  <th className="py-2">Incertidumbre</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">SEMARNAT plano 1:1000 (2021)</td>
                  <td className="py-2 pr-4">~1 m</td>
                  <td className="py-2">±2–5 m horizontal (digitalización)</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Franja Playa Libre derivada</td>
                  <td className="py-2 pr-4">~12 m buffer</td>
                  <td className="py-2">±2–5 m + outliers en muelles</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Esri World Imagery</td>
                  <td className="py-2 pr-4">sub-métrica</td>
                  <td className="py-2">excelente, sin fecha certificada</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Sentinel-2 L2A</td>
                  <td className="py-2 pr-4">10 m</td>
                  <td className="py-2">borroso a zoom alto, fecha conocida</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Copernicus DEM 30 m (DSM)</td>
                  <td className="py-2 pr-4">30 m H, ±2–4 m V</td>
                  <td className="py-2">mide superficie, no suelo</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Fallback armónico de marea</td>
                  <td className="py-2 pr-4">10 min</td>
                  <td className="py-2">±20–50 cm</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Línea ciudadana combinada</td>
                  <td className="py-2 pr-4">—</td>
                  <td className="py-2">mediana 26 m, p95 11 km</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 9. Detección automatizada de candidatos */}
        <div>
          <h2 className="mb-2 text-xl font-semibold text-slate-100">
            9. Detección automatizada de candidatos a invasión
          </h2>
          <p className="text-sm">
            Cruzamos las geometrías de OpenStreetMap (huellas de
            edificios) sobre la franja oficial de zona federal de
            SEMARNAT, en metros reales (proyectadas a UTM 13N), y
            calculamos el porcentaje de cada construcción que cae
            dentro de la franja.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>
              Descargamos las huellas <code>building=*</code> de
              Bahía de Banderas vía Overpass API.
            </li>
            <li>
              Reproyectamos a UTM 13N e intersectamos con la franja
              ZOFEMAT pública (capa 220 SEMARNAT).
            </li>
            <li>
              Para cada huella calculamos{" "}
              <code>area_invadida_m2 / area_total_m2</code>.
            </li>
            <li>
              Clasificamos por severidad: <strong>roja</strong> ≥ 50%
              dentro de la zona federal,{" "}
              <strong>ámbar</strong> entre el umbral mínimo y 50%.
            </li>
          </ol>
          <div className="mt-3 rounded-md border border-amber-700/40 bg-amber-900/15 p-3 text-sm">
            <strong className="text-amber-200">
              Cifras y alcance.
            </strong>{" "}
            El análisis preliminar identificó cerca de{" "}
            <strong>107 construcciones candidatas</strong> dentro o
            sobre la ZOFEMAT en toda la bahía. Esta primera versión
            publica las <strong>47 con mayor confianza geométrica</strong>{" "}
            (25 rojas con ≥ 50% de su área dentro de zona federal y 22
            ámbar con afectación parcial significativa). El resto se
            está revisando manualmente — geometrías OSM de baja
            calidad, construcciones demolidas, falsos positivos en
            muelles y palapas — y se irá publicando en lotes conforme
            se validen.
          </div>
          <p className="mt-2 text-sm">
            <strong>
              Cada candidato es una señal para investigación, no una
              acusación.
            </strong>{" "}
            La huella OSM puede estar mal alineada, la construcción
            puede contar con concesión vigente, o la franja SEMARNAT
            del levantamiento 2021 puede no reflejar deslindes
            posteriores. Antes de tratar un caso como invasión hay
            que cruzar con el plano peritado original, el catastro
            municipal y el expediente de concesiones de la DGZFMTAC.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Datos:{" "}
            <a
              href="/data/candidatos.json"
              className="text-blue-300 underline-offset-2 hover:underline"
            >
              candidatos.json
            </a>{" "}
            · Script: <code>scripts/12_detect_invasiones.py</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
