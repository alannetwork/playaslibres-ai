import type { LocalidadSlug } from "./localidades";

export type Candidato = {
  id: string;
  osm_id: string;
  name: string | null;
  coords: [number, number];
  severidad: "roja" | "ambar";
  building: string;
  area_total_m2: number;
  area_invadida_m2: number;
  pct_invadido: number;
  source?: "osm" | "manual";
  localidad?: LocalidadSlug | null;
};
