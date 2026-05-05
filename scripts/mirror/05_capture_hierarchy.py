#!/usr/bin/env python3
"""Captura la jerarquía Group Layer → Feature Layer del MapServer.

Hace una pasada por SEMARNAT pidiendo subLayers/parentLayer por capa,
y enriquece inventory_zofem.json con esa estructura.

Uso:
    python scripts/mirror/05_capture_hierarchy.py
"""

from __future__ import annotations

import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import requests

ROOT = Path(__file__).resolve().parent.parent.parent
INV = ROOT / "data" / "processed" / "semarnat-mirror" / "inventory_zofem.json"

USER_AGENT = (
    "PlayasLibres-CivicMirror/0.1 hierarchy-probe "
    "(+https://github.com/alanestrada/playaslibres-ai)"
)
TIMEOUT = 60
WORKERS = 12

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


def get_layer_meta(url: str) -> dict | None:
    try:
        r = _session().get(url, params={"f": "json"}, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def main() -> None:
    inv = json.loads(INV.read_text())
    svc = inv["folders"]["zofem"]["services"][0]
    layers = svc["layers"]
    print(f"Procesando {len(layers)} capas (parentLayer + subLayers)...", flush=True)

    t0 = time.time()
    done = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        fut_to_layer = {
            ex.submit(get_layer_meta, layer["url"]): layer for layer in layers
        }
        for fut in as_completed(fut_to_layer):
            layer = fut_to_layer[fut]
            meta = fut.result() or {}
            parent = meta.get("parentLayer") or None
            sublayers = meta.get("subLayers") or []
            layer["parent"] = (
                {"id": parent["id"], "name": parent.get("name")} if parent else None
            )
            layer["subLayers"] = [
                {"id": s["id"], "name": s.get("name")} for s in sublayers
            ]
            done += 1
            if done % 50 == 0:
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                eta = (len(layers) - done) / rate if rate > 0 else 0
                print(
                    f"  [{done}/{len(layers)}] elapsed={elapsed/60:.1f}m ETA={eta/60:.1f}m",
                    flush=True,
                )

    INV.write_text(json.dumps(inv, ensure_ascii=False, indent=2))
    elapsed = time.time() - t0
    print(f"\n✓ inventory enriquecido. Tiempo: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
