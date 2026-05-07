"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, HelpCircle, ListFilter, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Caso, ESTADO_LABELS, EstadoCaso } from "@/lib/casos";
import type { Candidato } from "@/lib/candidatos";

type Props = {
  casos: Caso[];
  candidatos: Candidato[];
  onCasoSelect: (c: Caso) => void;
  onCandidatoSelect: (c: Candidato) => void;
};

const ESTADO_ORDER: Record<EstadoCaso, number> = {
  en_conflicto: 0,
  suspendido: 1,
  resuelto: 2,
  archivado: 3,
};

export function CasosListButton({
  casos,
  candidatos,
  onCasoSelect,
  onCandidatoSelect,
}: Props) {
  const [open, setOpen] = useState(false);

  const sortedCasos = useMemo(() => {
    return [...casos].sort((a, b) => {
      const da = ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado];
      if (da !== 0) return da;
      const ta = Date.parse(a.ultima_actualizacion || "") || 0;
      const tb = Date.parse(b.ultima_actualizacion || "") || 0;
      return tb - ta;
    });
  }, [casos]);

  const sortedCandidatos = useMemo(() => {
    return [...candidatos].sort((a, b) => {
      if (a.severidad !== b.severidad) {
        return a.severidad === "roja" ? -1 : 1;
      }
      return b.pct_invadido - a.pct_invadido;
    });
  }, [candidatos]);

  const enConflicto = useMemo(
    () => casos.filter((c) => c.estado === "en_conflicto").length,
    [casos],
  );

  if (casos.length === 0 && candidatos.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Listar casos y candidatos automáticos"
        className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur transition hover:bg-slate-800"
      >
        <ListFilter className="h-3.5 w-3.5" />
        <span>Casos</span>
        {enConflicto > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {enConflicto}
          </span>
        )}
        {candidatos.length > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
            <HelpCircle className="h-2.5 w-2.5" />
            {candidatos.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <Card className="pointer-events-auto w-full max-w-[calc(100vw-1rem)] border-slate-700 bg-slate-950/90 text-slate-100 shadow-xl backdrop-blur sm:max-w-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Casos y candidatos
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Cerrar"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[55dvh] overflow-y-auto">
        {sortedCasos.length > 0 && (
          <section>
            <header className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Verificados
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {sortedCasos.length}
              </span>
            </header>
            <ul className="pb-1">
              {sortedCasos.map((c) => {
                const badge = ESTADO_LABELS[c.estado];
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onCasoSelect(c);
                        setOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 px-3 py-2 text-left transition hover:bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-100">
                          {c.name}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {c.ubicacion.municipio}, {c.ubicacion.estado_mx}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {sortedCandidatos.length > 0 && (
          <section className="border-t border-slate-800">
            <header className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                <HelpCircle className="h-3 w-3" />
                Sin verificar
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {sortedCandidatos.length}
              </span>
            </header>
            <p className="px-3 pb-1 text-[10px] leading-snug text-slate-500">
              Detectados automáticamente por OSM × franja federal. No son casos
              confirmados.
            </p>
            <ul className="pb-1">
              {sortedCandidatos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onCandidatoSelect(c);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 px-3 py-2 text-left transition hover:bg-slate-800/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-100">
                        {c.name ?? "(sin nombre)"}
                      </span>
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                          c.severidad === "roja"
                            ? "border-red-500/30 bg-red-500/15 text-red-300"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {c.severidad === "roja" ? "Alta" : "Media"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {c.building} · {Math.round(c.area_invadida_m2)} m²
                      invadidos ({c.pct_invadido.toFixed(0)}%)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}
