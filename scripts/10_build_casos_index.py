#!/usr/bin/env python3
"""Construye el índice JSON que el frontend consume desde casos/<slug>/caso.mdx.

Genera:
    web/public/data/casos.json   — lista resumida de casos para el panel del mapa

No sobrescribe `web/public/data/disputas.json` (legado). Quien migre el frontend
puede después borrar disputas.json.

Uso:
    python scripts/10_build_casos_index.py
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASOS_DIR = ROOT / "casos"
OUT = ROOT / "web" / "public" / "data" / "casos.json"

sys.path.insert(0, str(ROOT / "scripts"))
from importlib import import_module  # noqa: E402

validator = import_module("09_validate_casos")


def to_jsonable(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_jsonable(v) for v in obj]
    return obj


def build_entry(slug_dir: Path) -> dict:
    fm = validator.validate_caso(slug_dir)
    pol_path = slug_dir / "poligono.geojson"
    timeline_path = slug_dir / "timeline.mdx"
    cambios_path = slug_dir / "cambios.json"

    entry = {
        "slug": fm["slug"],
        "name": fm["nombre"],
        "estado": fm["estado"],
        "coords": [fm["ubicacion"]["lon"], fm["ubicacion"]["lat"]],
        "ubicacion": fm["ubicacion"],
        "summary": fm["resumen"],
        "fecha_apertura": fm["fecha_apertura"],
        "ultima_actualizacion": fm["ultima_actualizacion"],
        "responsable_presunto": fm.get("responsable_presunto"),
        "expediente_oficial": fm.get("expediente_oficial", []),
        "fuentes": fm["fuentes"],
        "poligono_zofemat_objectids": fm.get("poligono_zofemat_objectids", []),
        "coords_bbox": fm.get("coords_bbox"),
        "has_poligono": pol_path.exists(),
        "has_timeline": timeline_path.exists(),
        "has_cambios": cambios_path.exists(),
        "contribuyente": fm.get("contribuyente"),
    }
    return to_jsonable(entry)


def main() -> int:
    if not CASOS_DIR.exists():
        print(f"No existe {CASOS_DIR}", file=sys.stderr)
        return 1

    dirs = [d for d in sorted(CASOS_DIR.iterdir()) if d.is_dir() and (d / "caso.mdx").exists()]
    entries = [build_entry(d) for d in dirs]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
    print(f"Generado {OUT.relative_to(ROOT)} con {len(entries)} caso(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
