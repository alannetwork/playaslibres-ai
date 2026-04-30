#!/usr/bin/env python3
"""Genera el polígono "Playa Libre" exacto entre PLEAMAR MAXIMA y ZONA
FEDERAL.

La ZOFEMAT (Ley General de Bienes Nacionales art. 119 fr. I) es la franja
de 20 m tierra adentro de la pleamar máxima — y es de uso público. Para
visualizarla como polígono, conectamos cada par PLEAMAR ↔ ZONA FEDERAL
del mismo plano topográfico, formando un polígono cerrado punto-a-punto:

    PLEAMAR  ─────────────────────►
    │                              │
    ZONA FED ◄─────────────────────

Para cada PLEAMAR line buscamos la ZONA FEDERAL más cercana del MISMO
plano (PLANO property), comprobamos que estén razonablemente paralelas
y a < 60 m, y construimos el polígono uniendo extremos.

Salidas:
    data/processed/playa_libre_bb.geojson
    data/tiles/playa_libre_bb.pmtiles
    web/public/tiles/playa_libre_bb.pmtiles

Uso:
    python scripts/08_compute_playa_libre.py
"""

from __future__ import annotations

import json
import subprocess
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
ZOFEMAT = ROOT / "data" / "processed" / "zofemat_bb.geojson"
OUT = ROOT / "data" / "processed" / "playa_libre_bb.geojson"
PMTILES = ROOT / "data" / "tiles" / "playa_libre_bb.pmtiles"
WEB_PMTILES = ROOT / "web" / "public" / "tiles" / "playa_libre_bb.pmtiles"

# Distancia máxima entre pleamar y zona federal para considerarlas un
# par válido (≈3× el ancho legal de 20 m, descarta muelles aislados).
MAX_PAIR_DISTANCE_M = 60.0

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
    if isinstance(geom, Polygon):
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


def linestrings_of(geom) -> list[LineString]:
    """Aplana LineString o MultiLineString → lista de LineString."""
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    return []


def strip_polygon(pm: LineString, zf: LineString) -> Polygon | None:
    """Construye un polígono cerrado entre las dos líneas paralelas
    conectando sus extremos. Devuelve None si la geometría resultante
    es inválida o autointersectada."""
    pm_coords = list(pm.coords)
    zf_coords = list(zf.coords)
    if len(pm_coords) < 2 or len(zf_coords) < 2:
        return None

    # Orientación: emparejar primer-con-primer y último-con-último
    # vs primer-con-último, y elegir la que minimiza distancia total.
    def pt(c):
        return Point(c)

    d_same = pt(pm_coords[0]).distance(pt(zf_coords[0])) + pt(pm_coords[-1]).distance(
        pt(zf_coords[-1])
    )
    d_rev = pt(pm_coords[0]).distance(pt(zf_coords[-1])) + pt(pm_coords[-1]).distance(
        pt(zf_coords[0])
    )
    if d_rev < d_same:
        zf_coords = zf_coords[::-1]

    coords = pm_coords + zf_coords[::-1] + [pm_coords[0]]
    try:
        poly = Polygon(coords)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty or poly.area == 0:
            return None
        return poly
    except Exception:
        return None


def pair_lines(
    pleamar: list[tuple[LineString, dict]],
    zonafed: list[tuple[LineString, dict]],
) -> list[Polygon]:
    """Empareja cada PLEAMAR con su ZONA FEDERAL más cercana del mismo
    plano y devuelve los polígonos resultantes."""
    polys: list[Polygon] = []
    used_zf: set[int] = set()

    for pm, _ in pleamar:
        if pm.length < 5:
            continue
        # Encontrar la ZF más cercana (no usada todavía) del mismo plano
        best_idx = -1
        best_dist = float("inf")
        for i, (zf, _props) in enumerate(zonafed):
            if i in used_zf:
                continue
            d = pm.distance(zf)
            if d < best_dist:
                best_dist = d
                best_idx = i
        if best_idx < 0 or best_dist > MAX_PAIR_DISTANCE_M:
            continue
        zf_line = zonafed[best_idx][0]
        poly = strip_polygon(pm, zf_line)
        if poly is None:
            continue
        # Filtrar polígonos absurdamente grandes (> 20 ha = 200 000 m²)
        if poly.area > 200_000:
            continue
        polys.append(poly)
        used_zf.add(best_idx)
    return polys


def main():
    fc = json.load(open(ZOFEMAT))

    # Indexar por PLANO
    pleamar_by_plano: dict[str, list[tuple[LineString, dict]]] = defaultdict(list)
    zonafed_by_plano: dict[str, list[tuple[LineString, dict]]] = defaultdict(list)
    for f in fc["features"]:
        layer = f["properties"].get("Layer")
        plano = f["properties"].get("PLANO", "?")
        g = shape(f["geometry"])
        if g.length == 0:
            continue
        for ls in linestrings_of(g):
            ls_utm = reproject(ls, TO_UTM)
            if layer == "PLEAMAR MAXIMA":
                pleamar_by_plano[plano].append((ls_utm, f["properties"]))
            elif layer == "ZONA FEDERAL":
                zonafed_by_plano[plano].append((ls_utm, f["properties"]))

    print(f"Planos con PLEAMAR    : {len(pleamar_by_plano)}")
    print(f"Planos con ZONA FED.  : {len(zonafed_by_plano)}")

    all_polys_utm: list[Polygon] = []
    for plano in sorted(set(pleamar_by_plano) | set(zonafed_by_plano)):
        pm = pleamar_by_plano.get(plano, [])
        zf = zonafed_by_plano.get(plano, [])
        if not pm or not zf:
            continue
        polys = pair_lines(pm, zf)
        all_polys_utm.extend(polys)

    print(f"Polígonos generados (UTM): {len(all_polys_utm)}")
    if not all_polys_utm:
        raise SystemExit("No se generó ningún polígono. Revisar matching.")

    # Unir todos los polígonos para evitar overlaps
    merged = unary_union(all_polys_utm)
    if hasattr(merged, "geoms"):
        geoms = list(merged.geoms)
    else:
        geoms = [merged]

    total_ha = sum(g.area for g in geoms) / 1e4
    print(f"Polígonos finales       : {len(geoms)}")
    print(f"Área total              : {total_ha:.2f} ha")

    # Reproyectar a WGS84
    feats = []
    for i, g in enumerate(geoms):
        if g.is_empty or g.area == 0:
            continue
        gw = reproject(g, TO_WGS)
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"playa-libre-{i}",
                    "kind": "playa_libre",
                    "area_m2": round(g.area, 1),
                },
                "geometry": mapping(gw),
            }
        )

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
