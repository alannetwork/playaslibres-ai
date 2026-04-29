import { ImageResponse } from "next/og";

export const runtime = "edge";
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#34d399",
            }}
          />
          <div style={{ fontSize: 26, opacity: 0.9 }}>Playas Libres</div>
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
            Mapa público de Bahía de Banderas: pleamar estimada vs ZOFEMAT
            oficial.
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
          <div>Sentinel-2 · Copernicus DEM · FES2014 · SEMARNAT</div>
          <div>Punta de Mita, Nayarit · 2026</div>
        </div>
      </div>
    ),
    size,
  );
}
