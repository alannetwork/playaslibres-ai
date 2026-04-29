"use client";

import { useState } from "react";
import { Layers, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

export type LayerVisibility = {
  sentinel: boolean;
  zofemat: boolean;
  pleamar: boolean;
};

export type SatelliteSource = "esri" | "sentinel";

const ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  hint: string;
}[] = [
  {
    key: "sentinel",
    label: "Satélite",
    hint: "Imagen aérea de fondo",
  },
  {
    key: "zofemat",
    label: "ZOFEMAT oficial",
    hint: "Capa SEMARNAT (referencial)",
  },
  {
    key: "pleamar",
    label: "Pleamar estimada (experimental)",
    hint: "Errores grandes — ver /validacion",
  },
];

const ZOFEMAT_LEGEND = [
  { color: "#0ea5e9", label: "Pleamar máx. oficial", thick: true },
  { color: "#dc2626", label: "Zona Federal", thick: true },
  { color: "#fbbf24", label: "Playa marítima" },
  { color: "#a855f7", label: "Terrenos ganados al mar", dashed: true },
  { color: "#16a34a", label: "Manglar" },
  { color: "#94a3b8", label: "Muelle" },
];

const PLEAMAR_LEGEND = [
  { color: "#1e40af", label: "Pleamar máxima estimada (1.2 m)" },
  { color: "#60a5fa", label: "Pleamar al instante del slider", dashed: true },
];

export function LayerToggle({
  value,
  onChange,
  satSource,
  onSatSourceChange,
}: {
  value: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
  satSource: SatelliteSource;
  onSatSourceChange: (s: SatelliteSource) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Capas y leyenda"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-900"
      >
        <Layers className="h-4 w-4" />
        <span>Capas</span>
        <span className="ml-1 text-[10px] text-slate-400">
          {Object.values(value).filter(Boolean).length}/3
        </span>
      </button>
    );
  }

  return (
    <Card className="w-fit max-w-full border-slate-700 bg-slate-950/85 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Capas
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            title="Minimizar"
            aria-label="Minimizar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Switch
                checked={value[item.key]}
                onCheckedChange={(v) =>
                  onChange({ ...value, [item.key]: Boolean(v) })
                }
              />
              <span className="font-medium">{item.label}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {item.hint}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Fuente:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-700">
            <button
              type="button"
              onClick={() => onSatSourceChange("esri")}
              className={`px-2 py-0.5 text-[11px] transition ${
                satSource === "esri"
                  ? "bg-slate-700 text-slate-100"
                  : "bg-transparent text-slate-400 hover:text-slate-200"
              }`}
              title="Imagen aérea de alta resolución (Esri World Imagery)"
            >
              Esri (alta res.)
            </button>
            <button
              type="button"
              onClick={() => onSatSourceChange("sentinel")}
              className={`px-2 py-0.5 text-[11px] transition ${
                satSource === "sentinel"
                  ? "bg-slate-700 text-slate-100"
                  : "bg-transparent text-slate-400 hover:text-slate-200"
              }`}
              title="Sentinel-2 con fecha conocida (10 m/pixel)"
            >
              Sentinel-2
            </button>
          </div>
        </div>

        <div className="mt-1 grid gap-x-4 gap-y-1 border-t border-slate-800 pt-2 text-[11px] text-slate-300 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-semibold text-slate-400">
              ZOFEMAT (SEMARNAT)
            </div>
            <ul className="space-y-0.5">
              {ZOFEMAT_LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 0,
                      borderTop: `${l.thick ? 3 : 2}px ${
                        l.dashed ? "dashed" : "solid"
                      } ${l.color}`,
                    }}
                  />
                  <span>{l.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-400">
              Pleamar estimada
            </div>
            <ul className="space-y-0.5">
              {PLEAMAR_LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 0,
                      borderTop: `2px ${l.dashed ? "dashed" : "solid"} ${
                        l.color
                      }`,
                    }}
                  />
                  <span>{l.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
