"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Disputa } from "./Map";

const STATUS_LABELS: Record<Disputa["status"], { label: string; className: string }> = {
  en_conflicto: {
    label: "En conflicto",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  resuelto: {
    label: "Resuelto",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  monitoreo: {
    label: "En monitoreo",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
};

export function InfoPanel({
  disputa,
  onClose,
}: {
  disputa: Disputa | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!disputa} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-950 text-slate-100">
        {disputa && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    STATUS_LABELS[disputa.status].className
                  }`}
                >
                  {STATUS_LABELS[disputa.status].label}
                </span>
              </div>
              <DialogTitle className="text-xl">{disputa.name}</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {disputa.coords[1].toFixed(4)}°N, {(-disputa.coords[0]).toFixed(4)}°O
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-slate-300">
              {disputa.summary}
            </p>
            <div className="space-y-1 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Cobertura
              </p>
              <ul className="space-y-1 text-sm">
                {disputa.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 underline-offset-2 hover:underline"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
