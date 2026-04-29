#!/usr/bin/env python3
"""Audit científico de la data ZOFEMAT y de la pleamar estimada.

Verifica:
1. Regla legal 20 m: distancia perpendicular media entre PLEAMAR MAXIMA y
   ZONA FEDERAL (debe ser ≈20 m según LGBN).
2. Distribución de fechas, escalas y PROYECCIONes en la capa SEMARNAT.
3. Comparación entre nuestra pleamar máxima estimada (DEM, tide_m=1.2) y
   la PLEAMAR MAXIMA oficial: distancia mediana, p95, máxima.
4. Estadística del DEM costero (rango -5 m a +5 m) y posibles outliers.

Salida:
    web/public/data/validation_report.json      (consumible por la web)
    stdout: reporte legible

Uso:
    python scripts/07_validate.py
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
ZOFEMAT = ROOT / "data" / "processed" / "zofemat_bb.geojson"
FLOODLINES = ROOT / "data" / "processed" / "floodlines_bb.geojson"
DEM = ROOT / "data" / "processed" / "dem_bb.tif"
OUT = ROOT / "web" / "public" / "data" / "validation_report.json"

# UTM 13N WGS84 — la PROYECCION del catastro SEMARNAT es ITRF2008 Z13;
# WGS84 UTM 13N es prácticamente idéntico (cm-level dentro de México).
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True)


def project_to_utm(geom):
    """Reproyecta una geometría LineString/MultiLineString a UTM 13N."""
    if isinstance(geom, LineString):
        coords = [TO_UTM.transform(x, y) for x, y in geom.coords]
        return LineString(coords)
    if isinstance(geom, MultiLineString):
        return MultiLineString([
            LineString([TO_UTM.transform(x, y) for x, y in g.coords])
            for g in geom.geoms
        ])
    raise ValueError(f"geom type {type(geom)} no soportado")


def load_zofemat_layers() -> dict[str, list]:
    fc = json.load(open(ZOFEMAT))
    by_layer: dict[str, list] = {}
    for f in fc["features"]:
        layer = f["properties"].get("Layer", "?")
        by_layer.setdefault(layer, []).append(f)
    return by_layer


def sample_distances(line_a_utm, line_b_utm, n_samples: int = 200) -> list[float]:
    """Para n_samples puntos sobre `line_a`, devuelve la distancia al línea
    `line_b` (ambas en metros UTM)."""
    if line_a_utm.length == 0:
        return []
    distances = []
    for i in range(n_samples):
        frac = i / (n_samples - 1) if n_samples > 1 else 0.5
        pt = line_a_utm.interpolate(frac, normalized=True)
        d = line_b_utm.distance(pt)
        distances.append(d)
    return distances


def percentiles(arr: list[float]) -> dict:
    if not arr:
        return {"n": 0}
    a = np.array(arr)
    return {
        "n": len(arr),
        "min": float(a.min()),
        "p05": float(np.percentile(a, 5)),
        "p25": float(np.percentile(a, 25)),
        "median": float(np.percentile(a, 50)),
        "p75": float(np.percentile(a, 75)),
        "p95": float(np.percentile(a, 95)),
        "max": float(a.max()),
        "mean": float(a.mean()),
        "std": float(a.std()),
    }


def main():
    print("=" * 72)
    print("AUDIT CIENTÍFICO DE DATOS — Playas Libres")
    print("=" * 72)
    by_layer = load_zofemat_layers()

    # ---------------------------------------------------------------- #
    # 1. Metadata SEMARNAT
    # ---------------------------------------------------------------- #
    print("\n[1] METADATA SEMARNAT")
    print("-" * 72)
    fc = json.load(open(ZOFEMAT))
    feats = fc["features"]
    fechas = sorted({str(f["properties"].get("FECHA_LEV", "?")) for f in feats})
    escalas = sorted({str(f["properties"].get("ESCALA", "?")) for f in feats})
    proyecciones = sorted({str(f["properties"].get("PROYECCION", "?")) for f in feats})
    planos = {f["properties"].get("PLANO", "?") for f in feats}

    print(f"Total features        : {len(feats)}")
    print(f"FECHA_LEV (años)      : {', '.join(fechas)}")
    print(f"ESCALA del plano      : {', '.join(escalas)}")
    print(f"PROYECCION            : {', '.join(proyecciones)}")
    print(f"# planos topográficos : {len(planos)}")
    print()
    for layer, lst in sorted(by_layer.items(), key=lambda kv: -len(kv[1])):
        print(f"  {layer:24s} {len(lst)} features")

    # ---------------------------------------------------------------- #
    # 2. Test legal: distancia PLEAMAR MAXIMA → ZONA FEDERAL ≈ 20 m
    # ---------------------------------------------------------------- #
    print("\n[2] TEST LEGAL: distancia perpendicular PLEAMAR MAXIMA → ZONA FEDERAL")
    print("    (LGBN art. 119 fr. I: ZOFEMAT = 20 m tierra adentro de pleamar)")
    print("-" * 72)

    pm_lines = [
        project_to_utm(shape(f["geometry"]))
        for f in by_layer.get("PLEAMAR MAXIMA", [])
        if shape(f["geometry"]).length > 0
    ]
    zf_lines = [
        project_to_utm(shape(f["geometry"]))
        for f in by_layer.get("ZONA FEDERAL", [])
        if shape(f["geometry"]).length > 0
    ]
    print(f"PLEAMAR MAXIMA: {len(pm_lines)} features con geometría no-vacía")
    print(f"ZONA FEDERAL  : {len(zf_lines)} features con geometría no-vacía")

    if pm_lines and zf_lines:
        zf_union = unary_union(zf_lines)
        all_distances: list[float] = []
        for pm in pm_lines:
            if pm.length < 5.0:  # ignorar segmentos minúsculos
                continue
            n = max(5, int(pm.length / 5.0))  # 1 muestra cada ~5 m
            all_distances.extend(sample_distances(pm, zf_union, n_samples=n))
        stats_20m = percentiles(all_distances)
        within_15_25 = sum(1 for d in all_distances if 15 <= d <= 25) / len(all_distances)
        within_10_30 = sum(1 for d in all_distances if 10 <= d <= 30) / len(all_distances)
        print(f"\n  N puntos muestreados : {stats_20m['n']:,}")
        print(f"  distancia mediana    : {stats_20m['median']:6.2f} m   (esperado: ≈20 m)")
        print(f"  media ± std          : {stats_20m['mean']:6.2f} ± {stats_20m['std']:.2f} m")
        print(f"  p05 / p95            : {stats_20m['p05']:6.2f} / {stats_20m['p95']:.2f} m")
        print(f"  min / max            : {stats_20m['min']:6.2f} / {stats_20m['max']:.2f} m")
        print(f"  % puntos en 15-25 m  : {within_15_25*100:5.1f}%")
        print(f"  % puntos en 10-30 m  : {within_10_30*100:5.1f}%")
    else:
        stats_20m = None

    # ---------------------------------------------------------------- #
    # 3. Comparación: nuestra pleamar estimada vs PLEAMAR MAXIMA oficial
    # ---------------------------------------------------------------- #
    print("\n[3] COMPARACIÓN: pleamar estimada (DEM+marea) vs PLEAMAR MAXIMA oficial")
    print("    (cuanto menor la distancia, mejor nuestra estimación)")
    print("-" * 72)
    fl = json.load(open(FLOODLINES))
    fl_max = [
        project_to_utm(shape(f["geometry"]))
        for f in fl["features"]
        if f["properties"].get("tide_m") == 1.2
        and shape(f["geometry"]).length > 0
    ]
    print(f"Features pleamar estimada (tide_m=1.2): {len(fl_max)}")

    if pm_lines and fl_max:
        fl_union = unary_union(fl_max)
        comp_distances: list[float] = []
        for pm in pm_lines:
            if pm.length < 5.0:
                continue
            n = max(5, int(pm.length / 10.0))
            comp_distances.extend(sample_distances(pm, fl_union, n_samples=n))
        stats_comp = percentiles(comp_distances)
        within_30 = sum(1 for d in comp_distances if d <= 30) / len(comp_distances)
        within_50 = sum(1 for d in comp_distances if d <= 50) / len(comp_distances)
        within_100 = sum(1 for d in comp_distances if d <= 100) / len(comp_distances)
        print(f"\n  N puntos             : {stats_comp['n']:,}")
        print(f"  distancia mediana    : {stats_comp['median']:7.2f} m")
        print(f"  media ± std          : {stats_comp['mean']:7.2f} ± {stats_comp['std']:.2f} m")
        print(f"  p05 / p95            : {stats_comp['p05']:7.2f} / {stats_comp['p95']:.2f} m")
        print(f"  máximo               : {stats_comp['max']:7.2f} m")
        print(f"  % a ≤ 30 m de oficial: {within_30*100:5.1f}%")
        print(f"  % a ≤ 50 m de oficial: {within_50*100:5.1f}%")
        print(f"  % a ≤ 100 m oficial  : {within_100*100:5.1f}%")
        print()
        print("  → Brief original prometía incertidumbre ±10–30 m. Confronta con p95.")
    else:
        stats_comp = None

    # ---------------------------------------------------------------- #
    # 4. DEM: estadística costera y posibles outliers
    # ---------------------------------------------------------------- #
    print("\n[4] DEM Copernicus 30 m — estadística costera")
    print("-" * 72)
    with rasterio.open(DEM) as src:
        dem = src.read(1).astype("float32")
        nodata = src.nodata
    if nodata is not None:
        dem[dem == nodata] = np.nan
    finite = dem[np.isfinite(dem)]
    coastal = finite[(finite >= -2) & (finite <= 5)]
    negative = finite[finite < 0]
    very_high_at_coast = (coastal[coastal > 1.2]).size  # > pleamar máxima esperada
    dem_stats = {
        "min": float(finite.min()),
        "max": float(finite.max()),
        "mean": float(finite.mean()),
        "px_total": int(finite.size),
        "px_coastal_le_5m": int(coastal.size),
        "px_negative": int(negative.size),
        "px_coastal_above_1_2m": int(very_high_at_coast),
    }
    print(f"  rango global  : {dem_stats['min']:.2f} a {dem_stats['max']:.2f} m")
    print(f"  pixeles tot.  : {dem_stats['px_total']:,}")
    print(f"  costeros ≤ 5m : {dem_stats['px_coastal_le_5m']:,}")
    print(f"  con valor neg.: {dem_stats['px_negative']:,}  (esperable bajo agua)")
    print(f"  costeros > 1.2 m (> pleamar max): {dem_stats['px_coastal_above_1_2m']:,}")
    print()
    print("  Nota: Copernicus DEM mide la SUPERFICIE (DSM), no el suelo desnudo.")
    print("        Vegetación, edificios y muelles inflan la elevación. Por eso")
    print("        nuestra línea estimada puede caer hacia el mar de la real.")

    # ---------------------------------------------------------------- #
    # 5. Sumario de incertidumbres
    # ---------------------------------------------------------------- #
    print("\n[5] INCERTIDUMBRE POR COMPONENTE (estimación experta)")
    print("-" * 72)
    components = [
        ("ZOFEMAT SEMARNAT (PLEAMAR/ZF)", "1-3 m horizontal", "Plano 1:1000 ITRF2008, FECHA_LEV 2021"),
        ("Copernicus DEM 30 m (DSM)",     "±2-4 m vertical, 30 m horizontal", "Mide superficie, no suelo"),
        ("FES2014 (no usado)",            "±10-20 cm",                       "Falta credenciales AVISO+"),
        ("Fallback armónico (en uso)",    "±20-50 cm",                       "Constantes hardcoded sin calibrar"),
        ("Datum offset DEM↔NMM",          "±50-100 cm",                      "DATUM_OFFSET_M=0 sin calibrar"),
        ("Línea ciudadana combinada",     "±20-50 m horizontal",             "Acumulación de las anteriores"),
    ]
    for name, sigma, note in components:
        print(f"  {name:35s} {sigma:25s} {note}")

    # ---------------------------------------------------------------- #
    # 6. Persistir reporte para la web
    # ---------------------------------------------------------------- #
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "n_features": len(feats),
            "fechas_lev": fechas,
            "escalas": escalas,
            "proyecciones": proyecciones,
            "n_planos": len(planos),
            "by_layer": {k: len(v) for k, v in by_layer.items()},
        },
        "test_legal_20m": stats_20m,
        "ciudadana_vs_oficial": stats_comp,
        "dem_stats": dem_stats,
        "uncertainty_notes": [
            {"component": n, "sigma": s, "note": note}
            for n, s, note in components
        ],
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\n→ Reporte JSON: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
