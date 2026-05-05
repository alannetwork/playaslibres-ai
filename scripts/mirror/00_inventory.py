#!/usr/bin/env python3
"""Inventario completo del MapServer SEMARNAT geomaticasig1.

Recorre folders → services → layers, captura metadata mínima por capa
(tipo, count, extent, geometryType) y escupe un manifest JSON +
resumen humano legible.

Usa ThreadPoolExecutor para paralelizar las consultas (SEMARNAT tarda
~2-3s por request en serie). Escribe progreso incremental a disco
cada N capas para que el avance sea visible.

No descarga datos pesados; solo metadata. Idempotente.

Uso:
    python scripts/mirror/00_inventory.py
    python scripts/mirror/00_inventory.py --workers 10
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "data" / "processed" / "semarnat-mirror"
OUT_JSON = OUT_DIR / "inventory.json"
OUT_TXT = OUT_DIR / "inventory_summary.txt"
PROGRESS = OUT_DIR / "inventory_progress.txt"

BASE = "https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services"
USER_AGENT = (
    "PlayasLibres-CivicMirror/0.1 "
    "(+https://github.com/alanestrada/playaslibres-ai; mirror of public SEMARNAT data)"
)
SKIP_FOLDERS = {"Pruebas", "apsBeta", "apsDev", "Utilities"}
TIMEOUT = 90
RETRIES = 3
RETRY_BACKOFF = 2.0
DEFAULT_WORKERS = 10
PROGRESS_EVERY = 25


_session_local: dict[int, requests.Session] = {}
_session_lock = Lock()


def _session() -> requests.Session:
    import threading

    tid = threading.get_ident()
    with _session_lock:
        s = _session_local.get(tid)
        if s is None:
            s = requests.Session()
            s.headers.update({"User-Agent": USER_AGENT})
            _session_local[tid] = s
    return s


def get_json(url: str, params: dict[str, Any] | None = None) -> dict | None:
    p = {"f": "json", **(params or {})}
    last_err: Exception | None = None
    for attempt in range(RETRIES):
        try:
            r = _session().get(url, params=p, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            time.sleep(RETRY_BACKOFF * (attempt + 1))
    print(f"  ! fallo {url}: {last_err}", file=sys.stderr, flush=True)
    return None


def list_folder(folder: str) -> dict | None:
    url = f"{BASE}/{folder}" if folder else BASE
    return get_json(url)


def describe_service(folder: str, service_name: str, service_type: str) -> dict | None:
    path = f"{folder}/{service_name}" if folder else service_name
    url = f"{BASE}/{path}/{service_type}"
    return get_json(url)


def describe_layer(
    folder: str, service_name: str, service_type: str, layer_id: int
) -> dict:
    path = f"{folder}/{service_name}" if folder else service_name
    base_url = f"{BASE}/{path}/{service_type}/{layer_id}"
    info = get_json(base_url) or {}
    out: dict[str, Any] = {
        "id": layer_id,
        "name": info.get("name"),
        "type": info.get("type"),
        "geometryType": info.get("geometryType"),
        "extent": info.get("extent"),
        "fields": [
            {"name": f.get("name"), "type": f.get("type")}
            for f in (info.get("fields") or [])
        ],
        "capabilities": info.get("capabilities"),
        "supportsPagination": (info.get("advancedQueryCapabilities") or {}).get(
            "supportsPagination"
        ),
        "maxRecordCount": info.get("maxRecordCount"),
        "url": base_url,
    }
    if info.get("type") in ("Feature Layer", "Table"):
        cnt = get_json(
            f"{base_url}/query",
            params={"where": "1=1", "returnCountOnly": "true"},
        )
        out["featureCount"] = cnt.get("count") if cnt else None
    return out


def crawl_layers(
    folder_real: str,
    svc_only_name: str,
    svc_type: str,
    layer_ids: list[int],
    workers: int,
) -> list[dict]:
    results: list[dict] = []
    if not layer_ids:
        return results
    with ThreadPoolExecutor(max_workers=workers) as ex:
        fut_to_id = {
            ex.submit(describe_layer, folder_real, svc_only_name, svc_type, lid): lid
            for lid in layer_ids
        }
        for fut in as_completed(fut_to_id):
            try:
                results.append(fut.result())
            except Exception as e:
                lid = fut_to_id[fut]
                print(
                    f"  ! layer {svc_only_name}/{lid} excepción: {e}",
                    file=sys.stderr,
                    flush=True,
                )
    results.sort(key=lambda x: x.get("id", 0))
    return results


def crawl(workers: int) -> dict:
    print(f"GET {BASE}?f=json", flush=True)
    root = list_folder("")
    if not root:
        sys.exit("No se pudo listar la raíz del MapServer.")

    folders = [f for f in root.get("folders", []) if f not in SKIP_FOLDERS]
    skipped_folders = [f for f in root.get("folders", []) if f in SKIP_FOLDERS]
    services_by_folder: dict[str, list[dict]] = {"<root>": root.get("services", [])}

    print(f"Listando {len(folders)} folders en paralelo...", flush=True)
    with ThreadPoolExecutor(max_workers=min(workers, len(folders) or 1)) as ex:
        fut_to_folder = {ex.submit(list_folder, f): f for f in folders}
        for fut in as_completed(fut_to_folder):
            folder = fut_to_folder[fut]
            info = fut.result() or {}
            services_by_folder[folder] = info.get("services", [])
            print(
                f"  [{folder}] {len(services_by_folder[folder])} services",
                flush=True,
            )

    inventory: dict[str, Any] = {
        "base": BASE,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "skipped_folders": skipped_folders,
        "folders": {},
        "totals": {
            "services": 0,
            "mapserver_services": 0,
            "featureserver_services": 0,
            "imageserver_services": 0,
            "other_services": 0,
            "feature_layers": 0,
            "raster_layers": 0,
            "tables": 0,
            "estimated_features": 0,
        },
    }

    total_services = sum(len(v) for v in services_by_folder.values())
    print(f"\nTotal de services: {total_services}\n", flush=True)
    services_done = 0
    layers_done = 0
    t0 = time.time()

    for folder, services in services_by_folder.items():
        folder_key = folder
        inventory["folders"][folder_key] = {"services": []}
        real_folder = "" if folder_key == "<root>" else folder_key

        for svc in services:
            services_done += 1
            svc_name = svc["name"]
            svc_type = svc.get("type", "")
            inventory["totals"]["services"] += 1
            if svc_type == "MapServer":
                inventory["totals"]["mapserver_services"] += 1
            elif svc_type == "FeatureServer":
                inventory["totals"]["featureserver_services"] += 1
            elif svc_type == "ImageServer":
                inventory["totals"]["imageserver_services"] += 1
            else:
                inventory["totals"]["other_services"] += 1

            svc_only_name = svc_name.split("/")[-1]
            entry: dict[str, Any] = {
                "name": svc_name,
                "type": svc_type,
                "url": f"{BASE}/{svc_name}/{svc_type}",
                "layers": [],
                "imageserver_meta": None,
            }

            if svc_type in ("MapServer", "FeatureServer"):
                desc = describe_service(real_folder, svc_only_name, svc_type)
                layer_meta = (desc or {}).get("layers") or []
                table_meta = (desc or {}).get("tables") or []
                ids = [
                    x["id"] for x in (layer_meta + table_meta) if x.get("id") is not None
                ]
                detailed = crawl_layers(
                    real_folder, svc_only_name, svc_type, ids, workers
                )
                entry["layers"] = detailed
                for li in detailed:
                    layers_done += 1
                    if li.get("type") == "Feature Layer":
                        inventory["totals"]["feature_layers"] += 1
                        if li.get("featureCount"):
                            inventory["totals"]["estimated_features"] += li[
                                "featureCount"
                            ]
                    elif li.get("type") == "Raster Layer":
                        inventory["totals"]["raster_layers"] += 1
                    elif li.get("type") == "Table":
                        inventory["totals"]["tables"] += 1

            elif svc_type == "ImageServer":
                desc = describe_service(real_folder, svc_only_name, svc_type)
                if desc:
                    entry["imageserver_meta"] = {
                        "name": desc.get("name"),
                        "description": desc.get("description"),
                        "pixelType": desc.get("pixelType"),
                        "bandCount": desc.get("bandCount"),
                        "extent": desc.get("extent"),
                        "spatialReference": desc.get("spatialReference"),
                    }

            inventory["folders"][folder_key]["services"].append(entry)

            elapsed = time.time() - t0
            rate = services_done / elapsed if elapsed > 0 else 0
            eta = (total_services - services_done) / rate if rate > 0 else 0
            line = (
                f"[{services_done:4d}/{total_services}] "
                f"{folder_key:>20s} :: {svc_type:<14} {svc_only_name[:50]:<50}  "
                f"layers={len(entry['layers']):3d}  "
                f"elapsed={elapsed/60:.1f}m  ETA={eta/60:.1f}m"
            )
            print(line, flush=True)

            if services_done % PROGRESS_EVERY == 0:
                _write_partial(inventory)

    print(
        f"\nTOTAL services={services_done}  layers={layers_done}  "
        f"tiempo={(time.time()-t0)/60:.1f}m",
        flush=True,
    )
    return inventory


def _write_partial(inv: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = OUT_JSON.with_suffix(".json.partial")
    tmp.write_text(json.dumps(inv, ensure_ascii=False))
    PROGRESS.write_text(
        f"services_in={len(inv['folders'])} folders, "
        f"{inv['totals']['services']} services, "
        f"{inv['totals']['feature_layers']} feature layers so far\n"
    )


def write_summary(inv: dict) -> None:
    lines: list[str] = []
    lines.append(f"SEMARNAT geomaticasig1 inventory  ({inv['fetched_at']})")
    lines.append(f"base: {inv['base']}")
    lines.append(f"skipped folders: {', '.join(inv['skipped_folders']) or '-'}")
    lines.append("")
    t = inv["totals"]
    lines.append(f"Total services:         {t['services']}")
    lines.append(f"  MapServer:            {t['mapserver_services']}")
    lines.append(f"  FeatureServer:        {t['featureserver_services']}")
    lines.append(f"  ImageServer (raster): {t['imageserver_services']}")
    lines.append(f"  otros:                {t['other_services']}")
    lines.append(f"Feature layers (vector):{t['feature_layers']}")
    lines.append(f"Raster layers:           {t['raster_layers']}")
    lines.append(f"Tables:                  {t['tables']}")
    lines.append(f"Estimated features:      {t['estimated_features']:,}")
    lines.append("")
    lines.append("By folder:")
    for folder, data in inv["folders"].items():
        n_svc = len(data["services"])
        n_layers = sum(len(s["layers"]) for s in data["services"])
        n_image = sum(1 for s in data["services"] if s["type"] == "ImageServer")
        lines.append(
            f"  {folder:<24} services={n_svc:<3} layers={n_layers:<4} imageservers={n_image}"
        )
    OUT_TXT.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    inv = crawl(args.workers)
    OUT_JSON.write_text(json.dumps(inv, ensure_ascii=False, indent=2))
    partial = OUT_JSON.with_suffix(".json.partial")
    if partial.exists():
        partial.unlink()
    print(f"\nManifest: {OUT_JSON.relative_to(ROOT)}")
    write_summary(inv)
    print(f"Resumen:  {OUT_TXT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
