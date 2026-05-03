export type EstadoCaso =
  | "en_conflicto"
  | "suspendido"
  | "resuelto"
  | "archivado";

export type TipoFuente =
  | "prensa"
  | "oficial"
  | "redes"
  | "testimonio"
  | "foto"
  | "video"
  | "documento";

export type Fuente = {
  tipo: TipoFuente;
  titulo: string;
  url?: string;
  medio?: string;
  autoridad?: string;
  fecha: string | number;
  descripcion?: string;
};

export type ExpedienteOficial = {
  tipo:
    | "suspension_temporal"
    | "clausura"
    | "concesion"
    | "denuncia"
    | "resolucion"
    | "otro";
  autoridad: string;
  fecha: string | number;
  referencia?: string;
  descripcion?: string;
  url?: string;
};

export type MarcoLegalItem = {
  tipo: "constitucion" | "ley" | "reglamento" | "norma" | "tratado" | "otro";
  titulo: string;
  url: string;
  articulo?: string;
  descripcion?: string;
};

export type ZofematFeature = {
  objectid: number | null;
  plano: string | null;
  layer: string | null;
  fecha_lev: string | null;
  escala: string | null;
  proyeccion: string | null;
};

export type TimelineEvento = {
  fecha: string | number | null;
  tipo: string | null;
  titulo: string | null;
  descripcion?: string | null;
  url?: string | null;
  medio?: string | null;
  autoridad?: string | null;
  referencia?: string | null;
  origen: "fuente" | "expediente";
};

export type CambiosEscena = {
  id: string;
  datetime: string;
  cloud_cover: number | null;
  visual_cog: string | null;
  thumbnail: string | null;
};

export type Cambios = {
  queried_at: string;
  bbox: [number, number, number, number] | null;
  ventana?: {
    antes_dias: number;
    despues_dias: number;
    max_cloud_cover: number;
  };
  antes: CambiosEscena[];
  despues: CambiosEscena[];
  eo_browser: { antes_url: string; despues_url: string };
  nota?: string;
};

export type Caso = {
  slug: string;
  name: string;
  estado: EstadoCaso;
  coords: [number, number];
  ubicacion: {
    lat: number;
    lon: number;
    municipio: string;
    estado_mx: string;
  };
  summary: string;
  fecha_apertura: string;
  ultima_actualizacion: string;
  responsable_presunto?: { nombre: string; tipo: string } | null;
  expediente_oficial: ExpedienteOficial[];
  fuentes: Fuente[];
  marco_legal: MarcoLegalItem[];
  poligono_zofemat_objectids: number[];
  zofemat_features: ZofematFeature[];
  coords_bbox?: [number, number, number, number] | null;
  timeline: TimelineEvento[];
  cambios: Cambios | null;
  has_poligono: boolean;
  contribuyente?: string;
};

export const ESTADO_LABELS: Record<
  EstadoCaso,
  { label: string; className: string }
> = {
  en_conflicto: {
    label: "En conflicto",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  suspendido: {
    label: "Suspendido",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  resuelto: {
    label: "Resuelto",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  archivado: {
    label: "Archivado",
    className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
};

/** Marco legal general que aplica a todos los casos. Se renderiza como base
 *  en el panel; cada caso puede agregar referencias específicas via
 *  `marco_legal[]` en su frontmatter. */
export const MARCO_LEGAL_GENERAL: MarcoLegalItem[] = [
  {
    tipo: "constitucion",
    titulo: "Constitución, art. 27 — playas y ZOFEMAT son bienes nacionales",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf",
    articulo: "27",
  },
  {
    tipo: "ley",
    titulo: "Ley General de Bienes Nacionales, art. 119",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGBN.pdf",
    articulo: "119",
  },
  {
    tipo: "norma",
    titulo: "NOM-146-SEMARNAT-2017 (DOF)",
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5485172",
  },
];

export function formatFecha(fecha: string | number | null | undefined): string {
  if (fecha == null) return "";
  if (typeof fecha === "number") return String(fecha);
  return fecha;
}
