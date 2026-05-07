#!/usr/bin/env python3
"""Descarga las capas SEMARNAT que cubren Bahía de Banderas y las mergea en
un solo GeoJSON EPSG:4326 para tippecanoe. Idempotente.

Capas usadas:
    - 220 B_BANDERAS_2021    (Nayarit: Punta de Mita, Bucerías-Mezcales).
                              Plano único vigente 2021.
    - 202 14067_2016_01      (Jalisco: Puerto Vallarta, planos 2016).
                              38 planos numerados consecutivos del mismo
                              proyecto. Cobertura de la mancha urbana de
                              PV (Marina Vallarta a Boca de Tomatlán
                              parcial); Mismaloya al sur queda fuera.

Decisión de selección PV: la capa 201 "Puerto Vallarta" del MapServer es
un archivo histórico con 5 sublayers (2014, 2016, 2017, 2019, 2022) que
cubren EL MISMO TRAMO geográfico en distintas fechas, sin marcar cuál
es vigente. Mergearlos produce duplicación de líneas paralelas y pareos
inválidos en `08_compute_playa_libre`. Se elige 202 por ser el plano
integral más detallado (38 planos) y suficientemente reciente. Las
versiones 2017/2019 son revisiones puntuales mini; el 2022 sólo cubre
una sección (P16); el 2014 es más amplio al sur pero con menos detalle.
Cambiar a otro sublayer requiere editar PV_LAYER_IDS y re-correr todo
el pipeline.

Uso:
    python scripts/01_download_zofemat.py
"""

from __future__ import annotations

import gzip
import json
import os
import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "zofemat_bb_raw.geojson"
RAW_DIR = ROOT / "data" / "raw" / "zofemat_layers"
PROCESSED = ROOT / "data" / "processed" / "zofemat_bb.geojson"
MAPSERVER = (
    "https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/"
    "Delimitaciones_ZOFEMAT/MapServer"
)
TARGET_LAYER_ID = 220
TARGET_LAYER_NAME_HINT = "BANDERAS"

# Sublayer único elegido para Puerto Vallarta (Jalisco). Ver docstring.
PV_LAYER_IDS = [202]

# Mirror público en R2 (fallback cuando SEMARNAT está caído).
# Override con la env var ZOFEMAT_MIRROR_BASE si se aloja en otro dominio.
MIRROR_BASE = os.environ.get(
    "ZOFEMAT_MIRROR_BASE",
    "https://pub-9b3bf89406004e68bcece40ce907acaf.r2.dev/semarnat",
)
MIRROR_LAYER_PATH = "zofem/zofem__Delimitaciones_ZOFEMAT/0220__B_BANDERAS_2021.geojson.gz"


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


def fetch_from_mirror() -> dict | None:
    """Fallback: baja la capa Bahía de Banderas desde el mirror R2.

    Devuelve None si no es alcanzable. Útil cuando SEMARNAT está caído
    o el endpoint cambió.
    """
    if "PLACEHOLDER" in MIRROR_BASE:
        return None
    url = f"{MIRROR_BASE}/{MIRROR_LAYER_PATH}"
    print(f"Fallback mirror: GET {url}")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        payload = gzip.decompress(r.content)
        return json.loads(payload)
    except Exception as e:
        print(f"  ! mirror también falló: {e}", file=sys.stderr)
        return None


def fetch_pv_layer(layer_id: int) -> dict | None:
    """Descarga un sublayer de la capa 201 (Puerto Vallarta). Cachea en disco."""
    cache = RAW_DIR / f"layer_{layer_id}.geojson"
    if cache.exists() and cache.stat().st_size > 200:
        print(f"  cache hit: {cache.relative_to(ROOT)}")
        return json.loads(cache.read_text())
    try:
        fc = fetch_geojson(layer_id)
    except (requests.RequestException, ValueError) as e:
        print(f"  ! capa {layer_id} no respondió: {e}", file=sys.stderr)
        return None
    if not fc.get("features"):
        print(f"  capa {layer_id}: vacía")
        return fc
    cache.write_text(json.dumps(fc, ensure_ascii=False))
    print(f"  capa {layer_id}: {len(fc['features'])} features → {cache.relative_to(ROOT)}")
    return fc


def normalize_pv_features(fc: dict, layer_id: int) -> list[dict]:
    """Anota provenance en cada feature del sublayer PV."""
    out: list[dict] = []
    for feat in fc.get("features", []):
        props = dict(feat.get("properties") or {})
        props["_source_layer_id"] = layer_id
        out.append({**feat, "properties": props})
    return out


def main() -> None:
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)

    fc: dict | None = None
    try:
        fc = fetch_geojson(TARGET_LAYER_ID)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            try:
                layer_id = find_layer_by_name()
                fc = fetch_geojson(layer_id)
            except Exception as ee:
                print(f"  ! SEMARNAT no responde: {ee}", file=sys.stderr)
        else:
            print(f"  ! SEMARNAT HTTP {e}", file=sys.stderr)
    except requests.RequestException as e:
        print(f"  ! SEMARNAT inalcanzable: {e}", file=sys.stderr)

    if fc is None:
        print("Intentando mirror público...")
        fc = fetch_from_mirror()
        if fc is None:
            sys.exit(
                "No fue posible obtener la capa ni desde SEMARNAT ni desde el mirror.\n"
                "Revisar manualmente: " + MAPSERVER + "?f=json\n"
                "O setear ZOFEMAT_MIRROR_BASE con un endpoint alternativo."
            )

    if not fc.get("features"):
        sys.exit("Respuesta sin features. Revisar manualmente.")

    # Anotar provenance en las features de Bahía de Banderas / Nayarit.
    for feat in fc["features"]:
        feat.setdefault("properties", {})
        feat["properties"]["_source_layer_id"] = TARGET_LAYER_ID

    # Descargar capas PV (Jalisco) y mergear.
    print(f"\nDescargando capas Puerto Vallarta: {PV_LAYER_IDS}")
    pv_added = 0
    for lid in PV_LAYER_IDS:
        pv_fc = fetch_pv_layer(lid)
        if pv_fc is None:
            continue
        norm = normalize_pv_features(pv_fc, lid)
        fc["features"].extend(norm)
        pv_added += len(norm)
        print(f"  capa {lid}: {len(norm)} features incorporadas (post-normalización)")
    print(f"Total PV agregado: {pv_added} features")

    RAW.write_text(json.dumps(fc, ensure_ascii=False))
    print(f"Crudo combinado: {RAW.relative_to(ROOT)} ({RAW.stat().st_size/1024:.1f} KB)")

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
