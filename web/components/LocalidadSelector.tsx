"use client";

import { MapPin } from "lucide-react";
import { LOCALIDADES, type LocalidadSlug } from "@/lib/localidades";

type Props = {
  current: LocalidadSlug;
  onSelect: (slug: LocalidadSlug) => void;
};

export function LocalidadSelector({ current, onSelect }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Localidad"
      className="pointer-events-auto inline-flex items-center gap-0.5 rounded-md border border-slate-700 bg-slate-950/85 p-0.5 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur sm:text-xs"
    >
      <MapPin
        className="ml-1.5 mr-0.5 h-3 w-3 shrink-0 text-slate-400"
        aria-hidden
      />
      {LOCALIDADES.map((loc) => {
        const active = loc.slug === current;
        return (
          <button
            key={loc.slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(loc.slug)}
            className={`rounded px-2 py-1 transition ${
              active
                ? "bg-sky-500/20 text-sky-100"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            }`}
            title={`${loc.name} · ${loc.estado_mx}`}
          >
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
