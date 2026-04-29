#!/usr/bin/env python3
"""Calcula contornos de inundación para cada altura de marea desde el DEM
recortado de Bahía de Banderas, los simplifica y los exporta como GeoJSON
con propiedad `tide_m` para tippecanoe.

El offset de datum (DATUM_OFFSET_M) ajusta la diferencia entre el cero del
DEM (referido al geoide EGM2008) y el cero de marea local (NMM). Inicial 0;
ajustar tras validación visual.

Salida: data/processed/floodlines_bb.geojson

Uso:
    python scripts/06_compute_floodlines.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Iterable

import numpy as np
import rasterio
from rasterio import features
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
DEM = ROOT / "data" / "processed" / "dem_bb.tif"
OUT = ROOT / "data" / "processed" / "floodlines_bb.geojson"

TIDE_HEIGHTS_M = [-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2]
DATUM_OFFSET_M = 0.0  # ajustar si la línea de costa estimada queda offset
SIMPLIFY_TOLERANCE_DEG = 0.0001  # ~10 m
MAX_DEM_FILTER_M = 5.0  # Solo vectorizamos el área costera (DEM <= 5 m)


def floodline_features(dem: np.ndarray, transform, tide_m: float) -> Iterable[dict]:
    threshold = tide_m + DATUM_OFFSET_M
    mask = (dem <= threshold) & (dem > -200)  # filtra nodata
    if not mask.any():
        return
    shapes_iter = features.shapes(
        mask.astype(np.uint8),
        mask=mask,
        transform=transform,
    )
    polys = []
    for geom, value in shapes_iter:
        if value != 1:
            continue
        try:
            polys.append(shape(geom))
        except Exception:
            continue
    if not polys:
        return
    merged = unary_union(polys)
    geoms = merged.geoms if hasattr(merged, "geoms") else [merged]
    for g in geoms:
        outline = g.boundary
        outline = outline.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
        if outline.is_empty:
            continue
        yield {
            "type": "Feature",
            "properties": {"tide_m": round(tide_m, 1)},
            "geometry": mapping(outline),
        }


def main() -> None:
    if not DEM.exists():
        sys.exit(f"Falta {DEM}. Corre primero scripts/02_download_dem.py")

    print(f"Leyendo DEM: {DEM.relative_to(ROOT)}")
    with rasterio.open(DEM) as src:
        dem = src.read(1).astype("float32")
        transform = src.transform
        nodata = src.nodata
    if nodata is not None:
        dem[dem == nodata] = -9999

    # Filtra solo la franja costera para reducir tiempo y tamaño.
    print(f"DEM stats: min={dem.min():.2f} max={dem.max():.2f}")
    coastal_mask = dem <= MAX_DEM_FILTER_M
    print(f"Pixeles costeros (<= {MAX_DEM_FILTER_M} m): {coastal_mask.sum():,}")

    feats: list[dict] = []
    for h in TIDE_HEIGHTS_M:
        before = len(feats)
        for feat in floodline_features(dem, transform, h):
            feats.append(feat)
        added = len(feats) - before
        print(f"  tide_m={h:>5.1f}  features={added}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"type": "FeatureCollection", "features": feats}
    OUT.write_text(json.dumps(payload, ensure_ascii=False))
    print(f"\nGuardado: {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1e6:.2f} MB, n={len(feats)})")


if __name__ == "__main__":
    main()
