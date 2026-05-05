#!/usr/bin/env python3
"""Descarga capas vectoriales del MapServer SEMARNAT en lote, paralelizado.

Lee data/processed/semarnat-mirror/inventory.json (producido por 00_inventory.py)
y para cada Feature Layer baja todas las features paginando con resultOffset/
resultRecordCount. Guarda como GeoJSON gzipped en:

    data/raw/semarnat-mirror/<folder>/<service>/<layer_id>__<safe_name>.geojson.gz

Cada capa va acompañada de un .meta.json con la respuesta cruda del describe.
También guarda metadata de ImageServers en .imageserver.json (sin pixels).

Idempotente: --skip-existing (default true) salta capas ya bajadas.

Uso:
    python scripts/mirror/01_download.py
    python scripts/mirror/01_download.py --workers 8
    python scripts/mirror/01_download.py --only-folder zofem
    python scripts/mirror/01_download.py --max-layers 5     # smoke test
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
INVENTORY = ROOT / "data" / "processed" / "semarnat-mirror" / "inventory.json"
OUT_BASE = ROOT / "data" / "raw" / "semarnat-mirror"
LOG_DIR = ROOT / "data" / "processed" / "semarnat-mirror"
LOG_PATH = LOG_DIR / "download_log.json"
PROGRESS_PATH = LOG_DIR / "download_progress.txt"

USER_AGENT = (
    "PlayasLibres-CivicMirror/0.1 "
    "(+https://github.com/alanestrada/playaslibres-ai; mirror of public SEMARNAT data)"
)
TIMEOUT = 180
RETRIES = 3
RETRY_BACKOFF = 2.0
PAGE_SIZE_FALLBACK = 1000
DEFAULT_WORKERS = 8


_session_local: dict[int, requests.Session] = {}
_session_lock = Lock()


def _session() -> requests.Session:
    tid = threading.get_ident()
    with _session_lock:
        s = _session_local.get(tid)
        if s is None:
            s = requests.Session()
            s.headers.update({"User-Agent": USER_AGENT})
            _session_local[tid] = s
    return s


def safe_name(s: str) -> str:
    s = (s or "").strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)[:120]


def get_json(url: str, params: dict[str, Any] | None = None) -> dict | None:
    last_err: Exception | None = None
    for attempt in range(RETRIES):
        try:
            r = _session().get(url, params=params, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            time.sleep(RETRY_BACKOFF * (attempt + 1))
    print(f"  ! fallo {url}: {last_err}", file=sys.stderr, flush=True)
    return None


def fetch_layer_features(layer_url: str, page_size: int) -> dict | None:
    """Pagina con resultOffset y devuelve un FeatureCollection.

    Si una página falla (JSON truncado, timeout), reintenta esa página con
    page_size dividido a la mitad, hasta un mínimo de 50.
    """
    fc: dict[str, Any] = {"type": "FeatureCollection", "features": []}
    offset = 0
    current_page = page_size
    while True:
        data = get_json(
            f"{layer_url}/query",
            params={
                "where": "1=1",
                "outFields": "*",
                "f": "geojson",
                "outSR": "4326",
                "resultOffset": str(offset),
                "resultRecordCount": str(current_page),
            },
        )
        if not data or "features" not in data:
            if current_page > 50:
                current_page = max(50, current_page // 2)
                print(
                    f"  ~ shrink page_size -> {current_page} en offset {offset} {layer_url}",
                    file=sys.stderr,
                    flush=True,
                )
                continue
            if offset == 0:
                return None
            break
        feats = data.get("features") or []
        if not feats:
            break
        fc["features"].extend(feats)
        if len(feats) < page_size:
            break
        offset += page_size
        if offset > 5_000_000:
            print(
                f"  ! corte de seguridad a 5M features en {layer_url}",
                file=sys.stderr,
                flush=True,
            )
            break
    fc["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    fc["source_url"] = layer_url
    return fc


@dataclass
class LayerJob:
    folder: str
    service_name: str
    service_safe: str
    layer: dict


def download_one(job: LayerJob, skip_existing: bool) -> dict:
    layer = job.layer
    lid = layer["id"]
    lname = safe_name(layer.get("name") or f"layer_{lid}")
    out_dir = OUT_BASE / safe_name(job.folder) / job.service_safe
    base = out_dir / f"{lid:04d}__{lname}"
    geojson_gz = base.with_suffix(".geojson.gz")
    meta_json = base.with_suffix(".meta.json")
    summary = {
        "folder": job.folder,
        "service": job.service_name,
        "layer_id": lid,
        "name": layer.get("name"),
        "url": layer.get("url"),
        "geometryType": layer.get("geometryType"),
        "expectedFeatureCount": layer.get("featureCount"),
    }

    if skip_existing and geojson_gz.exists() and meta_json.exists():
        summary["status"] = "skipped"
        summary["bytes"] = geojson_gz.stat().st_size
        return summary

    out_dir.mkdir(parents=True, exist_ok=True)
    page_size = layer.get("maxRecordCount") or PAGE_SIZE_FALLBACK
    page_size = min(page_size, 500)

    fc = fetch_layer_features(layer["url"], page_size)
    if fc is None:
        summary["status"] = "error"
        return summary

    payload = json.dumps(fc, ensure_ascii=False).encode("utf-8")
    with gzip.open(geojson_gz, "wb", compresslevel=6) as f:
        f.write(payload)
    meta_json.write_text(json.dumps(layer, ensure_ascii=False, indent=2))
    summary["status"] = "ok"
    summary["features_downloaded"] = len(fc.get("features", []))
    summary["bytes"] = geojson_gz.stat().st_size
    return summary


def save_imageserver_meta(folder: str, svc: dict) -> dict:
    svc_safe = safe_name(svc["name"].replace("/", "__"))
    out_dir = OUT_BASE / safe_name(folder) / svc_safe
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = safe_name(svc["name"].split("/")[-1]) + ".imageserver.json"
    fp = out_dir / fname
    fp.write_text(json.dumps(svc, ensure_ascii=False, indent=2))
    return {
        "folder": folder,
        "service": svc.get("name"),
        "type": "ImageServer",
        "status": "metadata_only",
        "url": svc.get("url"),
        "bytes": fp.stat().st_size,
    }


def collect_jobs(inv: dict, only_folder: str | None) -> tuple[list[LayerJob], list[dict]]:
    jobs: list[LayerJob] = []
    image_services: list[dict] = []
    for folder, fdata in inv.get("folders", {}).items():
        if only_folder and folder != only_folder:
            continue
        for svc in fdata.get("services", []):
            svc_name = svc["name"]
            svc_safe = safe_name(svc_name.replace("/", "__"))
            if svc["type"] == "ImageServer":
                image_services.append({"folder": folder, **svc})
                continue
            for layer in svc.get("layers", []):
                if layer.get("type") != "Feature Layer":
                    continue
                jobs.append(
                    LayerJob(
                        folder=folder,
                        service_name=svc_name,
                        service_safe=svc_safe,
                        layer=layer,
                    )
                )
    return jobs, image_services


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    ap.add_argument("--only-folder", default=None)
    ap.add_argument("--max-layers", type=int, default=None)
    ap.add_argument("--skip-existing", action="store_true", default=True)
    ap.add_argument("--no-skip-existing", dest="skip_existing", action="store_false")
    args = ap.parse_args()

    if not INVENTORY.exists():
        sys.exit(f"Falta {INVENTORY}. Corre primero scripts/mirror/00_inventory.py")

    inv = json.loads(INVENTORY.read_text())
    OUT_BASE.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    jobs, image_services = collect_jobs(inv, args.only_folder)
    if args.max_layers:
        jobs = jobs[: args.max_layers]

    total = len(jobs)
    print(
        f"Capas vectoriales a procesar: {total}  "
        f"ImageServers (solo metadata): {len(image_services)}  "
        f"workers={args.workers}",
        flush=True,
    )

    log: list[dict] = []
    log_lock = Lock()
    bytes_total = 0
    done = 0
    errors = 0
    skipped = 0
    t0 = time.time()

    def _record(res: dict) -> None:
        nonlocal bytes_total, done, errors, skipped
        with log_lock:
            log.append(res)
            done += 1
            bytes_total += res.get("bytes", 0)
            if res.get("status") == "error":
                errors += 1
            elif res.get("status") == "skipped":
                skipped += 1
            elapsed = time.time() - t0
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate if rate > 0 else 0
            line = (
                f"[{done:4d}/{total}] {res.get('status','?'):8s} "
                f"{res.get('folder',''):>16s} :: {(res.get('name') or '')[:50]:<50} "
                f"feat={res.get('features_downloaded') or res.get('expectedFeatureCount') or 0:>7}  "
                f"sz={res.get('bytes',0)/1024:.0f}KB  "
                f"MB_total={bytes_total/1024/1024:.0f}  "
                f"err={errors} skip={skipped}  "
                f"elapsed={elapsed/60:.1f}m ETA={eta/60:.1f}m"
            )
            print(line, flush=True)
            if done % 50 == 0:
                _flush_log(log, done, total, bytes_total, errors, skipped)

    # ImageServers (metadata only) — secuencial, son pocos
    for svc in image_services:
        try:
            res = save_imageserver_meta(svc.pop("folder"), svc)
            _record(res)
        except Exception as e:
            print(f"  ! ImageServer fallo: {e}", file=sys.stderr, flush=True)

    # Capas vectoriales — paralelo
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(download_one, j, args.skip_existing): j for j in jobs}
        for fut in as_completed(futs):
            try:
                res = fut.result()
            except Exception as e:
                j = futs[fut]
                res = {
                    "folder": j.folder,
                    "service": j.service_name,
                    "layer_id": j.layer.get("id"),
                    "name": j.layer.get("name"),
                    "status": "error",
                    "error": str(e),
                }
            _record(res)

    _flush_log(log, done, total, bytes_total, errors, skipped)
    print(
        f"\nFINAL: layers={done} ok+skipped={done-errors} err={errors} "
        f"skipped={skipped} bytes={bytes_total/1024/1024:.1f} MB "
        f"tiempo={(time.time()-t0)/60:.1f}m",
        flush=True,
    )


def _flush_log(
    log: list[dict],
    done: int,
    total: int,
    bytes_total: int,
    errors: int,
    skipped: int,
) -> None:
    LOG_PATH.write_text(
        json.dumps(
            {
                "snapshot_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "layers_processed": done,
                "layers_total": total,
                "errors": errors,
                "skipped": skipped,
                "total_bytes": bytes_total,
                "items": log,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    PROGRESS_PATH.write_text(
        f"{done}/{total} layers  errors={errors} skipped={skipped}  "
        f"bytes={bytes_total/1024/1024:.1f} MB\n"
    )


if __name__ == "__main__":
    main()
