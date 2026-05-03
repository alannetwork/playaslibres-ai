#!/usr/bin/env python3
"""Genera `casos/<slug>/cambios.json` con escenas Sentinel-2 antes/después del
periodo del caso, para inspección visual de change detection.

NO descarga las escenas — solo lista metadata + COG URLs públicas y arma un
link a EO-Browser para inspección rápida. El frontend usa esto para mostrar
una sección "Cambios satelitales" en el dossier del caso.

Uso:
    python scripts/11_change_detection.py                # todos
    python scripts/11_change_detection.py las-cocinas    # solo uno

Requiere: pystac-client (ver requirements.txt). Si la API STAC no responde,
el script no falla: emite un cambios.json mínimo con solo el link a EO-Browser.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASOS_DIR = ROOT / "casos"

sys.path.insert(0, str(ROOT / "scripts"))
from importlib import import_module  # noqa: E402

validator = import_module("09_validate_casos")

STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
MAX_CLOUD_COVER = 30.0  # %, descartar escenas más nubladas
WINDOW_BEFORE_DAYS = 365  # buscar "antes" hasta 1 año previo
WINDOW_AFTER_DAYS = 90  # y "después" hasta 90 días posterior
MAX_SCENES_PER_PERIOD = 5


def parse_fecha(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, int) and 1900 <= value <= 2100:
        return date(value, 1, 1)
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def eo_browser_url(lat: float, lon: float, fecha: date) -> str:
    return (
        "https://apps.sentinel-hub.com/eo-browser/?"
        f"lat={lat}&lng={lon}&zoom=17&time={fecha.isoformat()}"
        "&datasetId=S2L2A&visualizationUrl=https%3A%2F%2Fservices.sentinel-hub.com%2Fogc%2Fwms%2Fbd86bcc0-f318-402b-a145-015f85b9427e"
        "&layerId=1_TRUE_COLOR"
    )


def query_stac(bbox: list[float], date_from: date, date_to: date) -> list[dict]:
    try:
        from pystac_client import Client
    except ImportError:
        print(
            "  ⚠ pystac-client no instalado; salteando consulta STAC",
            file=sys.stderr,
        )
        return []
    try:
        client = Client.open(STAC_URL)
        search = client.search(
            collections=[COLLECTION],
            bbox=bbox,
            datetime=f"{date_from.isoformat()}/{date_to.isoformat()}",
            query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
            max_items=20,
            sortby=[{"field": "properties.datetime", "direction": "asc"}],
        )
        items = list(search.items())
    except Exception as e:  # noqa: BLE001
        print(f"  ⚠ STAC falló: {e}", file=sys.stderr)
        return []

    out = []
    for it in items[:MAX_SCENES_PER_PERIOD]:
        visual = it.assets.get("visual")
        thumb = it.assets.get("thumbnail")
        out.append(
            {
                "id": it.id,
                "datetime": it.properties.get("datetime"),
                "cloud_cover": it.properties.get("eo:cloud_cover"),
                "visual_cog": visual.href if visual else None,
                "thumbnail": thumb.href if thumb else None,
            }
        )
    return out


def build_cambios(slug_dir: Path, fm: dict) -> dict | None:
    bbox = fm.get("coords_bbox")
    if not bbox:
        # Sin bbox no podemos hacer query satelital razonable.
        # Generamos solo el link EO-Browser centrado en ubicacion.
        ub = fm["ubicacion"]
        fecha = parse_fecha(fm["fecha_apertura"]) or date.today()
        return {
            "queried_at": datetime.now(timezone.utc).isoformat(),
            "bbox": None,
            "antes": [],
            "despues": [],
            "eo_browser": {
                "antes_url": eo_browser_url(
                    ub["lat"], ub["lon"], fecha - timedelta(days=180)
                ),
                "despues_url": eo_browser_url(ub["lat"], ub["lon"], fecha),
            },
            "nota": (
                "Sin coords_bbox en el caso; no se hizo query STAC. "
                "Los enlaces EO-Browser usan la ubicación puntual."
            ),
        }

    fecha = parse_fecha(fm["fecha_apertura"])
    if fecha is None:
        return None

    antes = query_stac(
        bbox, fecha - timedelta(days=WINDOW_BEFORE_DAYS), fecha - timedelta(days=1)
    )
    despues = query_stac(
        bbox, fecha, fecha + timedelta(days=WINDOW_AFTER_DAYS)
    )

    ub = fm["ubicacion"]
    return {
        "queried_at": datetime.now(timezone.utc).isoformat(),
        "bbox": bbox,
        "ventana": {
            "antes_dias": WINDOW_BEFORE_DAYS,
            "despues_dias": WINDOW_AFTER_DAYS,
            "max_cloud_cover": MAX_CLOUD_COVER,
        },
        "antes": antes,
        "despues": despues,
        "eo_browser": {
            "antes_url": eo_browser_url(
                ub["lat"], ub["lon"], fecha - timedelta(days=180)
            ),
            "despues_url": eo_browser_url(ub["lat"], ub["lon"], fecha),
        },
    }


def main() -> int:
    if not CASOS_DIR.exists():
        print(f"No existe {CASOS_DIR}", file=sys.stderr)
        return 1

    if len(sys.argv) > 1:
        targets = [CASOS_DIR / a for a in sys.argv[1:]]
    else:
        targets = [
            d for d in sorted(CASOS_DIR.iterdir())
            if d.is_dir() and (d / "caso.mdx").exists()
        ]

    if not targets:
        print("No hay casos.", file=sys.stderr)
        return 0

    for d in targets:
        print(f"→ {d.name}")
        fm = validator.validate_caso(d)
        cambios = build_cambios(d, fm)
        if cambios is None:
            print(f"  (sin fecha_apertura válida; salteado)")
            continue
        out = d / "cambios.json"
        out.write_text(
            json.dumps(cambios, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        n_a = len(cambios.get("antes") or [])
        n_d = len(cambios.get("despues") or [])
        print(f"  {n_a} escena(s) antes · {n_d} después → {out.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
