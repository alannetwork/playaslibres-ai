#!/usr/bin/env python3
"""Descarga las DELIMITACIONES HISTÓRICAS de la ZOFEMAT (group layer 5 del
MapServer de SEMARNAT) y las une en un solo GeoJSON EPSG:4326 normalizado.

A diferencia de los consolidados nacionales 2019-2023 (capas 0-4, ver
`01b_download_zofemat_nacional.py`, 24 municipios en 13 estados), el grupo
"DELIMITACIONES HISTORICAS" agrupa ~400 planos individuales por municipio
(1982-2022) que cubren 122 municipios en 17 estados costeros — incluye
Mazatlán, Los Cabos, Cancún, Campeche, Tabasco, Chiapas y Michoacán, ausentes
de los consolidados.

Los esquemas de atributos son heterogéneos (muchas capas son importaciones
CAD). Normalización aplicada por feature:

  - ESTADO / MUNICIPIO: derivados de la jerarquía de group layers del
    MapServer (autoritativos; se ignoran los atributos homónimos).
  - LAYER / PLANO / PROYECTO / FECHA / ESCALA / CLAVE / HOJA: se conservan
    si existen; el resto de campos CAD (SUBCLASSES, ENTITYHAND, TEXT, ...)
    se descartan para no inflar los PMTiles.
  - anio: año del plano. Prioridad: atributo FECHA/FECHA_ELAB/AÑO → nombre
    de la capa (tokens 19xx/20xx no pegados a otros dígitos, o mes+2 dígitos
    tipo SEP99). Puede ser null si no es inferible.
  - fuente: "historico" (los consolidados llevan implícito "consolidado").
  - capa / capa_id: nombre e id de la capa origen en el MapServer.

Geometrías: se descargan polilíneas y polígonos (MapLibre pinta el contorno
de los polígonos con un line layer). Se omiten las 7 capas de puntos.

Paginación por ventanas de OBJECTID (el servicio no declara
supportsPagination), cache por capa en disco y descarga con concurrencia
moderada (el servidor de SEMARNAT es lento e intermitente).

Uso:
    python scripts/01c_download_zofemat_historico.py
    python scripts/01c_download_zofemat_historico.py --no-cache
    python scripts/01c_download_zofemat_historico.py --workers 3
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
LAYERS_META = ROOT / "data" / "raw" / "mapserver_layers.json"
CACHE_DIR = ROOT / "data" / "raw" / "zofemat_historico"
RAW = ROOT / "data" / "raw" / "zofemat_hist_raw.geojson"
PROCESSED = ROOT / "data" / "processed" / "zofemat_hist.geojson"

MAPSERVER = (
    "https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/"
    "Delimitaciones_ZOFEMAT/MapServer"
)

HIST_GROUP_ID = 5
GEOMETRY_TYPES = {"esriGeometryPolyline", "esriGeometryPolygon"}

# Atributos que se conservan (si existen en la capa). Todo lo demás se tira.
KEEP_FIELDS = ["LAYER", "PLANO", "PROYECTO", "FECHA", "ESCALA", "CLAVE", "HOJA"]
YEAR_ATTRS = ["FECHA", "FECHA_ELAB", "AÑO", "ANIO", "YEAR"]

RETRIES = 4
BACKOFF = 8  # segundos, lineal
PAGE = 1000

# ------------------------------------------------------------------------
# Filtro de contenido. Las capas históricas son importaciones CAD: además de
# la delimitación traen retícula, marco de hoja, curvas de nivel, casas,
# árboles, postes, simbología... (~690 valores distintos de LAYER). Se aplica
# WHITELIST por substring sobre el valor normalizado (mayúsculas, "_"->" "):
# sólo pasan las categorías de delimitación de la franja. Las capas SIN campo
# LAYER (shapefiles puros tipo AHOME_DELIMITACION_2019) se conservan enteras:
# la capa misma ES la delimitación.
#
# Limitación conocida: algunos planos viejos (ej. Chiapas 2001) usan niveles
# anónimos de MicroStation ("LEVEL 15", "LEVEL 29", ...) donde delimitación y
# decoración son indistinguibles por nombre; quedan excluidos enteros antes
# que pintar 30k líneas de retícula sobre el mapa.
# ------------------------------------------------------------------------
KEEP_SUBSTRINGS = [
    "PLEAMAR",            # PLEAMAR MAXIMA, PLEAMAR_2006, ... DEL ESTERO
    "ZONA FEDERAL",       # ZONA FEDERAL, ZONA_FEDERAL, ... INUNDABLE
    "ZOFEMAT",            # ZOFEMAT_FEATURETOLINE, etc.
    "ZFMT",               # LIMITE ZFMT, LZFMT
    "TERRENOS GANADOS",   # TERRENOS GANADOS AL MAR / MAR 2007 / ...
    "TGM",                # TGM_2014
    "LIMITE COSTERO",
    "LITORAL",
    "PLAYA MARITIMA",
    "EMBALSE MAX",        # EMBALSE MAXIMO / _MAX (esteros y lagunas)
    "MANGLE",
    "MAREA MAX",          # MAREA MAXIMA
    "DELIMITACION",
]
KEEP_EXACT = {"PM", "ZF"}
KEEP_PREFIXES = ("ZF ",)  # ZF_2006 -> "ZF 2006"


def is_franja(layer_value: str | None, capa_has_layer_field: bool) -> bool:
    """¿La feature es parte de la delimitación (vs. decoración CAD)?"""
    if not capa_has_layer_field:
        return True
    v = re.sub(r"\s+", " ", str(layer_value or "").replace("_", " ")).strip().upper()
    if not v:
        return False
    if v in KEEP_EXACT or v.startswith(KEEP_PREFIXES):
        return True
    return any(s in v for s in KEEP_SUBSTRINGS)

MESES = {
    "ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "AGT": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12,
}


def _get_json(url: str, timeout: int) -> dict:
    last: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, timeout=timeout)
            r.raise_for_status()
            d = r.json()
            # ArcGIS devuelve 200 con {"error": ...} en fallos lógicos.
            if isinstance(d, dict) and "error" in d:
                raise requests.RequestException(str(d["error"])[:200])
            return d
        except (requests.RequestException, ValueError) as e:
            last = e
            if attempt < RETRIES:
                time.sleep(BACKOFF * attempt)
    raise last  # type: ignore[misc]


def load_layer_tree() -> dict[int, dict]:
    """Metadata de todas las capas del MapServer (cacheada en disco)."""
    if LAYERS_META.exists() and LAYERS_META.stat().st_size > 1000:
        data = json.loads(LAYERS_META.read_text())
    else:
        print(f"GET {MAPSERVER}/layers?f=json")
        data = _get_json(f"{MAPSERVER}/layers?f=json", timeout=300)
        LAYERS_META.parent.mkdir(parents=True, exist_ok=True)
        LAYERS_META.write_text(json.dumps(data, ensure_ascii=False))
    return {l["id"]: l for l in data["layers"]}


def hist_targets(layers: dict[int, dict]) -> list[dict]:
    """Capas de features bajo el grupo histórico, con estado/municipio."""
    targets = []
    for lid, l in layers.items():
        if l.get("type") != "Feature Layer":
            continue
        if l.get("geometryType") not in GEOMETRY_TYPES:
            continue
        # Cadena de ancestros hasta la raíz.
        chain = []
        cur = l
        while cur.get("parentLayer"):
            pid = cur["parentLayer"]["id"]
            chain.append(pid)
            cur = layers[pid]
        if HIST_GROUP_ID not in chain:
            continue
        # estado = ancestro cuyo padre es el grupo 5; municipio = su hijo en
        # la cadena (cubre el caso con un nivel extra, ej. Huamelula).
        idx = chain.index(HIST_GROUP_ID)
        estado_id = chain[idx - 1]
        municipio_id = chain[idx - 2] if idx >= 2 else estado_id
        targets.append(
            {
                "id": lid,
                "name": l["name"],
                "estado": layers[estado_id]["name"].strip().upper(),
                "municipio": layers[municipio_id]["name"].strip().upper(),
                "fields": {f["name"].upper() for f in l.get("fields") or []},
            }
        )
    targets.sort(key=lambda t: t["id"])
    return targets


def parse_year(name: str, props: dict) -> int | None:
    """Año del plano: atributos de fecha primero, luego el nombre de la capa."""
    for attr in YEAR_ATTRS:
        v = props.get(attr)
        if v is None:
            continue
        m = re.search(r"(?<!\d)(19[5-9]\d|20[0-2]\d)(?!\d)", str(v))
        if m:
            return int(m.group(1))
    m = re.search(r"(?<!\d)(19[5-9]\d|20[0-2]\d)(?!\d)", name)
    if m:
        return int(m.group(1))
    # Tokens tipo SEP99 / AGT06 (mes abreviado + 2 dígitos).
    m = re.search(r"(?i)(" + "|".join(MESES) + r")(\d{2})(?!\d)", name)
    if m:
        yy = int(m.group(2))
        return 1900 + yy if yy >= 50 else 2000 + yy
    return None


def get_max_oid(layer_id: int) -> int | None:
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


def fetch_layer(target: dict, use_cache: bool) -> list[dict]:
    """Baja una capa completa (paginada) y normaliza sus properties."""
    lid = target["id"]
    cache = CACHE_DIR / f"layer_{lid}.geojson"
    if use_cache and cache.exists() and cache.stat().st_size > 100:
        feats = json.loads(cache.read_text())["features"]
    else:
        max_oid = get_max_oid(lid)
        feats = []
        if max_oid is None:
            # Sin OBJECTID utilizable: intento único sin paginar.
            url = f"{MAPSERVER}/{lid}/query?where=1%3D1&outFields=*&f=geojson&outSR=4326"
            feats = _get_json(url, timeout=180).get("features", [])
        else:
            lo = 0
            while lo < max_oid:
                hi = lo + PAGE
                url = (
                    f"{MAPSERVER}/{lid}/query"
                    f"?where=OBJECTID%3E{lo}+AND+OBJECTID%3C%3D{hi}"
                    f"&outFields=*&f=geojson&outSR=4326"
                )
                feats.extend(_get_json(url, timeout=180).get("features", []))
                lo = hi
        cache.write_text(json.dumps({"features": feats}, ensure_ascii=False))

    has_layer_field = "LAYER" in target["fields"]
    out = []
    for f in feats:
        if not f.get("geometry"):
            continue
        raw_props = {k.upper(): v for k, v in (f.get("properties") or {}).items()}
        if not is_franja(raw_props.get("LAYER"), has_layer_field):
            continue
        props = {k: raw_props[k] for k in KEEP_FIELDS if raw_props.get(k) not in (None, "")}
        props["ESTADO"] = target["estado"]
        props["MUNICIPIO"] = target["municipio"]
        props["capa"] = target["name"]
        props["capa_id"] = lid
        props["fuente"] = "historico"
        anio = parse_year(target["name"], raw_props)
        if anio is not None:
            props["anio"] = anio
        f["properties"] = props
        out.append(f)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-cache", action="store_true", help="Ignora la cache en disco")
    ap.add_argument("--workers", type=int, default=5, help="Descargas concurrentes")
    args = ap.parse_args()
    use_cache = not args.no_cache

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)

    layers = load_layer_tree()
    targets = hist_targets(layers)
    print(f"Capas históricas a descargar: {len(targets)}")

    t0 = time.time()
    all_feats: list[dict] = []
    failures: list[tuple[int, str, str]] = []
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(fetch_layer, t, use_cache): t for t in targets}
        for fut in as_completed(futs):
            t = futs[fut]
            done += 1
            try:
                feats = fut.result()
                all_feats.extend(feats)
                print(f"  [{done}/{len(targets)}] capa {t['id']} {t['name'][:50]}: {len(feats)}")
            except Exception as e:  # noqa: BLE001 - una capa caída no tumba el resto
                failures.append((t["id"], t["name"], str(e)[:160]))
                print(
                    f"  [{done}/{len(targets)}] ! capa {t['id']} {t['name'][:50]}: {e}",
                    file=sys.stderr,
                )

    if not all_feats:
        sys.exit(
            "Ninguna capa histórica devolvió features. Revisar manualmente: "
            f"{MAPSERVER}?f=json"
        )

    fc = {"type": "FeatureCollection", "features": all_feats}
    RAW.write_text(json.dumps(fc, ensure_ascii=False))
    print(f"Crudo combinado: {RAW.relative_to(ROOT)} ({RAW.stat().st_size/1_048_576:.1f} MB)")

    print("Normalizando a EPSG:4326 con ogr2ogr...")
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

    by_state = Counter(f["properties"]["ESTADO"] for f in all_feats)
    by_year = Counter(f["properties"].get("anio") for f in all_feats)
    print("---")
    print(f"Features totales : {len(all_feats)}")
    print(f"Estados          : {len(by_state)} -> {dict(by_state.most_common())}")
    print(f"Años (top)       : {dict(sorted(by_year.items(), key=lambda kv: (kv[0] is None, kv[0])))}")
    if failures:
        print(f"CAPAS FALLIDAS ({len(failures)}):", file=sys.stderr)
        for lid, name, err in failures:
            print(f"  {lid} {name}: {err}", file=sys.stderr)
        print("Re-correr el script para reintentar sólo las fallidas (cache).", file=sys.stderr)
    print(f"Tiempo total: {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
