"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import Link from "next/link";

export function Attribution() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Créditos y disclaimer"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-900"
      >
        <Info className="h-3.5 w-3.5 text-slate-400" />
        <span>Créditos</span>
      </button>
    );
  }

  return (
    <div className="relative max-w-2xl rounded-md border border-slate-700 bg-slate-950/85 px-3 py-2 pr-7 text-[10px] leading-snug text-slate-400 shadow-lg backdrop-blur sm:text-xs">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        title="Minimizar"
        aria-label="Minimizar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
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
        Modelo de marea FES2014 (CNES/LEGOS/CLS) · Imagen aérea © Esri World
        Imagery · Código abierto bajo licencia AGPL-3.0.
      </p>
    </div>
  );
}
