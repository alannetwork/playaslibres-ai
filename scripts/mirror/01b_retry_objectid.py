#!/usr/bin/env python3
"""Retry de capas que fallaron en 01_download.py.

Estrategia: en vez de paginar con resultOffset/resultRecordCount (que en
algunas capas devuelve JSON truncado), descarga feature-por-feature usando
?objectIds=N. Mucho más lento pero robusto contra geometrías extremas.

Uso:
    python scripts/mirror/01b_retry_objectid.py \
        --layer-url https://.../MapServer/61 \
        --out-dir data/raw/semarnat-mirror/zofem/zofem__Delimitaciones_ZOFEMAT \
        --layer-id 61 --layer-name LOS_CABOS_DELIMITACION_2015_2020
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
from pathlib import Path

import requests

USER_AGENT = (
    "PlayasLibres-CivicMirror/0.1 retry-objectid "
    "(+https://github.com/alanestrada/playaslibres-ai)"
)
TIMEOUT = 180
RETRIES = 3
THROTTLE_SEC = 0.2


def safe_name(s: str) -> str:
    s = (s or "").strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)[:120]


def get_json(session: requests.Session, url: str, params: dict) -> dict | None:
    for attempt in range(RETRIES):
        try:
            r = session.get(url, params=params, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == RETRIES - 1:
                print(f"  ! {url} params={params}: {e}", file=sys.stderr, flush=True)
                return None
            time.sleep(2 * (attempt + 1))
    return None


def fetch_layer_by_objectids(layer_url: str) -> dict | None:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})

    # 1) listar todos los objectIds
    print(f"GET {layer_url}/query?returnIdsOnly=true", flush=True)
    ids_resp = get_json(
        s,
        f"{layer_url}/query",
        {"where": "1=1", "returnIdsOnly": "true", "f": "json"},
    )
    if not ids_resp or "objectIds" not in ids_resp:
        print(f"  ! no se obtuvieron objectIds", file=sys.stderr)
        return None
    object_ids = ids_resp["objectIds"]
    print(f"  → {len(object_ids)} objectIds", flush=True)

    # 2) bajar feature-por-feature
    fc: dict = {"type": "FeatureCollection", "features": []}
    for i, oid in enumerate(object_ids, 1):
        data = get_json(
            s,
            f"{layer_url}/query",
            {
                "objectIds": str(oid),
                "outFields": "*",
                "f": "geojson",
                "outSR": "4326",
            },
        )
        if data and "features" in data and data["features"]:
            fc["features"].extend(data["features"])
            print(f"  [{i}/{len(object_ids)}] oid={oid} ok", flush=True)
        else:
            # fallback: pedir el feature completo en formato esri y convertir
            data2 = get_json(
                s,
                f"{layer_url}/query",
                {
                    "objectIds": str(oid),
                    "outFields": "*",
                    "f": "json",
                    "outSR": "4326",
                },
            )
            if data2 and "features" in data2:
                # conversión mínima esri-json → geojson
                for f_ in data2["features"]:
                    geom = f_.get("geometry") or {}
                    g = _esri_to_geojson_geom(geom)
                    if g:
                        fc["features"].append(
                            {
                                "type": "Feature",
                                "geometry": g,
                                "properties": f_.get("attributes") or {},
                            }
                        )
                print(
                    f"  [{i}/{len(object_ids)}] oid={oid} via esri-json fallback",
                    flush=True,
                )
            else:
                print(
                    f"  [{i}/{len(object_ids)}] oid={oid} FALLO total",
                    file=sys.stderr,
                    flush=True,
                )
        time.sleep(THROTTLE_SEC)

    fc["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    fc["source_url"] = layer_url
    fc["fetch_strategy"] = "objectIds-one-by-one"
    return fc


def _esri_to_geojson_geom(geom: dict) -> dict | None:
    """Conversión mínima ArcGIS JSON → GeoJSON para polygon/polyline/point."""
    if not geom:
        return None
    if "x" in geom and "y" in geom:
        return {"type": "Point", "coordinates": [geom["x"], geom["y"]]}
    if "paths" in geom:
        paths = geom["paths"]
        if len(paths) == 1:
            return {"type": "LineString", "coordinates": paths[0]}
        return {"type": "MultiLineString", "coordinates": paths}
    if "rings" in geom:
        rings = geom["rings"]
        # ArcGIS usa ring orientation distinta a GeoJSON pero MapLibre/QGIS toleran
        return {"type": "Polygon", "coordinates": rings}
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--layer-url", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--layer-id", type=int, required=True)
    ap.add_argument("--layer-name", required=True)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = out_dir / f"{args.layer_id:04d}__{safe_name(args.layer_name)}"
    geojson_gz = base.with_suffix(".geojson.gz")
    meta_json = base.with_suffix(".meta.json")

    fc = fetch_layer_by_objectids(args.layer_url)
    if fc is None or not fc.get("features"):
        sys.exit(f"No se pudo recuperar la capa {args.layer_id}.")

    payload = json.dumps(fc, ensure_ascii=False).encode("utf-8")
    with gzip.open(geojson_gz, "wb", compresslevel=6) as f:
        f.write(payload)

    meta_json.write_text(
        json.dumps(
            {
                "id": args.layer_id,
                "name": args.layer_name,
                "url": args.layer_url,
                "fetch_strategy": "objectIds-one-by-one",
                "feature_count_observed": len(fc["features"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print(
        f"✓ {geojson_gz} "
        f"({geojson_gz.stat().st_size/1024:.1f} KB, "
        f"{len(fc['features'])} features)"
    )


if __name__ == "__main__":
    main()
