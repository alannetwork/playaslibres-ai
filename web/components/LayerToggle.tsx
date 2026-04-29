"use client";

import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

export type LayerVisibility = {
  sentinel: boolean;
  zofemat: boolean;
  pleamar: boolean;
};

const ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  hint: string;
}[] = [
  {
    key: "sentinel",
    label: "Sentinel-2",
    hint: "Imagen satelital RGB (referencia visual)",
  },
  {
    key: "zofemat",
    label: "ZOFEMAT oficial",
    hint: "Capa SEMARNAT (referencial, no plano legal)",
  },
  {
    key: "pleamar",
    label: "Pleamar estimada",
    hint: "Aproximación ciudadana ±10–30 m",
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
}: {
  value: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
}) {
  return (
    <Card className="w-fit max-w-full border-slate-700 bg-slate-950/85 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-2 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Capas
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
