#!/usr/bin/env python3
"""Descarga la capa 220 (B_BANDERAS_2021) del MapServer SEMARNAT y la prepara
en EPSG:4326 para tippecanoe. Idempotente: vuelve a correr sin romper nada.

Uso:
    python scripts/01_download_zofemat.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "zofemat_bb_raw.geojson"
PROCESSED = ROOT / "data" / "processed" / "zofemat_bb.geojson"
MAPSERVER = (
    "https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/"
    "Delimitaciones_ZOFEMAT/MapServer"
)
TARGET_LAYER_ID = 220
TARGET_LAYER_NAME_HINT = "BANDERAS"


def fetch_geojson(layer_id: int) -> dict:
    url = (
        f"{MAPSERVER}/{layer_id}/query"
        "?where=1%3D1&outFields=*&f=geojson&outSR=4326"
    )
    print(f"GET {url}")
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.json()


def find_layer_by_name() -> int:
    print(f"Capa {TARGET_LAYER_ID} no respondió. Listando capas del MapServer...")
    r = requests.get(f"{MAPSERVER}?f=json", timeout=60)
    r.raise_for_status()
    info = r.json()
    candidates = [
        layer
        for layer in info.get("layers", [])
        if TARGET_LAYER_NAME_HINT in layer.get("name", "").upper()
    ]
    if not candidates:
        sys.exit(
            "No se encontró ninguna capa con 'BANDERAS' en el MapServer. "
            "Revisa manualmente: " + MAPSERVER + "?f=json"
        )
    print("Candidatas:")
    for c in candidates:
        print(f"  id={c['id']:<4} name={c['name']}")
    chosen = candidates[0]
    print(f"Usando capa id={chosen['id']} name={chosen['name']}")
    return chosen["id"]


def feature_collection_stats(fc: dict) -> tuple[int, list[float], float]:
    features = fc.get("features", [])
    n = len(features)
    if n == 0:
        return 0, [0, 0, 0, 0], 0.0
    xs: list[float] = []
    ys: list[float] = []

    def collect(coords):
        if isinstance(coords[0], (list, tuple)):
            for c in coords:
                collect(c)
        else:
            xs.append(float(coords[0]))
            ys.append(float(coords[1]))

    for f in features:
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates")
        if coords:
            collect(coords)
    bbox = [min(xs), min(ys), max(xs), max(ys)] if xs else [0, 0, 0, 0]

    total_area_ha = 0.0
    try:
        from shapely.geometry import shape
        from pyproj import Geod

        geod = Geod(ellps="WGS84")
        for f in features:
            try:
                g = shape(f["geometry"])
                area_m2 = abs(geod.geometry_area_perimeter(g)[0])
                total_area_ha += area_m2 / 10_000.0
            except Exception:
                continue
    except ImportError:
        pass

    return n, bbox, total_area_ha


def main() -> None:
    RAW.parent.mkdir(parents=True, exist_ok=True)
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)

    try:
        fc = fetch_geojson(TARGET_LAYER_ID)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            layer_id = find_layer_by_name()
            fc = fetch_geojson(layer_id)
        else:
            raise

    if not fc.get("features"):
        sys.exit("Respuesta sin features. Revisar manualmente.")

    RAW.write_text(json.dumps(fc, ensure_ascii=False))
    print(f"Crudo guardado: {RAW.relative_to(ROOT)} ({RAW.stat().st_size/1024:.1f} KB)")

    print("Reproyectando a EPSG:4326 con ogr2ogr (no-op si ya está)...")
    if PROCESSED.exists():
        PROCESSED.unlink()
    subprocess.run(
        [
            "ogr2ogr",
            "-f",
            "GeoJSON",
            "-t_srs",
            "EPSG:4326",
            str(PROCESSED),
            str(RAW),
        ],
        check=True,
    )
    print(f"Procesado: {PROCESSED.relative_to(ROOT)} ({PROCESSED.stat().st_size/1024:.1f} KB)")

    n, bbox, area_ha = feature_collection_stats(fc)
    print("---")
    print(f"Features: {n}")
    print(f"BBox    : {bbox}")
    print(f"Área tot: {area_ha:.2f} ha")


if __name__ == "__main__":
    main()
