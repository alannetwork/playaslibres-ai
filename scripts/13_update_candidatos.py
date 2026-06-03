#!/usr/bin/env python3
"""Actualiza `web/public/data/candidatos.json` combinando dos fuentes:

    1. Detecciones automáticas OSM × franja federal (script 12).
       Lee `data/processed/invasiones_candidatas.geojson`.
    2. Adiciones manuales trazadas sobre imagery satelital.
       Lee `data/manual/candidatos_manuales.geojson`.
       Útil para construcciones que no están cartografiadas en OSM.

Para los manuales, calcula área total, área invadida y % invadido cruzando
con `playa_libre_bb.geojson` (misma lógica de severidad que el script 12).

Listas de curaduría opcionales:
    - `data/manual/candidatos_allowlist.txt` — ids (uno por línea) que SÍ
      deben aparecer aunque la salida automática los descarte.
    - `data/manual/candidatos_blocklist.txt` — ids que NO deben aparecer
      (ej.: falsos positivos, edificios con concesión vigente).

Uso:
    python scripts/13_update_candidatos.py
    python scripts/13_update_candidatos.py --top 50
    python scripts/13_update_candidatos.py --only-manual
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.localidades import assign_localidad, load_localidades

ROOT = Path(__file__).resolve().parent.parent
OSM_DETECTED = ROOT / "data" / "processed" / "invasiones_candidatas.geojson"
MANUAL = ROOT / "data" / "manual" / "candidatos_manuales.geojson"
PLAYA_LIBRE = ROOT / "data" / "processed" / "playa_libre_bb.geojson"
ALLOWLIST = ROOT / "data" / "manual" / "candidatos_allowlist.txt"
BLOCKLIST = ROOT / "data" / "manual" / "candidatos_blocklist.txt"
OUT_JSON = ROOT / "web" / "public" / "data" / "candidatos.json"

CRS_UTM = "EPSG:32613"
CRS_WGS = "EPSG:4326"

PCT_ROJO = 50.0
PCT_AMBAR = 10.0
DEFAULT_MIN_AREA_M2 = 25.0
DEFAULT_BUFFER_M = 10.0


def read_id_list(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def score_manuales(
    manuales: gpd.GeoDataFrame,
    franja: gpd.GeoDataFrame,
    min_area: float,
    buffer_m: float,
) -> gpd.GeoDataFrame:
    """Calcula área invadida + severidad para los polígonos manuales."""
    if manuales.empty:
        return manuales

    m_utm = manuales.to_crs(CRS_UTM)
    f_utm = franja.to_crs(CRS_UTM)
    franja_union = unary_union(f_utm.geometry.values)
    franja_buffered = franja_union.buffer(buffer_m)

    m_utm["area_total_m2"] = m_utm.geometry.area.round(1)
    m_utm = m_utm[m_utm["area_total_m2"] >= min_area].copy()

    inter = m_utm.geometry.intersection(franja_union)
    inter_buf = m_utm.geometry.intersection(franja_buffered)

    m_utm["area_invadida_m2"] = inter.area.round(1)
    m_utm["area_invadida_buf_m2"] = inter_buf.area.round(1)
    m_utm["pct_invadido"] = (
        m_utm["area_invadida_m2"] / m_utm["area_total_m2"] * 100
    ).round(1)
    m_utm["pct_invadido_buf"] = (
        m_utm["area_invadida_buf_m2"] / m_utm["area_total_m2"] * 100
    ).round(1)

    def clasificar(r) -> str | None:
        if r["pct_invadido"] >= PCT_ROJO:
            return "roja"
        if r["pct_invadido"] >= PCT_AMBAR:
            return "ambar"
        if r["pct_invadido_buf"] >= 95.0:
            return "ambar"
        return None

    m_utm["severidad"] = m_utm.apply(clasificar, axis=1)
    keep = m_utm[m_utm["severidad"].notna()].copy()

    cent_utm = keep.geometry.centroid
    cent_wgs = gpd.GeoSeries(cent_utm, crs=CRS_UTM).to_crs(CRS_WGS)
    keep["lon"] = cent_wgs.x.round(6)
    keep["lat"] = cent_wgs.y.round(6)

    return keep.to_crs(CRS_WGS)


def to_record(row, source: str) -> dict:
    """Convierte una fila de GeoDataFrame al formato que consume el frontend."""
    if source == "osm":
        ident = row["osm_id"]
    else:
        ident = f"manual/{row['manual_id']}"
    loc = row.get("localidad") if hasattr(row, "get") else None
    if not isinstance(loc, str) or not loc:
        loc = None
    return {
        "id": ident.replace("/", "-"),
        "osm_id": ident,
        "name": row.get("name") if isinstance(row.get("name"), str) else None,
        "coords": [float(row["lon"]), float(row["lat"])],
        "severidad": row["severidad"],
        "building": row.get("building") or "yes",
        "area_total_m2": float(round(row["area_total_m2"], 1)),
        "area_invadida_m2": float(round(row["area_invadida_m2"], 1)),
        "pct_invadido": float(round(row["pct_invadido"], 1)),
        "source": source,
        "localidad": loc,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--top",
        type=int,
        default=None,
        help=(
            "Limitar a N candidatos OSM por localidad (ordenados por área "
            "invadida desc). Si no hay localidades en la fuente, aplica global."
        ),
    )
    ap.add_argument(
        "--only-manual",
        action="store_true",
        help="Ignorar detecciones OSM (útil para validar manuales).",
    )
    ap.add_argument("--min-area", type=float, default=DEFAULT_MIN_AREA_M2)
    ap.add_argument("--buffer", type=float, default=DEFAULT_BUFFER_M)
    args = ap.parse_args()

    if not PLAYA_LIBRE.exists():
        sys.exit(f"Falta {PLAYA_LIBRE.relative_to(ROOT)}. Corre 08_compute_playa_libre.py primero.")
    franja = gpd.read_file(PLAYA_LIBRE)

    allow = read_id_list(ALLOWLIST)
    block = read_id_list(BLOCKLIST)

    records: list[dict] = []

    # 1) OSM
    if not args.only_manual and OSM_DETECTED.exists():
        osm = gpd.read_file(OSM_DETECTED)
        if args.top is not None:
            if "localidad" in osm.columns and osm["localidad"].notna().any():
                # Top-N por localidad: que PV no canibalice el cupo de PM.
                osm = (
                    osm.sort_values("area_invadida_m2", ascending=False)
                    .groupby("localidad", group_keys=False, dropna=False)
                    .head(args.top)
                )
            else:
                osm = osm.sort_values("area_invadida_m2", ascending=False).head(args.top)
        for _, r in osm.iterrows():
            if r["osm_id"] in block:
                continue
            records.append(to_record(r, "osm"))
        print(f"  OSM: {len(records)} candidatos incorporados")
    elif args.only_manual:
        print("  --only-manual activo: se omiten detecciones OSM")
    else:
        print(f"  AVISO: {OSM_DETECTED.relative_to(ROOT)} no existe; corre script 12 primero")

    # 2) Manuales
    if MANUAL.exists():
        manuales_raw = gpd.read_file(MANUAL)
        scored = score_manuales(manuales_raw, franja, args.min_area, args.buffer)
        if not scored.empty:
            localidades = load_localidades()
            scored["localidad"] = [
                assign_localidad(lon, lat, localidades)
                for lon, lat in zip(scored["lon"], scored["lat"])
            ]
        added = 0
        for _, r in scored.iterrows():
            mid = f"manual/{r['manual_id']}"
            if mid in block:
                continue
            records.append(to_record(r, "manual"))
            added += 1
        print(f"  Manuales: {added} candidatos incorporados (de {len(manuales_raw)} polígonos)")
    else:
        print(f"  (sin {MANUAL.relative_to(ROOT)})")

    # 3) Allowlist override (si un id está en allowlist y por algún motivo no
    #    quedó en records, se loguea — la inclusión efectiva requiere que el
    #    polígono esté en alguno de los dos archivos fuente).
    in_records = {r["osm_id"] for r in records}
    missing_allowed = allow - in_records
    if missing_allowed:
        print(f"  AVISO: allowlist con ids no encontrados: {missing_allowed}")

    # 4) Deduplicar por osm_id
    seen = set()
    deduped: list[dict] = []
    for r in records:
        if r["osm_id"] in seen:
            continue
        seen.add(r["osm_id"])
        deduped.append(r)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(deduped, indent=2, ensure_ascii=False))
    sev_counts = {"roja": 0, "ambar": 0}
    src_counts = {"osm": 0, "manual": 0}
    for r in deduped:
        sev_counts[r["severidad"]] = sev_counts.get(r["severidad"], 0) + 1
        src_counts[r["source"]] = src_counts.get(r["source"], 0) + 1
    print(
        f"  Total {len(deduped)} en {OUT_JSON.relative_to(ROOT)} "
        f"(rojas={sev_counts['roja']}, ambar={sev_counts['ambar']}, "
        f"osm={src_counts['osm']}, manual={src_counts['manual']})"
    )


if __name__ == "__main__":
    main()
