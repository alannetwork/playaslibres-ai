"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Layers, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

export type ZofematSubLayers = {
  playaLibre: boolean;
  pleamarMaxima: boolean;
  zonaFederal: boolean;
  playaMaritima: boolean;
  terrenosGanadosMar: boolean;
  mangle: boolean;
  muelle: boolean;
};

export type LayerVisibility = {
  sentinel: boolean;
  zofemat: boolean;
  pleamar: boolean; // pleamar estimada (experimental)
  zofematSub: ZofematSubLayers;
};

export type SatelliteSource = "esri" | "sentinel";

const ZOFEMAT_SUBS: {
  key: keyof ZofematSubLayers;
  label: string;
  hint: string;
  swatch: { color: string; thick?: boolean; dashed?: boolean; fill?: boolean };
}[] = [
  {
    key: "playaLibre",
    label: "Playa libre (ZOFEMAT)",
    hint: "Franja pública 20 m entre pleamar y zona federal",
    swatch: { color: "#facc15", fill: true },
  },
  {
    key: "pleamarMaxima",
    label: "Pleamar máxima",
    hint: "Línea oficial SEMARNAT",
    swatch: { color: "#0ea5e9", thick: true },
  },
  {
    key: "zonaFederal",
    label: "Zona federal",
    hint: "Borde interno de la franja federal",
    swatch: { color: "#dc2626", thick: true },
  },
  {
    key: "playaMaritima",
    label: "Playa marítima",
    hint: "Playa pública entre pleamar y bajamar",
    swatch: { color: "#fbbf24" },
  },
  {
    key: "terrenosGanadosMar",
    label: "Terrenos ganados al mar",
    hint: "Áreas rellenadas (régimen especial)",
    swatch: { color: "#a855f7", dashed: true },
  },
  {
    key: "mangle",
    label: "Manglar",
    hint: "Manglar inventariado",
    swatch: { color: "#16a34a" },
  },
  {
    key: "muelle",
    label: "Muelle",
    hint: "Estructuras portuarias",
    swatch: { color: "#94a3b8" },
  },
];

function Swatch({
  color,
  thick,
  dashed,
  fill,
}: {
  color: string;
  thick?: boolean;
  dashed?: boolean;
  fill?: boolean;
}) {
  if (fill) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 14,
          height: 10,
          background: color,
          opacity: 0.45,
          border: `1px solid ${color}`,
          borderRadius: 2,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 14,
        height: 0,
        borderTop: `${thick ? 3 : 2}px ${dashed ? "dashed" : "solid"} ${color}`,
      }}
    />
  );
}

const PLEAMAR_LEGEND = [
  { color: "#1e40af", label: "Pleamar máx. estimada (1.2 m)" },
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
  const [zofematDetail, setZofematDetail] = useState(true);

  const activeCount =
    (value.sentinel ? 1 : 0) +
    (value.zofemat ? 1 : 0) +
    (value.pleamar ? 1 : 0);

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
          {activeCount}/3
        </span>
      </button>
    );
  }

  return (
    <Card className="w-full max-w-md border-slate-700 bg-slate-950/90 text-slate-100 shadow-xl backdrop-blur">
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

        {/* Master toggles */}
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={value.sentinel}
              onCheckedChange={(v) =>
                onChange({ ...value, sentinel: Boolean(v) })
              }
            />
            <span className="font-medium">Satélite</span>
            <span className="text-xs text-slate-400">
              Imagen aérea de fondo
            </span>
          </label>

          {/* ZOFEMAT con sub-capas */}
          <div>
            <div className="flex items-center gap-2">
              <Switch
                checked={value.zofemat}
                onCheckedChange={(v) =>
                  onChange({ ...value, zofemat: Boolean(v) })
                }
              />
              <button
                type="button"
                onClick={() => setZofematDetail((p) => !p)}
                className="flex items-center gap-1 text-left font-medium hover:text-slate-300"
                title="Mostrar sub-capas — Fuente oficial DGZFMTAC SEMARNAT"
              >
                ZOFEMAT (SEMARNAT)
                <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                  Oficial
                </span>
                {zofematDetail ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>
            </div>
            {zofematDetail && value.zofemat && (
              <div className="ml-9 mt-1 flex flex-col gap-1 border-l border-slate-700 pl-3">
                {ZOFEMAT_SUBS.map((sub) => (
                  <label
                    key={sub.key}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <Switch
                      checked={value.zofematSub[sub.key]}
                      onCheckedChange={(v) =>
                        onChange({
                          ...value,
                          zofematSub: {
                            ...value.zofematSub,
                            [sub.key]: Boolean(v),
                          },
                        })
                      }
                    />
                    <Swatch {...sub.swatch} />
                    <span>{sub.label}</span>
                    <span className="hidden text-[10px] text-slate-500 sm:inline">
                      {sub.hint}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              checked={value.pleamar}
              onCheckedChange={(v) =>
                onChange({ ...value, pleamar: Boolean(v) })
              }
            />
            <span className="font-medium">Pleamar estimada</span>
            <span className="text-xs text-amber-300/90">experimental</span>
            <a
              href="/validacion"
              className="text-[10px] text-blue-300 underline-offset-2 hover:underline"
            >
              ver validación
            </a>
          </label>
        </div>

        {/* Fuente satelital */}
        <div className="flex items-center gap-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
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

        {/* Leyenda de pleamar estimada cuando está activa */}
        {value.pleamar && (
          <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-300">
            <div className="mb-1 font-semibold text-slate-400">
              Pleamar estimada (experimental)
            </div>
            <ul className="space-y-0.5">
              {PLEAMAR_LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <Swatch color={l.color} dashed={l.dashed} />
                  <span>{l.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
