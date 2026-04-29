"use client";

import Link from "next/link";

export function Attribution() {
  return (
    <div className="rounded-md bg-slate-950/85 px-3 py-2 text-[10px] leading-snug text-slate-400 shadow-lg backdrop-blur sm:text-xs">
      <p className="mb-1 text-slate-300">
        Capas referenciales. No constituyen delimitación oficial de la ZOFEMAT.{" "}
        <Link
          href="/metodologia"
          className="text-blue-300 underline-offset-2 hover:underline"
        >
          Ver Metodología
        </Link>
        {" · "}
        <Link
          href="/acerca"
          className="text-blue-300 underline-offset-2 hover:underline"
        >
          Acerca
        </Link>
        .
      </p>
      <p className="text-slate-500">
        Datos: Contains modified Copernicus Sentinel data 2025 · Copernicus
        WorldDEM-30 © DLR/Airbus · Delimitación ZOFEMAT publicada por SEMARNAT
        (DGZFMTAC) · Mapa base © OpenFreeMap, OpenStreetMap contributors ·
        Modelo de marea FES2014 (CNES/LEGOS/CLS) · Código abierto bajo licencia
        AGPL-3.0.
      </p>
    </div>
  );
}
