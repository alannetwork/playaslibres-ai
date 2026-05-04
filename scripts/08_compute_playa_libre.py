#!/usr/bin/env python3
"""Genera el polígono "Playa Libre": franja ZOFEMAT entre PLEAMAR MAXIMA
y ZONA FEDERAL tal como las dibujó el perito de SEMARNAT.

LGBN art. 119 fr. I: la zona federal marítimo-terrestre es la faja de 20 m
de ancho de tierra firme, transitable y contigua a las playas. PERO el
dataset SEMARNAT codifica el ancho REAL plano-por-plano: en marinas y
muelles angostos el perito dibujó la ZF a ~5 m de la pleamar (no 20 m),
porque físicamente no hay 20 m de tierra firme transitable. El algoritmo
debe respetar la posición que el perito decidió, no asumir un ancho fijo.

Algoritmo (v3 — "ribbon directo"):
    1. Para cada PLEAMAR MAXIMA, identificar su ZONA FEDERAL "hermana":
       - Match primario: extremos coincidentes (avg endpoint distance ≤ 35 m).
       - Fallback Hausdorff: la PM cabe dentro de un buffer de 40 m de la ZF
         con dirección coherente (rescata pares donde la ZF se trazó más
         larga que la PM).
    2. Orientar la ZF al sentido de la PM y construir el polígono directo:
       Polygon(pm.coords + reversed(zf_aligned.coords) + [pm.coords[0]]).
    3. Validar geometría:
       - polygon válido y no autointersectado (make_valid + buffer(0)).
       - ancho efectivo (area / pm.length) en [2, 35] m
         (banda generosa para abrazar tanto los 5 m de marinas como los 20 m
         legales de playa abierta; descarta franjas retorcidas).
    4. unary_union de todos los strips válidos.

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
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import (
    LineString,
    MultiLineString,
    Point,
    Polygon,
    mapping,
    shape,
)
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parent.parent
ZOFEMAT = ROOT / "data" / "processed" / "zofemat_bb.geojson"
OUT = ROOT / "data" / "processed" / "playa_libre_bb.geojson"
PMTILES = ROOT / "data" / "tiles" / "playa_libre_bb.pmtiles"
WEB_PMTILES = ROOT / "web" / "public" / "tiles" / "playa_libre_bb.pmtiles"

# Búsqueda de candidatos ZF en el corredor cercano a la PM. Conservador para
# que el STRtree devuelva pocos candidatos antes del filtrado fino.
MAX_ZF_SEARCH_M = 80.0

# Match primario: distancia promedio entre extremos PM↔ZF debe ser ≤ esto.
# El valor refleja el ancho legal de 20 m con tolerancia para perito.
MAX_ENDPOINT_PAIR_M = 35.0

# Fallback Hausdorff: la PM debe caber en un buffer de la ZF de este ancho.
HAUSDORFF_BUFFER_M = 40.0

# Validación geométrica del polígono resultante. Banda amplia para tolerar
# tanto franjas anchas (playa abierta, ~20 m) como angostas (marinas, ~5 m).
MIN_EFFECTIVE_WIDTH_M = 2.0
MAX_EFFECTIVE_WIDTH_M = 35.0

MIN_PLEAMAR_LENGTH_M = 5.0

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
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return list(geom.geoms)
    return []


def _direction(line: LineString) -> tuple[float, float]:
    """Vector unitario start→end. Útil para validar coherencia direccional."""
    sx, sy = line.coords[0]
    ex, ey = line.coords[-1]
    dx, dy = ex - sx, ey - sy
    norm = (dx * dx + dy * dy) ** 0.5
    if norm == 0:
        return (1.0, 0.0)
    return (dx / norm, dy / norm)


def find_paired_zf(
    pm: LineString, zf_lines: list[LineString]
) -> tuple[LineString | None, str]:
    """Encuentra la ZONA FEDERAL hermana de `pm` con dos estrategias.

    Devuelve (zf, modo) donde modo ∈ {"endpoint", "hausdorff", ""}.
    """
    if not zf_lines or pm.length == 0:
        return None, ""

    pm_s = Point(pm.coords[0])
    pm_e = Point(pm.coords[-1])
    pm_dir = _direction(pm)

    # Estrategia 1: extremos coincidentes.
    best_zf = None
    best_d = float("inf")
    for zf in zf_lines:
        if zf.geom_type != "LineString" or zf.length < 1:
            continue
        zs = Point(zf.coords[0])
        ze = Point(zf.coords[-1])
        d_same = (pm_s.distance(zs) + pm_e.distance(ze)) / 2
        d_rev = (pm_s.distance(ze) + pm_e.distance(zs)) / 2
        d = min(d_same, d_rev)
        if d < best_d:
            best_d = d
            best_zf = zf
    if best_zf is not None and best_d <= MAX_ENDPOINT_PAIR_M:
        return best_zf, "endpoint"

    # Estrategia 2 (fallback): Hausdorff direccional.
    # La PM completa debe caber en un buffer angosto de la ZF (la ZF es más
    # larga y la "envuelve"), Y la dirección debe coincidir.
    best_zf = None
    best_max_d = float("inf")
    for zf in zf_lines:
        if zf.geom_type != "LineString" or zf.length < pm.length * 0.8:
            continue
        # Coherencia direccional: producto punto > 0.5 (~< 60° de desviación).
        zd = _direction(zf)
        dot = pm_dir[0] * zd[0] + pm_dir[1] * zd[1]
        # Probar también la ZF reversed.
        if abs(dot) < 0.5:
            continue
        # Hausdorff direccional: max distancia desde PM a ZF.
        max_d = pm.hausdorff_distance(zf)
        if max_d < best_max_d:
            best_max_d = max_d
            best_zf = zf
    if best_zf is not None and best_max_d <= HAUSDORFF_BUFFER_M:
        return best_zf, "hausdorff"

    return None, ""


def align_zf_to_pm(pm: LineString, zf: LineString) -> list[tuple[float, float]]:
    """Devuelve las coordenadas de zf orientadas en el mismo sentido que pm.

    Si los extremos están más cerca en orden invertido, regresa zf.coords[::-1].
    Para fallback Hausdorff (donde la ZF puede ser más larga que la PM),
    recortamos la ZF entre las proyecciones de los extremos de la PM.
    """
    pm_s = Point(pm.coords[0])
    pm_e = Point(pm.coords[-1])
    zs = Point(zf.coords[0])
    ze = Point(zf.coords[-1])

    d_same = pm_s.distance(zs) + pm_e.distance(ze)
    d_rev = pm_s.distance(ze) + pm_e.distance(zs)
    zf_aligned = zf if d_same <= d_rev else LineString(list(zf.coords)[::-1])

    # Si ZF es notablemente más larga, recortarla a la proyección de los
    # extremos de la PM. Esto evita "cuñas" en la unión final.
    if zf_aligned.length > pm.length * 1.3:
        s_proj = zf_aligned.project(pm_s)
        e_proj = zf_aligned.project(pm_e)
        a, b = sorted((s_proj, e_proj))
        if b - a > 1.0:
            from shapely.ops import substring

            zf_clip = substring(zf_aligned, a, b)
            if zf_clip.geom_type == "LineString" and zf_clip.length > 1:
                # Re-orientar el clip al sentido de la PM
                cs = Point(zf_clip.coords[0])
                ce = Point(zf_clip.coords[-1])
                if pm_s.distance(cs) + pm_e.distance(ce) > pm_s.distance(ce) + pm_e.distance(cs):
                    zf_clip = LineString(list(zf_clip.coords)[::-1])
                return list(zf_clip.coords)

    return list(zf_aligned.coords)


def build_strip_direct(pm: LineString, zf: LineString) -> Polygon | None:
    """Construye el polígono ribbon directo entre `pm` y `zf`.

    Polygon = pm.coords + reversed(zf_aligned.coords) + [pm.coords[0]].
    Sin buffer, sin asunciones de ancho — respeta la geometría que el perito
    SEMARNAT trazó.
    """
    pm_coords = list(pm.coords)
    zf_coords = align_zf_to_pm(pm, zf)
    if len(pm_coords) < 2 or len(zf_coords) < 2:
        return None

    ring = pm_coords + zf_coords[::-1] + [pm_coords[0]]
    try:
        poly = Polygon(ring)
    except Exception:
        return None

    if not poly.is_valid:
        repaired = make_valid(poly)
        # make_valid puede devolver MultiPolygon, GeometryCollection, etc.
        if repaired.geom_type == "Polygon":
            poly = repaired
        elif hasattr(repaired, "geoms"):
            polys = [g for g in repaired.geoms if g.geom_type == "Polygon" and not g.is_empty]
            if not polys:
                return None
            poly = max(polys, key=lambda g: g.area)
        else:
            return None

    if poly.is_empty or poly.area == 0:
        return None

    # Ancho efectivo: área dividida entre la longitud de la PM. Para una
    # franja "limpia" entre dos curvas paralelas esto es ~ ancho local.
    eff_w = poly.area / pm.length
    if not (MIN_EFFECTIVE_WIDTH_M <= eff_w <= MAX_EFFECTIVE_WIDTH_M):
        return None

    # Asimetría: si la ZF es radicalmente distinta de la PM (no paralela),
    # el polígono está retorcido — descartar.
    eff_w_zf = poly.area / max(zf.length, 1e-6)
    if not (MIN_EFFECTIVE_WIDTH_M <= eff_w_zf <= MAX_EFFECTIVE_WIDTH_M):
        return None

    return poly


def main():
    fc = json.load(open(ZOFEMAT))

    pleamares: list[LineString] = []
    zonafeds: list[LineString] = []
    for f in fc["features"]:
        layer = f["properties"].get("Layer")
        g = shape(f["geometry"])
        if g.length == 0:
            continue
        for ls in linestrings_of(g):
            ls_utm = reproject(ls, TO_UTM)
            if layer == "PLEAMAR MAXIMA":
                pleamares.append(ls_utm)
            elif layer == "ZONA FEDERAL":
                zonafeds.append(ls_utm)

    print(f"PLEAMAR MAXIMA : {len(pleamares)}")
    print(f"ZONA FEDERAL   : {len(zonafeds)}")

    zf_tree = STRtree(zonafeds)

    polys: list[Polygon] = []
    counts = {"ok_endpoint": 0, "ok_hausdorff": 0, "no_pair": 0, "invalid_poly": 0, "width_out": 0, "too_short": 0}
    for pm in pleamares:
        if pm.length < MIN_PLEAMAR_LENGTH_M:
            counts["too_short"] += 1
            continue
        candidates_idx = zf_tree.query(pm.buffer(MAX_ZF_SEARCH_M))
        if len(candidates_idx) == 0:
            counts["no_pair"] += 1
            continue
        nearby_zf = [zonafeds[i] for i in candidates_idx]
        paired_zf, mode = find_paired_zf(pm, nearby_zf)
        if paired_zf is None:
            counts["no_pair"] += 1
            continue
        strip = build_strip_direct(pm, paired_zf)
        if strip is None:
            # Diferenciar entre invalid_poly y width_out es complicado aquí;
            # build_strip_direct devuelve None en ambos casos. Lo agrupamos.
            counts["width_out"] += 1
            continue
        counts[f"ok_{mode}"] += 1
        polys.append(strip)

    print(f"\nResultados por categoría:")
    for k, v in counts.items():
        print(f"  {k:14s}: {v}")
    print(f"  total ok      : {counts['ok_endpoint'] + counts['ok_hausdorff']}")

    if not polys:
        raise SystemExit("No se generó ninguna franja. Revisar parámetros.")

    merged = unary_union(polys)
    geoms = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    geoms = [g for g in geoms if not g.is_empty and g.area > 0]

    total_ha = sum(g.area for g in geoms) / 1e4
    print(f"\nPolígonos finales : {len(geoms)}")
    print(f"Área total        : {total_ha:.2f} ha")

    feats = []
    for i, g in enumerate(geoms):
        gw = reproject(g, TO_WGS)
        eff_w = round(g.area / max(g.length / 2, 1e-6), 1)
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"playa-libre-{i}",
                    "kind": "playa_libre",
                    "area_m2": round(g.area, 1),
                    "ancho_efectivo_m": eff_w,
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
