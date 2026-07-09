// Cache-bust para los PMTiles. Bumpea esta versión cuando regeneres los
// PMTiles con un cambio sustantivo de datos (ej. cambio de plano SEMARNAT,
// nuevo sublayer, regeneración de playa libre con bbox ampliado). El
// cliente pmtiles-js cachea el archivo en memoria por URL, así que cambiar
// el query string fuerza una nueva descarga sin tener que pedir a los
// usuarios que limpien cache.
export const TILES_VERSION = "2026-07-09-historicas";

export function tileUrl(name: string): string {
  return `pmtiles:///tiles/${name}?v=${TILES_VERSION}`;
}
