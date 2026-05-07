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
    default:
      "Playas Libres — ZOFEMAT y zona federal en Bahía de Banderas",
    template: "%s · Playas Libres",
  },
  description:
    "Mapa público de Bahía de Banderas con la ZOFEMAT oficial de SEMARNAT, la playa libre y detecciones automatizadas de invasión a la zona federal.",
  applicationName: "Playas Libres",
  authors: [{ name: "Playas Libres", url: SITE_URL }],
  creator: "Playas Libres",
  publisher: "Playas Libres",
  category: "Transparencia ciudadana",
  keywords: [
    "ZOFEMAT",
    "zona federal marítimo terrestre",
    "playa pública",
    "Bahía de Banderas",
    "Punta de Mita",
    "Las Cocinas",
    "Cantiles de Mita",
    "Nayarit",
    "Puerto Vallarta",
    "Jalisco",
    "Marina Vallarta",
    "Mismaloya",
    "Bucerías",
    "Nuevo Vallarta",
    "SEMARNAT",
    "DGZFMTAC",
    "Sentinel-2",
    "transparencia",
    "invasión de playa",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Playas Libres",
    url: "/",
    title: "Playas Libres — ¿Hasta dónde llega tu playa?",
    description:
      "ZOFEMAT oficial, playa libre y detecciones automatizadas de invasión en Bahía de Banderas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playas Libres — ¿Hasta dónde llega tu playa?",
    description:
      "ZOFEMAT oficial de SEMARNAT, playa libre y detecciones automatizadas de invasión en Bahía de Banderas.",
  },
};

const ldJson = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Playas Libres",
      alternateName: "¿Hasta dónde llega tu playa?",
      url: SITE_URL,
      inLanguage: "es-MX",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Playas Libres",
      url: SITE_URL,
      logo: `${SITE_URL}/icon`,
      areaServed: [
        {
          "@type": "Place",
          name: "Bahía de Banderas, Nayarit, México",
        },
        {
          "@type": "Place",
          name: "Puerto Vallarta, Jalisco, México",
        },
      ],
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
