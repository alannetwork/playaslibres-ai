#!/usr/bin/env python3
"""Valida los dossiers de `casos/<slug>/caso.mdx` contra el schema documentado
en `casos/SCHEMA.md`. Sale con código != 0 si encuentra errores. Apto para CI.

Uso:
    python scripts/09_validate_casos.py                # valida todos
    python scripts/09_validate_casos.py las-cocinas    # solo uno
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit(
        "Falta PyYAML. Instala con: pip install 'pyyaml>=6'  "
        "(o agrega a requirements.txt)"
    )

ROOT = Path(__file__).resolve().parent.parent
CASOS_DIR = ROOT / "casos"

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
ESTADOS = {"en_conflicto", "suspendido", "resuelto", "archivado"}
TIPOS_RESPONSABLE = {
    "desarrollo_inmobiliario",
    "concesionario",
    "particular",
    "desconocido",
}
TIPOS_FUENTE = {"prensa", "oficial", "redes", "testimonio", "foto", "video", "documento"}
TIPOS_EXPEDIENTE = {
    "suspension_temporal",
    "clausura",
    "concesion",
    "denuncia",
    "resolucion",
    "otro",
}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


class CasoError(Exception):
    pass


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise CasoError(f"{path}: no tiene frontmatter YAML al inicio")
    fm_raw = m.group(1)
    body = text[m.end():]
    try:
        fm = yaml.safe_load(fm_raw)
    except yaml.YAMLError as e:
        raise CasoError(f"{path}: frontmatter YAML inválido: {e}")
    if not isinstance(fm, dict):
        raise CasoError(f"{path}: frontmatter debe ser un objeto YAML")
    return fm, body


def require(d: dict, key: str, ctx: str) -> object:
    if key not in d or d[key] in (None, "", []):
        raise CasoError(f"{ctx}: falta campo requerido '{key}'")
    return d[key]


def check_date(value: object, ctx: str) -> None:
    if isinstance(value, (date, datetime)):
        return
    if isinstance(value, int):
        if 1900 <= value <= 2100:
            return
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
            try:
                datetime.strptime(value, fmt)
                return
            except ValueError:
                continue
    raise CasoError(f"{ctx}: fecha inválida {value!r} (usa YYYY-MM-DD, YYYY-MM o YYYY)")


def check_url(value: object, ctx: str) -> None:
    if not isinstance(value, str) or not value.startswith(("http://", "https://")):
        raise CasoError(f"{ctx}: URL inválida {value!r}")


def validate_fuentes(fuentes: object, ctx: str) -> None:
    if not isinstance(fuentes, list) or len(fuentes) == 0:
        raise CasoError(f"{ctx}: 'fuentes' debe ser lista no vacía")
    for i, f in enumerate(fuentes):
        c = f"{ctx}.fuentes[{i}]"
        if not isinstance(f, dict):
            raise CasoError(f"{c}: debe ser objeto")
        tipo = require(f, "tipo", c)
        if tipo not in TIPOS_FUENTE:
            raise CasoError(f"{c}.tipo: '{tipo}' no en {sorted(TIPOS_FUENTE)}")
        require(f, "titulo", c)
        check_date(require(f, "fecha", c), f"{c}.fecha")
        if tipo == "prensa":
            require(f, "medio", c)
            check_url(require(f, "url", c), f"{c}.url")
        elif tipo == "oficial":
            require(f, "autoridad", c)
            check_url(require(f, "url", c), f"{c}.url")
        elif tipo == "testimonio":
            pass  # url opcional
        else:
            check_url(require(f, "url", c), f"{c}.url")


def validate_expediente(items: object, ctx: str) -> None:
    if items in (None, []):
        return
    if not isinstance(items, list):
        raise CasoError(f"{ctx}: debe ser lista")
    for i, e in enumerate(items):
        c = f"{ctx}[{i}]"
        if not isinstance(e, dict):
            raise CasoError(f"{c}: debe ser objeto")
        tipo = require(e, "tipo", c)
        if tipo not in TIPOS_EXPEDIENTE:
            raise CasoError(f"{c}.tipo: '{tipo}' no en {sorted(TIPOS_EXPEDIENTE)}")
        require(e, "autoridad", c)
        check_date(require(e, "fecha", c), f"{c}.fecha")


def validate_caso(slug_dir: Path) -> dict:
    caso_path = slug_dir / "caso.mdx"
    if not caso_path.exists():
        raise CasoError(f"{slug_dir}: falta caso.mdx")
    fm, _body = parse_frontmatter(caso_path)
    ctx = f"casos/{slug_dir.name}/caso.mdx"

    slug = require(fm, "slug", ctx)
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        raise CasoError(f"{ctx}.slug: '{slug}' no cumple [a-z0-9-]+")
    if slug != slug_dir.name:
        raise CasoError(f"{ctx}.slug: '{slug}' no coincide con dir '{slug_dir.name}'")

    require(fm, "nombre", ctx)
    estado = require(fm, "estado", ctx)
    if estado not in ESTADOS:
        raise CasoError(f"{ctx}.estado: '{estado}' no en {sorted(ESTADOS)}")

    ub = require(fm, "ubicacion", ctx)
    if not isinstance(ub, dict):
        raise CasoError(f"{ctx}.ubicacion: debe ser objeto")
    lat = require(ub, "lat", f"{ctx}.ubicacion")
    lon = require(ub, "lon", f"{ctx}.ubicacion")
    if not (isinstance(lat, (int, float)) and -90 <= lat <= 90):
        raise CasoError(f"{ctx}.ubicacion.lat fuera de rango: {lat}")
    if not (isinstance(lon, (int, float)) and -180 <= lon <= 180):
        raise CasoError(f"{ctx}.ubicacion.lon fuera de rango: {lon}")
    require(ub, "municipio", f"{ctx}.ubicacion")
    require(ub, "estado_mx", f"{ctx}.ubicacion")

    check_date(require(fm, "fecha_apertura", ctx), f"{ctx}.fecha_apertura")
    check_date(require(fm, "ultima_actualizacion", ctx), f"{ctx}.ultima_actualizacion")
    require(fm, "resumen", ctx)

    rp = fm.get("responsable_presunto")
    if rp not in (None, {}):
        if not isinstance(rp, dict):
            raise CasoError(f"{ctx}.responsable_presunto: debe ser objeto o null")
        require(rp, "nombre", f"{ctx}.responsable_presunto")
        tipo = require(rp, "tipo", f"{ctx}.responsable_presunto")
        if tipo not in TIPOS_RESPONSABLE:
            raise CasoError(
                f"{ctx}.responsable_presunto.tipo: '{tipo}' no en "
                f"{sorted(TIPOS_RESPONSABLE)}"
            )

    validate_fuentes(require(fm, "fuentes", ctx), ctx)
    validate_expediente(fm.get("expediente_oficial"), f"{ctx}.expediente_oficial")

    bbox = fm.get("coords_bbox")
    if bbox is not None:
        if (
            not isinstance(bbox, list)
            or len(bbox) != 4
            or not all(isinstance(x, (int, float)) for x in bbox)
        ):
            raise CasoError(f"{ctx}.coords_bbox: debe ser [lon_min,lat_min,lon_max,lat_max]")
        if not (bbox[0] < bbox[2] and bbox[1] < bbox[3]):
            raise CasoError(f"{ctx}.coords_bbox: orden inválido (min>max)")

    pol = slug_dir / "poligono.geojson"
    if pol.exists():
        try:
            gj = json.loads(pol.read_text())
        except json.JSONDecodeError as e:
            raise CasoError(f"{pol}: GeoJSON inválido: {e}")
        if gj.get("type") not in ("FeatureCollection", "Feature"):
            raise CasoError(f"{pol}: type debe ser FeatureCollection o Feature")

    return fm


def main() -> int:
    if not CASOS_DIR.exists():
        print(f"No existe {CASOS_DIR}", file=sys.stderr)
        return 1

    targets: list[Path]
    if len(sys.argv) > 1:
        targets = [CASOS_DIR / a for a in sys.argv[1:]]
    else:
        targets = [
            d for d in sorted(CASOS_DIR.iterdir())
            if d.is_dir() and (d / "caso.mdx").exists()
        ]

    if not targets:
        print("No hay casos que validar.", file=sys.stderr)
        return 0

    errors = 0
    for d in targets:
        try:
            validate_caso(d)
            print(f"OK    {d.relative_to(ROOT)}")
        except CasoError as e:
            print(f"FAIL  {e}", file=sys.stderr)
            errors += 1

    print("---")
    print(f"{len(targets) - errors}/{len(targets)} válidos")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
