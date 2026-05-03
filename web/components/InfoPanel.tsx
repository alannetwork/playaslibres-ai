"use client";

import {
  Building2,
  Camera,
  ExternalLink,
  FileText,
  MapPin,
  Newspaper,
  Satellite,
  Scale,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Caso,
  type Fuente,
  type TimelineEvento,
  ESTADO_LABELS,
  MARCO_LEGAL_GENERAL,
  formatFecha,
} from "@/lib/casos";

const FUENTE_GRUPOS: { key: Fuente["tipo"][]; titulo: string; icon: typeof Newspaper }[] = [
  { key: ["oficial"], titulo: "Fuentes oficiales", icon: FileText },
  { key: ["prensa"], titulo: "Cobertura periodística", icon: Newspaper },
  {
    key: ["redes", "testimonio", "foto", "video", "documento"],
    titulo: "Otras fuentes",
    icon: Camera,
  },
];

function fuenteLabel(f: Fuente): string {
  if (f.medio) return f.medio;
  if (f.autoridad) return f.autoridad;
  return f.titulo;
}

function TimelineDot({ origen }: { origen: TimelineEvento["origen"] }) {
  const cls =
    origen === "expediente"
      ? "bg-emerald-400 ring-emerald-400/30"
      : "bg-blue-400 ring-blue-400/30";
  return (
    <span
      className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${cls}`}
    />
  );
}

export function InfoPanel({
  caso,
  onClose,
}: {
  caso: Caso | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!caso} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
        {caso && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    ESTADO_LABELS[caso.estado].className
                  }`}
                >
                  {ESTADO_LABELS[caso.estado].label}
                </span>
                {caso.responsable_presunto && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    <Building2 className="h-3 w-3" />
                    {caso.responsable_presunto.nombre}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl">{caso.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {caso.ubicacion.municipio}, {caso.ubicacion.estado_mx}
                </span>
                <span className="font-mono">
                  {caso.coords[1].toFixed(4)}°N, {(-caso.coords[0]).toFixed(4)}°O
                </span>
                <span>Apertura: {formatFecha(caso.fecha_apertura)}</span>
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm leading-relaxed text-slate-300">
              {caso.summary}
            </p>

            {caso.zofemat_features.length > 0 && (
              <div className="rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-200">
                  <FileText className="h-4 w-4" />
                  Polígonos ZOFEMAT vinculados (catastro SEMARNAT)
                </div>
                <p className="mb-3 text-sm text-slate-200">
                  El catastro oficial publicado por la DGZFMTAC documenta los
                  siguientes polígonos en este punto. Verificá cada OBJECTID
                  contra el MapServer de SEMARNAT.
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
                      {caso.zofemat_features.map((f, i) => (
                        <tr
                          key={f.objectid ?? i}
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
              </div>
            )}

            {caso.expediente_oficial.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Expediente oficial
                </div>
                <ul className="space-y-1.5 text-sm">
                  {caso.expediente_oficial.map((e, i) => (
                    <li
                      key={i}
                      className="rounded border border-slate-800 bg-slate-900/40 p-2"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-emerald-200">
                          {e.tipo.replace("_", " ")}
                        </span>
                        <span className="text-xs text-slate-400">
                          · {e.autoridad} · {formatFecha(e.fecha)}
                        </span>
                        {e.referencia && (
                          <span className="font-mono text-xs text-slate-300">
                            {e.referencia}
                          </span>
                        )}
                      </div>
                      {e.descripcion && (
                        <p className="mt-1 text-xs text-slate-300">
                          {e.descripcion}
                        </p>
                      )}
                      {e.url && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-300 underline-offset-2 hover:underline"
                        >
                          Ver expediente
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {caso.timeline.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cronología (multi-fuente)
                </div>
                <ol className="space-y-2 border-l border-slate-800 pl-4 text-sm">
                  {caso.timeline.map((ev, i) => (
                    <li key={i} className="flex gap-2.5">
                      <TimelineDot origen={ev.origen} />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
                          <span className="font-mono text-slate-300">
                            {formatFecha(ev.fecha)}
                          </span>
                          <span>·</span>
                          <span>
                            {ev.medio || ev.autoridad || ev.tipo || "—"}
                          </span>
                        </div>
                        <div className="text-sm text-slate-200">
                          {ev.url ? (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 underline-offset-2 hover:underline"
                            >
                              {ev.titulo}
                            </a>
                          ) : (
                            ev.titulo
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {FUENTE_GRUPOS.map((g) => {
              const items = caso.fuentes.filter((f) => g.key.includes(f.tipo));
              if (items.length === 0) return null;
              const Icon = g.icon;
              return (
                <div key={g.titulo} className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    {g.titulo}
                  </div>
                  <ul className="space-y-1 text-sm">
                    {items.map((f, i) => (
                      <li key={i}>
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-300 underline-offset-2 hover:underline"
                          >
                            {f.titulo}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{f.titulo}</span>
                        )}
                        <span className="ml-1 text-xs text-slate-500">
                          · {fuenteLabel(f)} · {formatFecha(f.fecha)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {caso.cambios && (
              <div className="space-y-1 rounded-md border border-blue-700/40 bg-blue-950/20 p-3">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-blue-200">
                  <Satellite className="h-4 w-4" />
                  Cambios satelitales (Sentinel-2)
                </div>
                {caso.cambios.nota && (
                  <p className="text-xs text-slate-400">{caso.cambios.nota}</p>
                )}
                <p className="text-xs text-slate-300">
                  Inspección visual antes/después del periodo del caso. Datos
                  abiertos vía Copernicus / AWS Open Data.
                </p>
                {(caso.cambios.antes.length > 0 ||
                  caso.cambios.despues.length > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {(["antes", "despues"] as const).map((bucket) => {
                      const escenas = caso.cambios![bucket];
                      return (
                        <div
                          key={bucket}
                          className="rounded border border-slate-700 bg-slate-900/40 p-2"
                        >
                          <div className="mb-1 font-semibold text-slate-200">
                            {bucket === "antes" ? "Antes" : "Después"}
                            <span className="ml-1 text-slate-500">
                              ({escenas.length})
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {escenas.length === 0 && (
                              <li className="text-slate-500">
                                Sin escenas en ventana.
                              </li>
                            )}
                            {escenas.map((s) => (
                              <li key={s.id}>
                                <a
                                  href={s.thumbnail || s.visual_cog || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-blue-300 hover:underline"
                                >
                                  {s.datetime?.slice(0, 10)}
                                </a>
                                {typeof s.cloud_cover === "number" && (
                                  <span className="ml-1 text-slate-500">
                                    · {s.cloud_cover.toFixed(0)}% nubes
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <a
                    href={caso.cambios.eo_browser.antes_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-blue-500/40 px-2 py-0.5 text-blue-200 hover:bg-blue-900/30"
                  >
                    Abrir EO-Browser (antes)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={caso.cambios.eo_browser.despues_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-blue-500/40 px-2 py-0.5 text-blue-200 hover:bg-blue-900/30"
                  >
                    Abrir EO-Browser (después)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            <div className="space-y-1 border-t border-slate-800 pt-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Scale className="h-3.5 w-3.5" />
                Marco legal
              </div>
              <ul className="space-y-1 text-xs">
                {[...MARCO_LEGAL_GENERAL, ...caso.marco_legal].map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-400 underline-offset-2 hover:text-blue-300 hover:underline"
                    >
                      {l.titulo}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {caso.contribuyente && (
              <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-500">
                Aporte de{" "}
                <span className="font-mono text-slate-400">
                  {caso.contribuyente}
                </span>{" "}
                · Última actualización: {formatFecha(caso.ultima_actualizacion)}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
