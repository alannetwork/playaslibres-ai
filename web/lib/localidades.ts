import localidadesJson from "@data/localidades.json";

// Antes era un union cerrado de los 3 slugs de Bahía de Banderas. Al escalar a
// nivel nacional el conjunto de localidades es abierto (se deriva de los datos),
// así que el slug pasa a ser un string genérico. Las localidades CURADAS siguen
// viviendo en data/localidades.json; el catálogo nacional está en
// lib/localidades-mx.ts (data/localidades_mx.json).
export type LocalidadSlug = string;

export type TrazadoSemarnat = {
  fecha: string;
  plano: string;
  fuente_capa: number;
};

export type Localidad = {
  slug: LocalidadSlug;
  name: string;
  municipio: string;
  estado_mx: string;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number];
  trazado_semarnat: TrazadoSemarnat;
};

export const LOCALIDADES = localidadesJson as Localidad[];

export const LOCALIDAD_BY_SLUG: Record<string, Localidad> = Object.fromEntries(
  LOCALIDADES.map((l) => [l.slug, l]),
);

export const DEFAULT_LOCALIDAD: Localidad = LOCALIDADES[0];

export function localidadFromCoords(
  lng: number,
  lat: number,
): Localidad | null {
  for (const loc of LOCALIDADES) {
    const [w, s, e, n] = loc.bbox;
    if (lng >= w && lng <= e && lat >= s && lat <= n) return loc;
  }
  return null;
}
