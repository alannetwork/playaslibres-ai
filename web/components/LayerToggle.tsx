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
  swatchClass: string;
}[] = [
  {
    key: "sentinel",
    label: "Sentinel-2",
    hint: "Imagen satelital RGB (referencia visual)",
    swatchClass: "bg-emerald-500/70",
  },
  {
    key: "zofemat",
    label: "ZOFEMAT oficial",
    hint: "Capa SEMARNAT (referencial, no plano legal)",
    swatchClass: "bg-red-500/70",
  },
  {
    key: "pleamar",
    label: "Pleamar estimada",
    hint: "Aproximación ciudadana ±10–30 m",
    swatchClass: "bg-blue-400/80",
  },
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
              <span
                className={`inline-block h-3 w-3 rounded-sm ${item.swatchClass}`}
                aria-hidden
              />
              <span className="font-medium">{item.label}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {item.hint}
              </span>
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}
