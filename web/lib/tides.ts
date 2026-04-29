export type TideSample = { t: string; h: number };
export type TideExtreme = TideSample & { kind: "high" | "low" };

export type TideFull = {
  location: { lat: number; lon: number; name: string };
  model: "FES2014" | "harmonic_fallback";
  year: number;
  step_minutes: number;
  stats: { max_m: number; min_m: number; mean_m: number };
  samples: TideSample[];
};

export type TideExtremes = Omit<TideFull, "samples" | "step_minutes"> & {
  extremes: TideExtreme[];
};

let _full: Promise<TideFull> | null = null;
let _ext: Promise<TideExtremes> | null = null;

export function loadTidesFull(): Promise<TideFull> {
  if (!_full) {
    _full = fetch("/data/tides_punta_mita_2025_full.json").then((r) => {
      if (!r.ok) throw new Error("Falló la carga de mareas (full)");
      return r.json();
    });
  }
  return _full;
}

export function loadTidesExtremes(): Promise<TideExtremes> {
  if (!_ext) {
    _ext = fetch("/data/tides_punta_mita_2025_extremes.json").then((r) => {
      if (!r.ok) throw new Error("Falló la carga de mareas (extremes)");
      return r.json();
    });
  }
  return _ext;
}

/** Devuelve la altura interpolada en `samples` para el timestamp dado (ms). */
export function heightAt(samples: TideSample[], tMs: number): number {
  if (samples.length === 0) return 0;
  // Búsqueda binaria del índice más cercano por la izquierda.
  let lo = 0;
  let hi = samples.length - 1;
  const ts = (s: TideSample) => Date.parse(s.t);
  if (tMs <= ts(samples[0])) return samples[0].h;
  if (tMs >= ts(samples[hi])) return samples[hi].h;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (ts(samples[mid]) <= tMs) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const ta = ts(a);
  const tb = ts(b);
  const f = (tMs - ta) / (tb - ta);
  return a.h + (b.h - a.h) * f;
}

/** Redondea al múltiplo más cercano de step (m). */
export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Devuelve la fase ("subiendo"/"bajando") comparando con el sample anterior. */
export function tidePhase(
  samples: TideSample[],
  tMs: number,
): "subiendo" | "bajando" | "estable" {
  if (samples.length < 2) return "estable";
  const h0 = heightAt(samples, tMs - 30 * 60 * 1000);
  const h1 = heightAt(samples, tMs);
  if (h1 - h0 > 0.005) return "subiendo";
  if (h1 - h0 < -0.005) return "bajando";
  return "estable";
}

/** Top N pleamares (máximos locales) ordenados por altura descendente. */
export function topHighTides(
  extremes: TideExtreme[],
  n: number,
): TideExtreme[] {
  return extremes
    .filter((e) => e.kind === "high")
    .slice()
    .sort((a, b) => b.h - a.h)
    .slice(0, n);
}
