"use client";

/**
 * Leyenda compacta siempre visible sobre el mapa (fuera del panel Capas).
 * Resuelve la confusión de "cuál línea es cuál" en zooms de detalle, donde
 * conviven pleamar (celeste), zona federal (rojo), la franja derivada (verde)
 * y los planos históricos (teal punteado). Se muestra sólo con la capa
 * ZOFEMAT activa y a partir de zoom 10 (antes las líneas casi no se
 * distinguen y la leyenda sería ruido).
 */

const ITEMS: {
  label: string;
  title: string;
  swatch: { color: string; dashed?: boolean; fill?: boolean };
}[] = [
  {
    label: "Pleamar",
    title: "Pleamar máxima oficial (SEMARNAT)",
    swatch: { color: "#0ea5e9" },
  },
  {
    label: "Zona federal",
    title: "Borde interno de la franja federal (20 m tierra adentro)",
    swatch: { color: "#dc2626" },
  },
  {
    label: "Franja federal",
    title:
      "Banda entre la pleamar y la zona federal, derivada de las líneas oficiales",
    swatch: { color: "#22c55e", fill: true },
  },
  {
    label: "Histórico",
    title: "Planos históricos SEMARNAT (1982-2022); más tenue = más antiguo",
    swatch: { color: "#0d9488", dashed: true },
  },
];

export function MapLegend() {
  return (
    <div className="pointer-events-auto inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-[10px] font-medium text-slate-200 shadow-lg backdrop-blur sm:text-[11px]">
      {ITEMS.map((it) => (
        <span
          key={it.label}
          title={it.title}
          className="inline-flex items-center gap-1.5"
        >
          {it.swatch.fill ? (
            <span
              aria-hidden
              className="inline-block h-2.5 w-3.5 rounded-[2px]"
              style={{
                background: it.swatch.color,
                opacity: 0.5,
                border: `1px solid ${it.swatch.color}`,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="inline-block w-3.5"
              style={{
                borderTop: `2.5px ${it.swatch.dashed ? "dashed" : "solid"} ${it.swatch.color}`,
              }}
            />
          )}
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}
