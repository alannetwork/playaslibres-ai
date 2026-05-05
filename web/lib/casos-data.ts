import fs from "node:fs";
import path from "node:path";
import type { Caso } from "./casos";

let cached: Caso[] | null = null;

export function getAllCasos(): Caso[] {
  if (cached) return cached;
  const filepath = path.join(process.cwd(), "public", "data", "casos.json");
  cached = JSON.parse(fs.readFileSync(filepath, "utf-8")) as Caso[];
  return cached;
}

export function getCasoBySlug(slug: string): Caso | null {
  return getAllCasos().find((c) => c.slug === slug) ?? null;
}
