// Catálogo NACIONAL de localidades para la navegación del frontend.
// Generado por scripts/14_build_localidades_nacional.py a partir de los
// atributos de la ZOFEMAT nacional. NO confundir con data/localidades.json
// (las 3 localidades curadas de Bahía de Banderas que consume el pipeline).
import catalogJson from "@data/localidades_mx.json";

export type LocalidadMx = {
  slug: string;
  estado: string;
  municipio: string;
  name: string;
  center: [number, number];
  bbox: [number, number, number, number];
  zoom: number;
  /** Años de consolidado nacional (2019-2023); alimentan el YearSelector. */
  anios: number[];
  /** Años de planos históricos (1982-2022); sólo informativos. */
  anios_hist: number[];
  feature_count: number;
  feature_count_hist: number;
  curada: boolean;
};

export const LOCALIDADES_MX = catalogJson as LocalidadMx[];

export const LOCALIDAD_MX_BY_SLUG: Record<string, LocalidadMx> =
  Object.fromEntries(LOCALIDADES_MX.map((l) => [l.slug, l]));

/** Municipios agrupados por estado, para la navegación jerárquica. */
export const LOCALIDADES_MX_BY_ESTADO: Record<string, LocalidadMx[]> =
  LOCALIDADES_MX.reduce<Record<string, LocalidadMx[]>>((acc, loc) => {
    (acc[loc.estado] ??= []).push(loc);
    return acc;
  }, {});

export const ESTADOS_MX: string[] = Object.keys(LOCALIDADES_MX_BY_ESTADO).sort();

/** Años de delimitación disponibles a nivel nacional (desc: más reciente primero). */
export const ANIOS_ZOFEMAT: number[] = Array.from(
  new Set(LOCALIDADES_MX.flatMap((l) => l.anios)),
).sort((a, b) => b - a);
