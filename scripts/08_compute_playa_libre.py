#!/usr/bin/env python3
"""Genera el polígono "Playa Libre" entre PLEAMAR MAXIMA y ZONA FEDERAL.

La ZOFEMAT (Ley General de Bienes Nacionales art. 119 fr. I) es la franja
de 20 m tierra adentro de la pleamar máxima — y es de uso público. Para
visualizarla como polígono, tomamos la unión de las dos líneas oficiales
SEMARNAT (PLEAMAR MAXIMA y ZONA FEDERAL), las buffereamos cada una 12 m
en UTM 13N, y nos quedamos con la intersección de ambos buffers: eso es
la franja entre ellas, que aproxima la ZOFEMAT pública.

Salidas:
    data/processed/playa_libre_bb.geojson  (FeatureCollection de polígonos)
    web/public/tiles/playa_libre_bb.pmtiles  (vía tippecanoe)
    web/public/tiles/zofemat_bb.pmtiles      (rebuild con nuevos atributos)

Uso:
    python scripts/08_compute_playa_libre.py
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
ZOFEMAT = ROOT / "data" / "processed" / "zofemat_bb.geojson"
OUT = ROOT / "data" / "processed" / "playa_libre_bb.geojson"
PMTILES = ROOT / "data" / "tiles" / "playa_libre_bb.pmtiles"
WEB_PMTILES = ROOT / "web" / "public" / "tiles" / "playa_libre_bb.pmtiles"

# Buffer en metros aplicado a cada línea. La intersección de los dos
# buffers (cada uno de 12 m) cubre franjas con separación ≤ 24 m, que
# capturan la mayoría de los 80% de tramos consistentes con la regla
# legal de 20 m.
BUFFER_M = 12.0

TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True)
TO_WGS = Transformer.from_crs("EPSG:32613", "EPSG:4326", always_xy=True)


def reproject(geom, transformer):
    if isinstance(geom, LineString):
        return LineString([transformer.transform(x, y) for x, y in geom.coords])
    if isinstance(geom, MultiLineString):
        return MultiLineString(
            [
                LineString([transformer.transform(x, y) for x, y in g.coords])
                for g in geom.geoms
            ]
        )
    # Polígonos
    if hasattr(geom, "exterior"):
        from shapely.geometry import Polygon

        ext = [transformer.transform(x, y) for x, y in geom.exterior.coords]
        ints = [
            [transformer.transform(x, y) for x, y in r.coords]
            for r in geom.interiors
        ]
        return Polygon(ext, ints)
    if hasattr(geom, "geoms"):
        from shapely.geometry import MultiPolygon

        return MultiPolygon([reproject(p, transformer) for p in geom.geoms])
    raise ValueError(f"geom no soportado: {type(geom)}")


def main():
    fc = json.load(open(ZOFEMAT))
    pm = []  # PLEAMAR MAXIMA
    zf = []  # ZONA FEDERAL
    for f in fc["features"]:
        layer = f["properties"].get("Layer")
        g = shape(f["geometry"])
        if g.length == 0:
            continue
        if layer == "PLEAMAR MAXIMA":
            pm.append(g)
        elif layer == "ZONA FEDERAL":
            zf.append(g)
    print(f"PLEAMAR MAXIMA features: {len(pm)}")
    print(f"ZONA FEDERAL  features: {len(zf)}")

    # Reproyectar a UTM 13N para trabajar en metros.
    pm_utm = [reproject(g, TO_UTM) for g in pm]
    zf_utm = [reproject(g, TO_UTM) for g in zf]

    print(f"Bufferizando ±{BUFFER_M} m cada línea en UTM 13N…")
    pm_buf = unary_union(pm_utm).buffer(BUFFER_M, cap_style="flat")
    zf_buf = unary_union(zf_utm).buffer(BUFFER_M, cap_style="flat")

    print("Calculando intersección (franja playa libre)…")
    franja = pm_buf.intersection(zf_buf)
    print(f"Área intersección UTM: {franja.area / 1e4:.2f} ha")

    # Reproyectar a WGS84 y exportar como GeoJSON.
    franja_wgs = reproject(franja, TO_WGS)

    feats = []
    geoms = (
        franja_wgs.geoms
        if hasattr(franja_wgs, "geoms")
        else [franja_wgs]
    )
    for i, g in enumerate(geoms):
        if g.is_empty or g.area == 0:
            continue
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"playa-libre-{i}",
                    "kind": "playa_libre",
                    "buffer_m": BUFFER_M,
                },
                "geometry": mapping(g),
            }
        )
    print(f"Polígonos resultantes: {len(feats)}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False))
    print(f"GeoJSON: {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.1f} KB)")

    print("Convirtiendo a PMTiles con tippecanoe…")
    PMTILES.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "tippecanoe",
            "-o",
            str(PMTILES),
            "--layer=playa_libre",
            "--minimum-zoom=8",
            "--maximum-zoom=16",
            "--extend-zooms-if-still-dropping",
            "--force",
            str(OUT),
        ],
        check=True,
        capture_output=True,
    )
    WEB_PMTILES.parent.mkdir(parents=True, exist_ok=True)
    WEB_PMTILES.write_bytes(PMTILES.read_bytes())
    print(f"PMTiles: {WEB_PMTILES.relative_to(ROOT)} ({WEB_PMTILES.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
