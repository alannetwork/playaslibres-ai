import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Playas Libres — ¿Hasta dónde llega tu playa?";

export default function OpengraphImage() {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            ¿Hasta dónde llega tu playa?
          </div>
          <div style={{ fontSize: 30, color: "#cbd5e1", maxWidth: 950 }}>
            ZOFEMAT oficial, playa libre y detecciones automatizadas de
            invasión en Bahía de Banderas.
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
          <div>SEMARNAT · OpenStreetMap · Detección automatizada</div>
          <div>Bahía de Banderas · 2026</div>
        </div>
      </div>
    ),
    size,
  );
}
