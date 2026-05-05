"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import Link from "next/link";

const REPO_URL = "https://github.com/alannetwork/playaslibres-ai";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}

export function Attribution() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Créditos y disclaimer"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-900"
        >
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>Créditos</span>
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Código abierto en GitHub"
          aria-label="Código abierto en GitHub"
          className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-950/85 p-1.5 text-slate-300 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
        >
          <GithubMark className="h-3.5 w-3.5" />
        </a>
      </div>
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
          href="/validacion"
          className="text-blue-300 underline-offset-2 hover:underline"
        >
          Validación
        </Link>
        {" · "}
        <Link
          href="/metodologia"
          className="text-blue-300 underline-offset-2 hover:underline"
        >
          Metodología
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
        Imagery ·{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-300 underline-offset-2 hover:underline"
        >
          <GithubMark className="h-3 w-3" />
          Código abierto (AGPL-3.0)
        </a>
        .
      </p>
    </div>
  );
}
