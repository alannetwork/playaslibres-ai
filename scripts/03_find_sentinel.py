#!/usr/bin/env python3
"""Busca la mejor escena Sentinel-2 L2A con <5% de nubes sobre Bahía de Banderas
en 2025 vía el STAC de Element84 (datos abiertos AWS). Persiste metadata para
que el frontend la consuma con TiTiler.xyz.

Uso:
    python scripts/03_find_sentinel.py
"""

from __future__ import annotations

import json
from pathlib import Path

from pystac_client import Client

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data" / "sentinel_base.json"

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"

BBOX = [-105.65, 20.50, -105.15, 20.85]
DATETIME = "2025-01-01/2025-12-31"
MAX_CLOUD = 5  # %


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    client = Client.open(STAC_URL)
    search = client.search(
        collections=[COLLECTION],
        bbox=BBOX,
        datetime=DATETIME,
        query={"eo:cloud_cover": {"lt": MAX_CLOUD}},
        max_items=20,
    )
    items = sorted(
        search.item_collection(),
        key=lambda it: (it.properties.get("eo:cloud_cover", 100), it.datetime),
    )
    if not items:
        raise SystemExit(
            "No se encontró ninguna escena Sentinel-2 con <5% de nubes en 2025. "
            "Sube el umbral o cambia el rango."
        )

    print("Top 5 escenas (menor nubosidad primero):")
    for it in items[:5]:
        cc = it.properties.get("eo:cloud_cover")
        print(f"  {it.id}  {it.datetime.isoformat()}  cloud={cc}%")

    best = items[0]
    visual = best.assets.get("visual")
    if visual is None:
        raise SystemExit("La escena ganadora no tiene asset 'visual'.")

    payload = {
        "id": best.id,
        "datetime": best.datetime.isoformat(),
        "cloud_cover": best.properties.get("eo:cloud_cover"),
        "bbox": list(best.bbox) if best.bbox else BBOX,
        "visual_cog": visual.href,
        "preview": (best.assets.get("thumbnail") or visual).href,
        "stac_url": STAC_URL,
        "collection": COLLECTION,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"---\nGuardado: {OUT.relative_to(ROOT)}")
    print(f"COG visual: {payload['visual_cog']}")


if __name__ == "__main__":
    main()
