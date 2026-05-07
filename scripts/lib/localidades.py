"""Lectura del catálogo de localidades.

Fuente única: `data/localidades.json` en la raíz del repo. El frontend lo
importa vía alias `@data/localidades.json` (ver `web/tsconfig.json`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
LOCALIDADES_JSON = ROOT / "data" / "localidades.json"


@dataclass(frozen=True)
class Localidad:
    slug: str
    name: str
    municipio: str
    estado_mx: str
    center: tuple[float, float]
    zoom: int
    bbox: tuple[float, float, float, float]


def load_localidades() -> list[Localidad]:
    raw = json.loads(LOCALIDADES_JSON.read_text())
    out: list[Localidad] = []
    for r in raw:
        out.append(
            Localidad(
                slug=r["slug"],
                name=r["name"],
                municipio=r["municipio"],
                estado_mx=r["estado_mx"],
                center=tuple(r["center"]),
                zoom=int(r["zoom"]),
                bbox=tuple(r["bbox"]),
            )
        )
    return out


def union_bbox(localidades: list[Localidad]) -> tuple[float, float, float, float]:
    """Bbox envolvente de todas las localidades — para queries Overpass únicas."""
    lon_min = min(l.bbox[0] for l in localidades)
    lat_min = min(l.bbox[1] for l in localidades)
    lon_max = max(l.bbox[2] for l in localidades)
    lat_max = max(l.bbox[3] for l in localidades)
    return (lon_min, lat_min, lon_max, lat_max)


def assign_localidad(lon: float, lat: float, localidades: list[Localidad]) -> str | None:
    """Devuelve el slug de la primera localidad cuyo bbox contiene el punto."""
    for loc in localidades:
        w, s, e, n = loc.bbox
        if w <= lon <= e and s <= lat <= n:
            return loc.slug
    return None
