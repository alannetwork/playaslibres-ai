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
  return <Map focusSlug={params.slug} />;
}
