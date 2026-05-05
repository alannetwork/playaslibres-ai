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
    "Mapa público de Bahía de Banderas con la ZOFEMAT oficial publicada por SEMARNAT, la franja de playa libre de uso público y la detección automatizada de construcciones que invaden la zona federal. Herramienta de transparencia ciudadana, no plano legal.",
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
      "ZOFEMAT oficial, playa libre y detecciones automatizadas de invasión en Bahía de Banderas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playas Libres",
    description:
      "Mapa público de la zona federal en Bahía de Banderas con detecciones de posibles invasiones.",
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
