"use client";

import { ExternalLink, FileText, Scale } from "lucide-react";
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
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

            {disputa.evidence && (
              <div className="rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-200">
                  <FileText className="h-4 w-4" />
                  {disputa.evidence.title}
                </div>
                <p className="mb-3 text-sm text-slate-200">
                  {disputa.evidence.intro}
                </p>
                <div className="overflow-x-auto rounded border border-slate-700">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-900/60 text-slate-400">
                      <tr>
                        <th className="px-2 py-1 text-left">OBJECTID</th>
                        <th className="px-2 py-1 text-left">Plano</th>
                        <th className="px-2 py-1 text-left">Capa</th>
                        <th className="px-2 py-1 text-left">Fecha lev.</th>
                        <th className="px-2 py-1 text-left">Escala</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {disputa.evidence.features.map((f) => (
                        <tr
                          key={f.objectid}
                          className="border-t border-slate-800"
                        >
                          <td className="px-2 py-1 font-mono">{f.objectid}</td>
                          <td className="px-2 py-1 font-mono">{f.plano}</td>
                          <td className="px-2 py-1">{f.layer}</td>
                          <td className="px-2 py-1">{f.fecha_lev}</td>
                          <td className="px-2 py-1">{f.escala}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Verificar contra MapServer SEMARNAT
                  </div>
                  <ul className="space-y-1 text-sm">
                    {disputa.evidence.verify_links.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-300 underline-offset-2 hover:underline"
                        >
                          {l.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {disputa.links.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cobertura periodística
                </div>
                <ul className="space-y-1 text-sm">
                  {disputa.links.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-300 underline-offset-2 hover:underline"
                      >
                        {l.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {disputa.legal_refs && disputa.legal_refs.length > 0 && (
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <Scale className="h-3.5 w-3.5" />
                  Marco legal
                </div>
                <ul className="space-y-1 text-xs">
                  {disputa.legal_refs.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 underline-offset-2 hover:text-blue-300 hover:underline"
                      >
                        {l.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
