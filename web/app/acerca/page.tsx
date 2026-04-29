import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca",
  description:
    "Qué es Playas Libres, por qué existe, marco legal y limitaciones técnicas.",
};

export default function AcercaPage() {
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
          Acerca de Playas Libres
        </h1>
        <p className="mt-2 text-slate-300">
          Una herramienta de transparencia ciudadana para Bahía de Banderas.
        </p>
      </header>

      <section className="prose prose-invert max-w-none space-y-6 text-slate-300">
        <h2 className="text-xl font-semibold text-slate-100">Qué es</h2>
        <p>
          Playas Libres muestra sobre un mapa satelital de Bahía de Banderas
          dos cosas: una estimación visual aproximada de la línea de pleamar,
          y la delimitación oficial de la Zona Federal Marítimo-Terrestre
          (ZOFEMAT) publicada por SEMARNAT. La idea es que cualquier persona
          pueda comparar visualmente las dos capas y entender hasta dónde, en
          principio, llega la franja federal en una playa.
        </p>

        <h2 className="text-xl font-semibold text-slate-100">Por qué existe</h2>
        <p>
          En abril de 2026, vecinos de Punta de Mita denunciaron presunta
          invasión de zona federal en{" "}
          <strong>Playa Las Cocinas</strong> por parte del desarrollo hotelero{" "}
          <em>Cantiles de Mita / Montage</em>. SEMARNAT impuso una suspensión
          temporal y la prensa local cubrió ampliamente el conflicto. Casos
          como este se repiten en distintas playas del país y casi nunca hay
          una herramienta pública que permita al ciudadano contrastar lo que
          dice el desarrollador con lo que dice el catastro federal.
        </p>
        <p>
          Este sitio no produce pruebas periciales ni se sustituye al trabajo
          de la DGZFMTAC. Sirve para hacer visible un conflicto y para
          empoderar al periodismo, a abogados y a las propias comunidades
          costeras.
        </p>

        <h2 className="text-xl font-semibold text-slate-100">Marco legal</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Constitución, art. 27.</strong> Las playas y la zona
            federal marítimo-terrestre son bienes nacionales de uso común,
            inalienables e imprescriptibles.
          </li>
          <li>
            <strong>Ley General de Bienes Nacionales (LGBN).</strong> Define la
            ZOFEMAT y las concesiones que pueden otorgarse sobre ella.
          </li>
          <li>
            <strong>NOM-146-SEMARNAT-2017.</strong> Establece el procedimiento
            técnico para delimitar la ZOFEMAT y los planos que produce sólo
            tienen valor legal cuando están firmados por perito autorizado y
            validados por la DGZFMTAC.
          </li>
          <li>
            <strong>Reforma 2025 al Reglamento Nacional de Áreas Protegidas
            (RNAP).</strong>{" "}
            Endurece los criterios de uso de zona federal en áreas
            ecológicamente sensibles.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-100">
          Limitaciones técnicas (honestas)
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            La capa de pleamar estimada usa un DEM de 30 m de resolución y un
            modelo global de marea; la incertidumbre típica es de{" "}
            <strong>±10 a 30 metros</strong> sobre el terreno.
          </li>
          <li>
            El cero del DEM (referido al geoide EGM2008) no coincide
            exactamente con el cero local de marea; la diferencia se compensa
            con un offset configurable que <em>aproximamos</em>, no medimos in
            situ.
          </li>
          <li>
            El modelo de mareas FES2014 requiere registro en AVISO+. Cuando no
            está disponible, esta versión usa una predicción armónica
            simplificada (M2/S2/K1/O1) con constantes de tabla, y queda
            marcado en el JSON como <code>harmonic_fallback</code>.
          </li>
          <li>
            La capa ZOFEMAT que se muestra es la publicada por SEMARNAT en su
            ArcGIS REST. Si SEMARNAT actualiza la capa, este sitio queda
            desactualizado hasta que regeneremos los tiles.
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-100">Cómo contribuir</h2>
        <p>
          El proyecto es código abierto bajo licencia AGPL-3.0. Reportes,
          parches, correcciones de hechos y datos locales son bienvenidos vía
          el repositorio en GitHub.
        </p>

        <h2 className="text-xl font-semibold text-slate-100">Créditos</h2>
        <p className="text-sm text-slate-400">
          Datos: Contains modified Copernicus Sentinel data 2025 · Copernicus
          WorldDEM-30 © DLR e.V. 2010–2014 y © Airbus Defence and Space GmbH
          2014–2018 · Delimitación ZOFEMAT publicada por SEMARNAT (DGZFMTAC) ·
          Mapa base © OpenFreeMap, OpenStreetMap contributors · Modelo de
          marea FES2014 (CNES/LEGOS/CLS) · Código abierto bajo licencia
          AGPL-3.0.
        </p>
      </section>
    </main>
  );
}
