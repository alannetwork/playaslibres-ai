"use client";

import { Calendar } from "lucide-react";
import type { YearFilter } from "./Map";

/**
 * Selector del año de delimitación ZOFEMAT a mostrar. La capa nacional
 * conserva los 5 consolidados anuales de SEMARNAT (sin deduplicar por tramo);
 * este control filtra cuál se pinta. "Todos" pinta la unión de los años, que
 * es la cobertura máxima del país (ningún año individual es nacional).
 */
export function YearSelector({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: YearFilter;
  onChange: (year: YearFilter) => void;
}) {
  if (years.length === 0) return null;
  const options: YearFilter[] = ["todos", ...years];
  return (
    <div
      role="group"
      aria-label="Año de delimitación ZOFEMAT"
      className="pointer-events-auto inline-flex items-center gap-0.5 rounded-md border border-slate-700 bg-slate-950/85 p-0.5 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur sm:text-xs"
      title="Año del plano de delimitación publicado por SEMARNAT"
    >
      <Calendar className="ml-1.5 mr-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      {options.map((opt) => {
        const active = opt === value;
        const label = opt === "todos" ? "Todos" : String(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={`rounded px-2 py-1 transition ${
              opt === "todos" ? "" : "font-mono"
            } ${
              active
                ? "bg-emerald-500/20 text-emerald-100"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
