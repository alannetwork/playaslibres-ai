import { ImageResponse } from "next/og";
import { getCasoBySlug } from "@/lib/casos-data";
import { ESTADO_LABELS } from "@/lib/casos";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Playas Libres — caso documentado en Bahía de Banderas";

const ESTADO_COLORS: Record<string, { bg: string; fg: string }> = {
  en_conflicto: { bg: "#dc2626", fg: "#fef2f2" },
  suspendido: { bg: "#f59e0b", fg: "#0c0a09" },
  resuelto: { bg: "#10b981", fg: "#022c22" },
  archivado: { bg: "#64748b", fg: "#f8fafc" },
};

export default function CasoOgImage({
  params,
}: {
  params: { slug: string };
}) {
  const caso = getCasoBySlug(params.slug);
  if (!caso) {
    return new ImageResponse(<div>Not found</div>, size);
  }
  const estado = ESTADO_LABELS[caso.estado];
  const colors = ESTADO_COLORS[caso.estado] ?? ESTADO_COLORS.archivado;
  const lat = caso.coords[1].toFixed(4);
  const lon = (-caso.coords[0]).toFixed(4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "linear-gradient(135deg, #0c4a6e 0%, #082f49 50%, #020617 100%)",
          color: "white",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                <path
                  d="M 6 22 Q 19 12 32 22 T 58 22"
                  stroke="#fbbf24"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M 6 42 Q 19 32 32 42 T 58 42"
                  stroke="#34d399"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 30, opacity: 0.9 }}>Playas Libres</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 9999,
              background: colors.bg,
              color: colors.fg,
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {estado.label}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {caso.name}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#cbd5e1",
              maxWidth: 1050,
              lineHeight: 1.35,
            }}
          >
            {caso.summary.length > 220
              ? caso.summary.slice(0, 217) + "…"
              : caso.summary}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 20,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div>{`${caso.ubicacion.municipio}, ${caso.ubicacion.estado_mx}`}</div>
            <div style={{ fontFamily: "monospace", color: "#64748b" }}>
              {`${lat}°N · ${lon}°O`}
            </div>
          </div>
          <div style={{ color: "#64748b" }}>{`playaslibres.ai/c/${caso.slug}`}</div>
        </div>
      </div>
    ),
    size,
  );
}
