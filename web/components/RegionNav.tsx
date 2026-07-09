"use client";

import { useMemo, useRef, useState } from "react";
import { Search, MapPin, X, Star } from "lucide-react";
import {
  ESTADOS_MX,
  LOCALIDADES_MX,
  LOCALIDADES_MX_BY_ESTADO,
  type LocalidadMx,
} from "@/lib/localidades-mx";

/** Quita acentos y baja a minúsculas para búsqueda tolerante. */
function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Navegación nacional: buscador + lista jerárquica estado → municipio.
 * Reemplaza al selector fijo de 3 localidades cuando la cobertura es nacional.
 * Al elegir un municipio, hace flyTo a su bbox.
 */
export function RegionNav({
  onSelect,
}: {
  onSelect: (loc: LocalidadMx) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return null;
    return LOCALIDADES_MX.filter(
      (l) => fold(l.municipio).includes(q) || fold(l.estado).includes(q),
    ).slice(0, 40);
  }, [query]);

  const pick = (loc: LocalidadMx) => {
    onSelect(loc);
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        title="Buscar localidad en todo México"
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-900 sm:text-xs"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar localidad</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-md border border-slate-700 bg-slate-950/95 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Municipio o estado…"
          className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[min(60vh,24rem)] overflow-y-auto py-1 text-xs">
        {results ? (
          results.length === 0 ? (
            <p className="px-3 py-2 text-slate-500">Sin resultados.</p>
          ) : (
            results.map((l) => (
              <button
                key={l.slug}
                type="button"
                onClick={() => pick(l)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800"
              >
                <MapPin className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                <span className="truncate">{l.municipio}</span>
                {l.curada && (
                  <Star className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                )}
                <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                  {l.estado}
                </span>
              </button>
            ))
          )
        ) : (
          ESTADOS_MX.map((estado) => (
            <details key={estado} className="group">
              <summary className="flex cursor-pointer items-center justify-between px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                <span>{estado}</span>
                <span className="text-[10px] text-slate-500">
                  {LOCALIDADES_MX_BY_ESTADO[estado].length}
                </span>
              </summary>
              <div className="pb-1">
                {LOCALIDADES_MX_BY_ESTADO[estado].map((l) => (
                  <button
                    key={l.slug}
                    type="button"
                    onClick={() => pick(l)}
                    className="flex w-full items-center gap-2 py-1 pl-7 pr-3 text-left text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <span className="truncate">{l.municipio}</span>
                    {l.curada && (
                      <Star className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
