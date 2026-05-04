import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)",
          borderRadius: 7,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
          <path
            d="M 6 22 Q 19 12 32 22 T 58 22"
            stroke="#fbbf24"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 6 44 Q 19 34 32 44 T 58 44"
            stroke="#34d399"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
