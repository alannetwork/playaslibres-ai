#!/usr/bin/env python3
"""Descarga la ZOFEMAT NACIONAL (todo México) desde el MapServer de SEMARNAT
y la une en un solo GeoJSON EPSG:4326 con un atributo `anio` por feature.

A diferencia de `01_download_zofemat.py` (que baja los planos POLIGONALES
detallados de Bahía de Banderas para alimentar el pipeline de la capa
ciudadana estimada — floodlines / playa libre), este script consume las
capas CONSOLIDADAS nacionales:

    0  DELIMITACIONES_2019   (1453 features)
    1  DELIMITACIONES_2020   ( 502 features)
    2  DELIMITACIONES_2021   ( 779 features)
    3  DELIMITACIONES_2022   (4727 features)
    4  DELIMITACIONES_2023   ( 125 features)

Son POLILÍNEAS de delimitación (no polígonos), cubren todo el país y traen
los atributos ESTADO / MUNICIPIO / LOCALIDAD / LAYER / PLANO / PROYECTO /
FECHA / AÑO. La cobertura es un mosaico de proyectos publicados por
SEMARNAT, NO una línea continua de toda la costa.

Decisión de producto (lanzamiento nacional): se conservan los 5 años y se
etiqueta cada feature con `anio`. El frontend permite seleccionar el año;
no se deduplica por tramo. Esto preserva la transparencia de fechas y evita
la lógica frágil de "qué plano es vigente" que sí fue necesaria para los
planos detallados de Bahía de Banderas.

Paginación: el servicio declara maxRecordCount=2000 y NO declara
supportsPagination, así que se pagina por ventanas de OBJECTID
(`OBJECTID > lo AND OBJECTID <= hi`) en vez de resultOffset.

Uso:
    python scripts/01b_download_zofemat_nacional.py
    python scripts/01b_download_zofemat_nacional.py --no-cache   # ignora cache
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "zofemat_mx_raw.geojson"
CACHE_DIR = ROOT / "data" / "raw" / "zofemat_nacional"
PROCESSED = ROOT / "data" / "processed" / "zofemat_mx.geojson"

MAPSERVER = (
    "https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/"
    "Delimitaciones_ZOFEMAT/MapServer"
)

# id de capa consolidada -> año.
NATIONAL_LAYERS: dict[int, int] = {0: 2019, 1: 2020, 2: 2021, 3: 2022, 4: 2023}

# Tamaño de ventana de paginación. El servicio declara maxRecordCount=2000,
# pero usamos 1000 para que cada request sea más liviano y resista mejor los
# timeouts de SEMARNAT (servidor históricamente lento e intermitente).
PAGE = 1000

# Campos a conservar. OBJECTID/Shape/ESCALA/PROYECCION/FECHA_LEV se omiten
# para no inflar los PMTiles. AÑO viene con eñe en el MapServer.
OUT_FIELDS = "LAYER,ESTADO,MUNICIPIO,LOCALIDAD,PLANO,PROYECTO,FECHA,A%C3%91O"

# Mirror público en R2 (fallback cuando SEMARNAT está caído). Override con la
# env var ZOFEMAT_MIRROR_BASE. El archivo esperado es el GeoJSON nacional ya
# combinado y gzippeado.
MIRROR_BASE = os.environ.get(
    "ZOFEMAT_MIRROR_BASE",
    "https://pub-9b3bf89406004e68bcece40ce907acaf.r2.dev/semarnat",
)
MIRROR_NATIONAL_PATH = "zofem/zofemat_mx.geojson.gz"


# Reintentos ante timeouts/errores transitorios de SEMARNAT (servidor lento).
RETRIES = 4
BACKOFF = 8  # segundos, lineal: 8, 16, 24...


def _get_json(url: str, timeout: int) -> dict:
    last: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last = e
            if attempt < RETRIES:
                wait = BACKOFF * attempt
                print(f"    reintento {attempt}/{RETRIES} en {wait}s ({e})", file=sys.stderr)
                time.sleep(wait)
    raise last  # type: ignore[misc]


def get_max_oid(layer_id: int) -> int | None:
    """Máximo OBJECTID de la capa (para acotar la paginación)."""
    url = (
        f"{MAPSERVER}/{layer_id}/query?where=1%3D1&f=json&outStatistics="
        '[{"statisticType":"max","onStatisticField":"OBJECTID",'
        '"outStatisticFieldName":"m"}]'
    )
    feats = _get_json(url, timeout=120).get("features", [])
    if not feats:
        return None
    try:
        return int(feats[0]["attributes"]["m"])
    except (KeyError, TypeError, ValueError):
        return None


def fetch_window(layer_id: int, lo: int, hi: int) -> list[dict]:
    """Una ventana de features con OBJECTID en (lo, hi]."""
    url = (
        f"{MAPSERVER}/{layer_id}/query"
        f"?where=OBJECTID%3E{lo}+AND+OBJECTID%3C%3D{hi}"
        f"&outFields={OUT_FIELDS}&f=geojson&outSR=4326"
    )
    return _get_json(url, timeout=180).get("features", [])


def fetch_layer(layer_id: int, year: int, use_cache: bool) -> list[dict]:
    """Baja una capa nacional completa, paginando por OBJECTID. Cachea en disco."""
    cache = CACHE_DIR / f"layer_{layer_id}_{year}.geojson"
    if use_cache and cache.exists() and cache.stat().st_size > 200:
        feats = json.loads(cache.read_text())["features"]
        print(f"  cache hit capa {layer_id} ({year}): {len(feats)} features")
        return feats

    max_oid = get_max_oid(layer_id)
    if max_oid is None:
        print(f"  ! capa {layer_id} ({year}): sin max OBJECTID", file=sys.stderr)
        return []

    feats: list[dict] = []
    lo = 0
    while lo < max_oid:
        hi = lo + PAGE
        window = fetch_window(layer_id, lo, hi)
        feats.extend(window)
        lo = hi
    print(f"  capa {layer_id} ({year}): {len(feats)} features (maxOID={max_oid})")

    cache.write_text(json.dumps({"features": feats}, ensure_ascii=False))
    return feats


def fetch_from_mirror() -> dict | None:
    """Fallback: baja el GeoJSON nacional combinado desde el mirror R2."""
    if "PLACEHOLDER" in MIRROR_BASE:
        return None
    url = f"{MIRROR_BASE}/{MIRROR_NATIONAL_PATH}"
    print(f"Fallback mirror: GET {url}")
    try:
        r = requests.get(url, timeout=180)
        r.raise_for_status()
        payload = gzip.decompress(r.content)
        return json.loads(payload)
    except Exception as e:  # noqa: BLE001 - el fallback no debe tumbar el script
        print(f"  ! mirror también falló: {e}", file=sys.stderr)
        return None


def stats(features: list[dict]) -> None:
    from collections import Counter

    by_year = Counter(f["properties"].get("anio") for f in features)
    by_state = Counter(f["properties"].get("ESTADO") for f in features)
    by_layer = Counter(f["properties"].get("LAYER") for f in features)
    print("---")
    print(f"Features totales: {len(features)}")
    print(f"Por año   : {dict(sorted(by_year.items()))}")
    print(f"Estados   : {len(by_state)} -> {dict(by_state.most_common(8))} ...")
    print(f"Categorías: {dict(by_layer.most_common(10))}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-cache", action="store_true", help="Ignora la cache en disco")
    args = ap.parse_args()
    use_cache = not args.no_cache

    RAW.parent.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    all_feats: list[dict] = []
    failed = 0
    for layer_id, year in NATIONAL_LAYERS.items():
        try:
            feats = fetch_layer(layer_id, year, use_cache)
        except requests.RequestException as e:
            print(f"  ! capa {layer_id} ({year}) inalcanzable: {e}", file=sys.stderr)
            failed += 1
            continue
        for f in feats:
            f.setdefault("properties", {})["anio"] = year
        all_feats.extend(feats)

    # Si SEMARNAT no respondió a ninguna capa, intentar el mirror.
    if not all_feats:
        print("SEMARNAT no devolvió features. Intentando mirror público...")
        fc = fetch_from_mirror()
        if fc is None or not fc.get("features"):
            sys.exit(
                "No fue posible obtener la ZOFEMAT nacional ni desde SEMARNAT ni "
                "desde el mirror.\nRevisar manualmente: " + MAPSERVER + "?f=json\n"
                "O setear ZOFEMAT_MIRROR_BASE con un endpoint alternativo."
            )
        all_feats = fc["features"]
    elif failed:
        print(
            f"AVISO: {failed} capa(s) fallaron; se continúa con las que sí "
            "respondieron. Re-correr para completar.",
            file=sys.stderr,
        )

    fc = {"type": "FeatureCollection", "features": all_feats}
    RAW.write_text(json.dumps(fc, ensure_ascii=False))
    print(f"Crudo combinado: {RAW.relative_to(ROOT)} ({RAW.stat().st_size/1_048_576:.1f} MB)")

    print("Reproyectando/normalizando a EPSG:4326 con ogr2ogr...")
    if PROCESSED.exists():
        PROCESSED.unlink()
    subprocess.run(
        ["ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:4326", str(PROCESSED), str(RAW)],
        check=True,
    )
    print(
        f"Procesado: {PROCESSED.relative_to(ROOT)} "
        f"({PROCESSED.stat().st_size/1_048_576:.1f} MB)"
    )

    stats(all_feats)
    print(f"Tiempo total: {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
