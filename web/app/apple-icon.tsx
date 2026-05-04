import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none">
          <path
            d="M 6 22 Q 19 12 32 22 T 58 22"
            stroke="#fbbf24"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 6 42 Q 19 32 32 42 T 58 42"
            stroke="#34d399"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
