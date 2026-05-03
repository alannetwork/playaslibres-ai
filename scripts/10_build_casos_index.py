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


def fecha_sort_key(fecha: object) -> str:
    """Devuelve una clave string ordenable cronológicamente (ascendente).
    Acepta date, datetime, int (año), o string en YYYY[-MM[-DD]]. Si la fecha
    no tiene mes/día, se rellena con 01 para ordenar consistente.
    """
    if isinstance(fecha, datetime):
        return fecha.date().isoformat()
    if isinstance(fecha, date):
        return fecha.isoformat()
    if isinstance(fecha, int):
        return f"{fecha:04d}-01-01"
    if isinstance(fecha, str):
        parts = fecha.split("-")
        y = parts[0].zfill(4)
        m = (parts[1] if len(parts) > 1 else "01").zfill(2)
        d = (parts[2] if len(parts) > 2 else "01").zfill(2)
        return f"{y}-{m}-{d}"
    return "9999-12-31"


def build_timeline(fuentes: list, expedientes: list) -> list:
    """Combina fuentes y expedientes en una línea de tiempo cronológica.
    Cada entrada lleva `origen` ('fuente'|'expediente') para distinguirlas.
    """
    eventos = []
    for f in fuentes or []:
        eventos.append(
            {
                "fecha": f.get("fecha"),
                "tipo": f.get("tipo"),
                "titulo": f.get("titulo"),
                "descripcion": f.get("descripcion"),
                "url": f.get("url"),
                "medio": f.get("medio"),
                "autoridad": f.get("autoridad"),
                "origen": "fuente",
            }
        )
    for e in expedientes or []:
        eventos.append(
            {
                "fecha": e.get("fecha"),
                "tipo": e.get("tipo"),
                "titulo": e.get("descripcion") or e.get("tipo"),
                "descripcion": e.get("descripcion"),
                "url": e.get("url"),
                "autoridad": e.get("autoridad"),
                "referencia": e.get("referencia"),
                "origen": "expediente",
            }
        )
    eventos.sort(key=lambda x: fecha_sort_key(x.get("fecha")))
    return eventos


def extract_zofemat_features(pol_path: Path) -> list[dict]:
    """Extrae propiedades atómicas de cada feature de poligono.geojson para
    poder mostrarlas en una tabla en el frontend (plano, capa, fecha lev., etc).
    """
    if not pol_path.exists():
        return []
    try:
        gj = json.loads(pol_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if gj.get("type") == "FeatureCollection":
        feats = gj.get("features") or []
    elif gj.get("type") == "Feature":
        feats = [gj]
    else:
        return []
    out = []
    for f in feats:
        props = f.get("properties") or {}
        out.append(
            {
                "objectid": props.get("OBJECTID"),
                "plano": props.get("PLANO"),
                "layer": props.get("Layer"),
                "fecha_lev": props.get("FECHA_LEV"),
                "escala": props.get("ESCALA"),
                "proyeccion": props.get("PROYECCION"),
            }
        )
    return out


def build_entry(slug_dir: Path) -> dict:
    fm = validator.validate_caso(slug_dir)
    pol_path = slug_dir / "poligono.geojson"
    cambios_path = slug_dir / "cambios.json"

    cambios = None
    if cambios_path.exists():
        try:
            cambios = json.loads(cambios_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cambios = None

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
        "marco_legal": fm.get("marco_legal", []),
        "poligono_zofemat_objectids": fm.get("poligono_zofemat_objectids", []),
        "zofemat_features": extract_zofemat_features(pol_path),
        "coords_bbox": fm.get("coords_bbox"),
        "timeline": build_timeline(
            fm.get("fuentes", []), fm.get("expediente_oficial", [])
        ),
        "cambios": cambios,
        "has_poligono": pol_path.exists(),
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
