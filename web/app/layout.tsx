import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { CloudflareAnalytics } from "@/components/CloudflareAnalytics";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://playaslibres.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Playas Libres — ¿Hasta dónde llega tu playa?",
    template: "%s · Playas Libres",
  },
  description:
    "Mapa público de Bahía de Banderas que compara la pleamar estimada (Sentinel-2 + DEM + FES2014) contra la ZOFEMAT oficial publicada por SEMARNAT. Herramienta de transparencia ciudadana, no plano legal.",
  keywords: [
    "ZOFEMAT",
    "playa pública",
    "Bahía de Banderas",
    "Punta de Mita",
    "Las Cocinas",
    "Cantiles de Mita",
    "SEMARNAT",
    "Sentinel-2",
    "marea",
    "transparencia",
  ],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Playas Libres",
    title: "Playas Libres — ¿Hasta dónde llega tu playa?",
    description:
      "Compara la línea estimada de pleamar contra la ZOFEMAT oficial en Bahía de Banderas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playas Libres",
    description:
      "Mapa público de Bahía de Banderas: pleamar estimada vs ZOFEMAT oficial.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c4a6e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX">
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
