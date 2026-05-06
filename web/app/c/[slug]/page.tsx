import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllCasos, getCasoBySlug } from "@/lib/casos-data";
import { ESTADO_LABELS } from "@/lib/casos";

const Map = dynamic(() => import("@/components/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
      Cargando mapa…
    </div>
  ),
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://playaslibres.ai";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCasos().map((c) => ({ slug: c.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const caso = getCasoBySlug(params.slug);
  if (!caso) return {};
  const estado = ESTADO_LABELS[caso.estado].label;
  const title = `${caso.name} — ${estado}`;
  const description = caso.summary;
  const path = `/c/${caso.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "es_MX",
      siteName: "Playas Libres",
      title,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function CasoPage({ params }: { params: { slug: string } }) {
  const caso = getCasoBySlug(params.slug);
  if (!caso) notFound();
  const path = `/c/${caso.slug}`;
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: `${caso.name} — ${ESTADO_LABELS[caso.estado].label}`,
    description: caso.summary,
    inLanguage: "es-MX",
    datePublished: caso.fecha_apertura,
    dateModified: caso.ultima_actualizacion,
    url: `${SITE_URL}${path}`,
    mainEntityOfPage: `${SITE_URL}${path}`,
    image: [`${SITE_URL}${path}/opengraph-image`],
    author: { "@type": "Organization", name: "Playas Libres", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Playas Libres",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon` },
    },
    articleSection: "Transparencia ciudadana",
    contentLocation: {
      "@type": "Place",
      name: caso.name,
      geo: {
        "@type": "GeoCoordinates",
        latitude: caso.coords[1],
        longitude: caso.coords[0],
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: caso.ubicacion.municipio,
        addressRegion: caso.ubicacion.estado_mx,
        addressCountry: "MX",
      },
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <Map focusSlug={params.slug} />
    </>
  );
}
