import type { MetadataRoute } from "next";
import { getAllCasos } from "@/lib/casos-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playaslibres.ai";
  const now = new Date();
  const casos: MetadataRoute.Sitemap = getAllCasos().map((c) => ({
    url: `${base}/c/${c.slug}`,
    lastModified: c.ultima_actualizacion
      ? new Date(c.ultima_actualizacion)
      : now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/acerca`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/metodologia`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/validacion`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...casos,
  ];
}
