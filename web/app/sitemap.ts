import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playas-libres.mx";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/acerca`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/metodologia`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
