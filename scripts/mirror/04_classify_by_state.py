#!/usr/bin/env python3
"""Clasifica cada capa ZOFEMAT por estado mexicano usando spatial join.

Lee data/raw/semarnat-mirror/zofem/.../2016__Estados.geojson.gz como
fuente de polígonos estatales (NOMGEO_1, CVEGEO_1) y para cada capa de
ZOFEMAT calcula el estado correspondiente (centroide del bbox o de las
geometrías; fallback al estado más cercano si cae fuera).

Actualiza inventory_zofem.json añadiendo:
  - state_name (str)
  - state_code (str, CVEGEO_1)

Uso:
    python scripts/mirror/04_classify_by_state.py
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

from shapely.geometry import shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent.parent
INV = ROOT / "data" / "processed" / "semarnat-mirror" / "inventory_zofem.json"
RAW_BASE = ROOT / "data" / "raw" / "semarnat-mirror" / "zofem" / "zofem__Delimitaciones_ZOFEMAT"
ESTADOS_FILE = RAW_BASE / "2016__Estados.geojson.gz"


def safe_name(s: str) -> str:
    s = (s or "").strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)[:120]


def load_estados() -> tuple[list[dict], STRtree, list]:
    fc = json.loads(gzip.decompress(ESTADOS_FILE.read_bytes()))
    feats = fc["features"]
    geoms = []
    meta = []
    for f in feats:
        try:
            g = shape(f["geometry"])
        except Exception:
            continue
        if g.is_empty:
            continue
        geoms.append(g)
        p = f.get("properties") or {}
        meta.append({"name": p.get("NOMGEO_1"), "code": p.get("CVEGEO_1")})
    tree = STRtree(geoms)
    return meta, tree, geoms


def representative_point(layer_path: Path) -> tuple[float, float] | None:
    if not layer_path.exists():
        return None
    try:
        fc = json.loads(gzip.decompress(layer_path.read_bytes()))
    except Exception:
        return None
    geoms = []
    for f in fc.get("features", []):
        try:
            g = shape(f["geometry"])
            if not g.is_empty:
                geoms.append(g)
        except Exception:
            continue
    if not geoms:
        return None
    # Union de bboxes — barato y suficiente para clasificar a estado
    minx = min(g.bounds[0] for g in geoms)
    miny = min(g.bounds[1] for g in geoms)
    maxx = max(g.bounds[2] for g in geoms)
    maxy = max(g.bounds[3] for g in geoms)
    return ((minx + maxx) / 2, (miny + maxy) / 2)


def classify(point: tuple[float, float], meta: list[dict], tree: STRtree, geoms: list) -> dict | None:
    from shapely.geometry import Point

    pt = Point(point)
    # 1) candidatos por bbox
    idxs = tree.query(pt)
    for i in idxs:
        if geoms[i].contains(pt) or geoms[i].covers(pt):
            return meta[i]
    # 2) fallback: estado más cercano por distancia
    best_i, best_d = -1, float("inf")
    for i, g in enumerate(geoms):
        d = g.distance(pt)
        if d < best_d:
            best_d = d
            best_i = i
    if best_i >= 0:
        return {**meta[best_i], "approximate": True}
    return None


def main() -> None:
    if not ESTADOS_FILE.exists():
        sys.exit(f"Falta {ESTADOS_FILE}. Necesitas correr el retry con OBJECTID primero.")

    inv = json.loads(INV.read_text())
    print("Cargando polígonos de Estados...", flush=True)
    meta, tree, geoms = load_estados()
    print(f"  → {len(meta)} estados/zonas", flush=True)

    classified = 0
    unknown = 0
    by_state: dict[str, int] = {}

    for folder, fdata in inv.get("folders", {}).items():
        if folder != "zofem":
            continue
        for svc in fdata.get("services", []):
            for layer in svc.get("layers", []):
                if layer.get("type") != "Feature Layer":
                    continue
                lid = layer["id"]
                lname = layer.get("name") or f"layer_{lid}"
                fname = f"{lid:04d}__{safe_name(lname)}.geojson.gz"
                fpath = RAW_BASE / fname

                pt = representative_point(fpath)
                if pt is None:
                    layer["state_name"] = None
                    layer["state_code"] = None
                    unknown += 1
                    continue

                st = classify(pt, meta, tree, geoms)
                if st:
                    layer["state_name"] = st["name"]
                    layer["state_code"] = st["code"]
                    layer["state_approximate"] = bool(st.get("approximate"))
                    classified += 1
                    by_state[st["name"]] = by_state.get(st["name"], 0) + 1
                else:
                    layer["state_name"] = None
                    layer["state_code"] = None
                    unknown += 1

    INV.write_text(json.dumps(inv, ensure_ascii=False, indent=2))
    print(
        f"\nClasificadas: {classified}  sin estado: {unknown}  total: {classified+unknown}"
    )
    print("\nPor estado:")
    for st in sorted(by_state, key=lambda k: -by_state[k]):
        print(f"  {st:<35} {by_state[st]:>4}")


if __name__ == "__main__":
    main()
