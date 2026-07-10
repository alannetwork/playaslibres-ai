#!/usr/bin/env python3
"""Genera los polígonos de la FRANJA FEDERAL nacional (banda verde) a partir
de las líneas oficiales de SEMARNAT.

SEMARNAT publica la delimitación como POLILÍNEAS pareadas: la pleamar máxima
(borde mar) y la línea de zona federal (20 m tierra adentro). El polígono de
la franja no viene en los datos; aquí se reconstruye como la banda entre ambas
líneas:

    franja = buffer(pleamar, 22 m) ∩ buffer(zona_federal, 22 m)

Para dos líneas paralelas a ~20 m, la intersección de los buffers de 22 m es
exactamente la banda entre ellas (± ~2 m de sobra en los bordes). Donde una de
las dos líneas no existe (tramos sin par) la intersección es vacía y no se
pinta nada — comportamiento correcto: sin ambas líneas no hay franja
determinable.

Se procesa por grupo (ESTADO, MUNICIPIO, anio, fuente) sobre los consolidados
2019-2023 y las delimitaciones históricas, proyectando cada grupo a su zona
UTM local para que el buffer sea métrico. Cada polígono conserva
ESTADO/MUNICIPIO/anio/fuente para que el frontend aplique el filtro de año.

Es una banda DERIVADA de líneas oficiales, no un plano de franja publicado:
el disclaimer general del sitio ya cubre que nada aquí es delimitación con
efectos jurídicos.

Uso:
    python scripts/15_build_franja_nacional.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform, unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC_MX = ROOT / "data" / "processed" / "zofemat_mx.geojson"
SRC_HIST = ROOT / "data" / "processed" / "zofemat_hist.geojson"
OUT = ROOT / "data" / "processed" / "franja_mx.geojson"

BUFFER_M = 22.0
SIMPLIFY_M = 0.5
MIN_AREA_M2 = 40.0  # descarta astillas (< ~2 m x 20 m)

PLEAMAR_NEEDLES = ("PLEAMAR", "MAREA MAX")
ZF_NEEDLES = ("ZONA FEDERAL", "ZFMT", "LZF")
ZF_EXACT = {"ZF"}
ZF_PREFIXES = ("ZF ",)


def norm_layer(v) -> str:
    return re.sub(r"\s+", " ", str(v or "").replace("_", " ")).strip().upper()


def bucket_of(layer_value) -> str | None:
    v = norm_layer(layer_value)
    if not v:
        return None
    if any(n in v for n in PLEAMAR_NEEDLES):
        return "pleamar"
    if v in ZF_EXACT or v.startswith(ZF_PREFIXES) or any(n in v for n in ZF_NEEDLES):
        return "zf"
    return None


def utm_transformers(lon: float, lat: float):
    zone = min(60, max(1, int((lon + 180) // 6) + 1))
    epsg = (32600 if lat >= 0 else 32700) + zone
    fwd = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True).transform
    inv = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True).transform
    return fwd, inv


def collect(path: Path, fuente: str, groups: dict) -> int:
    """Acumula geometrías por (estado, municipio, anio, fuente) y bucket."""
    fc = json.loads(path.read_text())
    n = 0
    for feat in fc.get("features", []):
        props = feat.get("properties") or {}
        b = bucket_of(props.get("LAYER"))
        if b is None:
            continue
        geom = feat.get("geometry")
        if not geom or geom.get("type") not in ("LineString", "MultiLineString"):
            continue
        key = (
            (props.get("ESTADO") or "").strip(),
            (props.get("MUNICIPIO") or "").strip(),
            props.get("anio"),
            fuente,
        )
        groups[key][b].append(geom)
        n += 1
    return n


def main() -> None:
    if not SRC_MX.exists():
        raise SystemExit(f"Falta {SRC_MX.relative_to(ROOT)} (correr 01b primero)")

    groups: dict = defaultdict(lambda: {"pleamar": [], "zf": []})
    n_mx = collect(SRC_MX, "consolidado", groups)
    n_h = collect(SRC_HIST, "historico", groups) if SRC_HIST.exists() else 0
    print(f"Líneas clasificadas: consolidado={n_mx} historico={n_h}")
    print(f"Grupos (estado, municipio, anio, fuente): {len(groups)}")

    t0 = time.time()
    out_feats = []
    pares = 0
    for (estado, municipio, anio, fuente), buckets in sorted(
        groups.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2] or 0, kv[0][3])
    ):
        if not buckets["pleamar"] or not buckets["zf"]:
            continue
        pares += 1
        pl = unary_union([shape(g) for g in buckets["pleamar"]])
        zf = unary_union([shape(g) for g in buckets["zf"]])
        c = pl.centroid
        fwd, inv = utm_transformers(c.x, c.y)
        band = shp_transform(fwd, pl).buffer(BUFFER_M).intersection(
            shp_transform(fwd, zf).buffer(BUFFER_M)
        )
        if band.is_empty:
            continue
        band = band.simplify(SIMPLIFY_M)
        polys = list(band.geoms) if band.geom_type == "MultiPolygon" else [band]
        for p in polys:
            if p.area < MIN_AREA_M2:
                continue
            out_feats.append(
                {
                    "type": "Feature",
                    "properties": {
                        "ESTADO": estado,
                        "MUNICIPIO": municipio,
                        "anio": anio,
                        "fuente": fuente,
                    },
                    "geometry": mapping(shp_transform(inv, p)),
                }
            )

    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": out_feats}, ensure_ascii=False)
    )
    from collections import Counter

    by_state = Counter(f["properties"]["ESTADO"] for f in out_feats)
    print(f"Grupos con par pleamar+zf: {pares}")
    print(f"Polígonos de franja: {len(out_feats)} -> {OUT.relative_to(ROOT)} "
          f"({OUT.stat().st_size/1_048_576:.1f} MB)")
    print(f"Estados: {len(by_state)} -> {dict(by_state.most_common())}")
    print(f"Tiempo: {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
