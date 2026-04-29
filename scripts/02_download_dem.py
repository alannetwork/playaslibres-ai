#!/usr/bin/env python3
"""Descarga el tile Copernicus DEM 30 m que cubre Bahía de Banderas y lo recorta
al bbox de la bahía. Idempotente.

Uso:
    python scripts/02_download_dem.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "dem"
RAW = RAW_DIR / "cop30_n20w106.tif"
PROCESSED = ROOT / "data" / "processed" / "dem_bb.tif"

URL = (
    "https://copernicus-dem-30m.s3.amazonaws.com/"
    "Copernicus_DSM_COG_10_N20_00_W106_00_DEM/"
    "Copernicus_DSM_COG_10_N20_00_W106_00_DEM.tif"
)

# BBox Bahía de Banderas: lon_min lat_min lon_max lat_max
BBOX = (-105.65, 20.50, -105.15, 20.85)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"Ya existe {dest.relative_to(ROOT)} ({dest.stat().st_size/1e6:.1f} MB), reuso.")
        return
    print(f"Descargando {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            total = 0
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)
                    total += len(chunk)
            print(f"  bajados {total/1e6:.1f} MB")


def gdalinfo_summary(tif: Path) -> None:
    out = subprocess.run(
        ["gdalinfo", "-stats", str(tif)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    width = height = mn = mx = "?"
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("Size is"):
            parts = line.replace("Size is", "").strip().split(",")
            width = parts[0].strip()
            height = parts[1].strip()
        elif "STATISTICS_MINIMUM=" in line:
            mn = line.split("=", 1)[1]
        elif "STATISTICS_MAXIMUM=" in line:
            mx = line.split("=", 1)[1]
    print(f"Dimensiones: {width} x {height} px")
    print(f"Elevación  : {mn} a {mx} m")
    print(f"Tamaño     : {tif.stat().st_size/1e6:.1f} MB")


def main() -> None:
    PROCESSED.parent.mkdir(parents=True, exist_ok=True)
    download(URL, RAW)

    if PROCESSED.exists():
        print(f"Sobreescribiendo {PROCESSED.relative_to(ROOT)}")
        PROCESSED.unlink()

    print(f"Recortando a bbox {BBOX} con gdalwarp...")
    subprocess.run(
        [
            "gdalwarp",
            "-te",
            str(BBOX[0]),
            str(BBOX[1]),
            str(BBOX[2]),
            str(BBOX[3]),
            "-t_srs",
            "EPSG:4326",
            "-of",
            "COG",
            "-co",
            "COMPRESS=DEFLATE",
            str(RAW),
            str(PROCESSED),
        ],
        check=True,
    )
    print(f"Salida: {PROCESSED.relative_to(ROOT)}")
    print("---")
    gdalinfo_summary(PROCESSED)


if __name__ == "__main__":
    main()
