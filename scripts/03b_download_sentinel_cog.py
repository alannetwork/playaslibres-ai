#!/usr/bin/env python3
"""Descarga el COG Sentinel-2 RGB recortado al bbox de Bahía de Banderas.

Usa HTTP range requests vía /vsicurl para no bajar la escena entera (10980x10980)
sino sólo el recorte (~5200x3900). Sirve como respaldo local en caso de que
TiTiler.xyz o el COG remoto en AWS Open Data se caigan.

Salida:
    data/processed/sentinel_bb.tif  (~2 MB con compresión JPEG)

Uso:
    python scripts/03b_download_sentinel_cog.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
META = ROOT / "web" / "public" / "data" / "sentinel_base.json"
OUT = ROOT / "data" / "processed" / "sentinel_bb.tif"

BBOX = (-105.65, 20.85, -105.15, 20.50)  # ulx, uly, lrx, lry para projwin


def main():
    if not META.exists():
        sys.exit(
            f"Falta {META}. Corre primero scripts/03_find_sentinel.py para "
            "elegir la mejor escena Sentinel-2 disponible."
        )
    meta = json.loads(META.read_text())
    cog_url = meta.get("visual_cog")
    if not cog_url:
        sys.exit("sentinel_base.json no tiene visual_cog")

    print(f"COG remoto: {cog_url}")
    print(f"BBox       : {BBOX}")
    OUT.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "gdal_translate",
        "-projwin", str(BBOX[0]), str(BBOX[1]), str(BBOX[2]), str(BBOX[3]),
        "-projwin_srs", "EPSG:4326",
        "-of", "COG",
        "-co", "COMPRESS=JPEG",
        "-co", "QUALITY=85",
        f"/vsicurl/{cog_url}",
        str(OUT),
    ]
    subprocess.run(cmd, check=True)
    print(f"\nGuardado: {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
