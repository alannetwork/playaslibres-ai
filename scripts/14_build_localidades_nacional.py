#!/usr/bin/env python3
"""Genera el catálogo NACIONAL de localidades para la navegación del frontend,
derivándolo de los atributos de la ZOFEMAT nacional (data/processed/zofemat_mx.geojson)
y de las delimitaciones históricas (data/processed/zofemat_hist.geojson, si existe).

Agrupa por (ESTADO, MUNICIPIO) — con clave normalizada sin acentos, porque los
consolidados vienen en mayúsculas sin acento ("MAZATLAN") y la jerarquía del
MapServer histórico con acento ("Mazatlán") —, calcula bbox/centro/zoom desde
la geometría real de cada grupo, separa los años consolidados (`anios`, alimenta
los botones del YearSelector) de los históricos (`anios_hist`, sólo informativos)
y marca cuáles municipios tienen un caso CURADO (los de data/localidades.json,
p.ej. Las Cocinas en Bahía de Banderas).

IMPORTANTE: NO toca data/localidades.json. Ese archivo sigue siendo la fuente
curada de 3 localidades que consume el pipeline de Bahía de Banderas
(scripts 12/13, lib/localidades.py). Este catálogo nacional es un archivo
separado (data/localidades_mx.json) que sólo consume la navegación del
frontend.

Uso:
    python scripts/14_build_localidades_nacional.py
"""

from __future__ import annotations

import json
import math
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "processed" / "zofemat_mx.geojson"
SRC_HIST = ROOT / "data" / "processed" / "zofemat_hist.geojson"
CURATED = ROOT / "data" / "localidades.json"
OUT = ROOT / "data" / "localidades_mx.json"


def slugify(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text)
    ascii_text = norm.encode("ascii", "ignore").decode("ascii").lower()
    out = []
    prev_dash = False
    for ch in ascii_text:
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return "".join(out).strip("-")


_SMALL = {"de", "del", "la", "las", "los", "el", "y", "a"}


def title_case(text: str) -> str:
    words = text.lower().split()
    out = []
    for i, w in enumerate(words):
        out.append(w if (w in _SMALL and i > 0) else w.capitalize())
    return " ".join(out)


def iter_coords(geom: dict):
    """Itera vértices (lng, lat) de cualquier geometría Line/MultiLine."""
    coords = geom.get("coordinates") or []

    def walk(c):
        if c and isinstance(c[0], (int, float)):
            yield c[0], c[1]
        else:
            for sub in c:
                yield from walk(sub)

    yield from walk(coords)


def zoom_for_span(span_deg: float) -> int:
    """Zoom inicial razonable a partir del lado mayor del bbox (en grados)."""
    if span_deg <= 0:
        return 14
    # Aprox: a z ~ log2(360/span) el bbox llena el viewport; restamos margen.
    z = math.log2(360.0 / span_deg) - 0.5
    return max(9, min(15, round(z)))


def has_accents(text: str) -> bool:
    return unicodedata.normalize("NFKD", text) != text


def load_curated_municipios() -> set[str]:
    """Conjunto de municipios (normalizados) con caso curado."""
    if not CURATED.exists():
        return set()
    data = json.loads(CURATED.read_text())
    return {slugify(loc.get("municipio", "")) for loc in data if loc.get("municipio")}


def main() -> None:
    if not SRC.exists():
        raise SystemExit(
            f"Falta {SRC.relative_to(ROOT)}. Corre primero "
            "scripts/01b_download_zofemat_nacional.py"
        )

    curated = load_curated_municipios()

    # clave normalizada (slug_estado, slug_municipio) -> acumuladores
    groups: dict[tuple[str, str], dict] = defaultdict(
        lambda: {
            "estado": "",
            "municipio": "",
            "minx": math.inf,
            "miny": math.inf,
            "maxx": -math.inf,
            "maxy": -math.inf,
            "count": 0,
            "count_hist": 0,
            "anios": set(),
            "anios_hist": set(),
        }
    )

    def accumulate(fc: dict, historico: bool) -> None:
        for feat in fc.get("features", []):
            props = feat.get("properties") or {}
            estado = (props.get("ESTADO") or "").strip()
            municipio = (props.get("MUNICIPIO") or "").strip()
            if not estado or not municipio:
                continue
            g = groups[(slugify(estado), slugify(municipio))]
            # Preferir el nombre con acentos (jerarquía del MapServer histórico,
            # "MAZATLÁN") sobre el consolidado sin acentos ("MAZATLAN").
            for key, val in (("estado", estado), ("municipio", municipio)):
                cur = g[key]
                if not cur or (has_accents(val) and not has_accents(cur)):
                    g[key] = val
            if historico:
                g["count_hist"] += 1
                if props.get("anio") is not None:
                    g["anios_hist"].add(int(props["anio"]))
            else:
                g["count"] += 1
                if props.get("anio") is not None:
                    g["anios"].add(int(props["anio"]))
            geom = feat.get("geometry") or {}
            for x, y in iter_coords(geom):
                g["minx"] = min(g["minx"], x)
                g["miny"] = min(g["miny"], y)
                g["maxx"] = max(g["maxx"], x)
                g["maxy"] = max(g["maxy"], y)

    accumulate(json.loads(SRC.read_text()), historico=False)
    if SRC_HIST.exists():
        accumulate(json.loads(SRC_HIST.read_text()), historico=True)
    else:
        print(f"AVISO: no existe {SRC_HIST.relative_to(ROOT)}; catálogo sólo con consolidados.")

    # Display de estado unificado por slug: los consolidados vienen sin acentos
    # ("YUCATAN") y la jerarquía histórica con acentos ("Yucatán"); sin esto un
    # mismo estado aparecería duplicado en la navegación del frontend.
    estado_display: dict[str, str] = {}
    for g in groups.values():
        e = g["estado"]
        k = slugify(e)
        cur = estado_display.get(k)
        if not cur or (has_accents(e) and not has_accents(cur)):
            estado_display[k] = e

    catalog: list[dict] = []
    for _key, g in groups.items():
        estado, municipio = estado_display[slugify(g["estado"])], g["municipio"]
        if not math.isfinite(g["minx"]):
            continue
        bbox = [
            round(g["minx"], 5),
            round(g["miny"], 5),
            round(g["maxx"], 5),
            round(g["maxy"], 5),
        ]
        center = [
            round((bbox[0] + bbox[2]) / 2, 5),
            round((bbox[1] + bbox[3]) / 2, 5),
        ]
        span = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
        catalog.append(
            {
                "slug": f"{slugify(estado)}--{slugify(municipio)}",
                "estado": title_case(estado),
                "municipio": title_case(municipio),
                "name": title_case(municipio),
                "center": center,
                "bbox": bbox,
                "zoom": zoom_for_span(span),
                "anios": sorted(g["anios"]),
                "anios_hist": sorted(g["anios_hist"]),
                "feature_count": g["count"],
                "feature_count_hist": g["count_hist"],
                "curada": slugify(municipio) in curated,
            }
        )

    # Orden estable: estado, luego municipio.
    catalog.sort(key=lambda c: (c["estado"], c["municipio"]))

    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))

    estados = sorted({c["estado"] for c in catalog})
    curadas = [c["slug"] for c in catalog if c["curada"]]
    print(f"Catálogo: {OUT.relative_to(ROOT)}")
    print(f"  municipios: {len(catalog)}")
    print(f"  estados   : {len(estados)} -> {', '.join(estados)}")
    print(f"  curados   : {curadas}")


if __name__ == "__main__":
    main()
