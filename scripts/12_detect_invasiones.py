#!/usr/bin/env python3
"""Detecta candidatos de construcción dentro de la franja federal "playa libre".

Pipeline:
    1. Descarga huellas de edificios OSM via Overpass para el bbox indicado.
       (Microsoft Building Footprints opcional con --include-ms; ver README.)
    2. Reproyecta a UTM 13N (EPSG:32613) y calcula intersección con cada
       polígono de `data/processed/playa_libre_bb.geojson`.
    3. Clasifica cada edificio en una severidad según el % de su huella que
       cae dentro de la franja federal:
           - roja  : pct >= 50
           - ambar : 10 <= pct < 50  (también edificios totalmente dentro de
                                      buffer de +10 m de la franja)
           - verde : descartado (< 10 % o solo borde)
    4. Escribe `data/processed/invasiones_candidatas.geojson` (rojo + ámbar)
       y un reporte estático `data/processed/invasiones_candidatas.html` con
       thumbnails Esri/Sentinel y enlaces para revisión humana.

Uso:
    python scripts/12_detect_invasiones.py
    python scripts/12_detect_invasiones.py --bbox -105.55 20.75 -105.45 20.80
    python scripts/12_detect_invasiones.py --min-area 30 --buffer 15

Salidas auditables, NO publicar sin paso de verificación humana.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import requests
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.localidades import Localidad, assign_localidad, load_localidades, union_bbox

ROOT = Path(__file__).resolve().parent.parent
PLAYA_LIBRE = ROOT / "data" / "processed" / "playa_libre_bb.geojson"
OUT_GEOJSON = ROOT / "data" / "processed" / "invasiones_candidatas.geojson"
OUT_HTML = ROOT / "data" / "processed" / "invasiones_candidatas.html"
RAW_DIR = ROOT / "data" / "raw" / "buildings"

OVERPASS = "https://overpass-api.de/api/interpreter"
USER_AGENT = "playaslibres-ai/0.1 (https://github.com/playaslibres-mx)"

# UTM zona 13N — válida para Bahía de Banderas.
CRS_UTM = "EPSG:32613"
CRS_WGS = "EPSG:4326"

# Umbrales de severidad.
PCT_ROJO = 50.0
PCT_AMBAR = 10.0
# Edificios menores a este área (m²) se descartan: palapas, kioscos, sanitarios.
DEFAULT_MIN_AREA_M2 = 25.0
# Buffer (m) sobre la franja federal para absorber error de georreferencia.
DEFAULT_BUFFER_M = 10.0


def fetch_osm_buildings(bbox: tuple[float, float, float, float]) -> gpd.GeoDataFrame:
    """Descarga ways/relations con tag `building=*` desde Overpass."""
    lon_min, lat_min, lon_max, lat_max = bbox
    raw_path = RAW_DIR / f"osm_buildings_{lon_min}_{lat_min}_{lon_max}_{lat_max}.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    if raw_path.exists():
        print(f"  cache hit: {raw_path.relative_to(ROOT)}")
        data = json.loads(raw_path.read_text())
    else:
        q = f"""[out:json][timeout:90];
(
  way["building"]({lat_min},{lon_min},{lat_max},{lon_max});
  relation["building"]({lat_min},{lon_min},{lat_max},{lon_max});
);
out body; >; out skel qt;
"""
        print(f"  Overpass query bbox=({lon_min},{lat_min},{lon_max},{lat_max})")
        for attempt in range(3):
            try:
                r = requests.post(
                    OVERPASS,
                    data={"data": q},
                    headers={"User-Agent": USER_AGENT},
                    timeout=120,
                )
                r.raise_for_status()
                data = r.json()
                break
            except requests.RequestException as e:
                wait = 2 ** attempt * 5
                print(f"  intento {attempt+1} falló: {e}; reintentando en {wait}s")
                time.sleep(wait)
        else:
            sys.exit("  ERROR: Overpass no respondió tras 3 intentos.")
        raw_path.write_text(json.dumps(data))
        print(f"  guardado en {raw_path.relative_to(ROOT)}")

    return _osm_to_gdf(data)


def _osm_to_gdf(data: dict) -> gpd.GeoDataFrame:
    """Convierte respuesta Overpass JSON a GeoDataFrame de polígonos."""
    nodes = {e["id"]: (e["lon"], e["lat"]) for e in data["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in data["elements"] if e["type"] == "way"}

    feats: list[dict] = []
    for w in ways.values():
        if "tags" not in w or "building" not in w.get("tags", {}):
            continue
        coords = [nodes[nid] for nid in w["nodes"] if nid in nodes]
        if len(coords) < 4 or coords[0] != coords[-1]:
            # Cerrar ring si no está cerrado.
            if len(coords) >= 3:
                coords = coords + [coords[0]]
            else:
                continue
        try:
            poly = Polygon(coords)
        except Exception:
            continue
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty:
            continue
        tags = w["tags"]
        feats.append({
            "geometry": poly,
            "osm_id": f"way/{w['id']}",
            "building": tags.get("building", "yes"),
            "name": tags.get("name"),
            "amenity": tags.get("amenity"),
            "leisure": tags.get("leisure"),
            "tourism": tags.get("tourism"),
            "operator": tags.get("operator"),
            "start_date": tags.get("start_date"),
            "tags_json": json.dumps(tags, ensure_ascii=False),
        })

    # NOTA: las relaciones (multipolígonos) no se procesan en esta versión PoC.
    # Cubren < 1% de edificios costeros típicos; agregar si hace falta.

    gdf = gpd.GeoDataFrame(feats, crs=CRS_WGS)
    print(f"  {len(gdf)} edificios OSM (ways) parseados")
    return gdf


def load_franja_federal() -> gpd.GeoDataFrame:
    if not PLAYA_LIBRE.exists():
        sys.exit(
            f"Falta {PLAYA_LIBRE.relative_to(ROOT)}. Corre primero scripts/08_compute_playa_libre.py"
        )
    gdf = gpd.read_file(PLAYA_LIBRE)
    print(f"  {len(gdf)} polígonos de franja federal en playa_libre_bb")
    return gdf


def detect(
    buildings: gpd.GeoDataFrame,
    franja: gpd.GeoDataFrame,
    bbox: tuple[float, float, float, float],
    min_area_m2: float,
    buffer_m: float,
) -> gpd.GeoDataFrame:
    lon_min, lat_min, lon_max, lat_max = bbox

    # Recortar buildings al bbox (Overpass ya lo hace, pero por si acaso).
    buildings = buildings.cx[lon_min:lon_max, lat_min:lat_max].copy()
    if buildings.empty:
        return gpd.GeoDataFrame(columns=list(buildings.columns) + ["severidad"], crs=CRS_WGS)

    # Reproyectar a UTM para medir áreas.
    b_utm = buildings.to_crs(CRS_UTM)
    f_utm = franja.to_crs(CRS_UTM)

    # Geometría unificada de la franja + buffer expandido (para "ámbar").
    franja_union = unary_union(f_utm.geometry.values)
    franja_buffered = franja_union.buffer(buffer_m)

    b_utm["area_total_m2"] = b_utm.geometry.area.round(1)
    b_utm = b_utm[b_utm["area_total_m2"] >= min_area_m2].copy()

    inter = b_utm.geometry.intersection(franja_union)
    inter_buf = b_utm.geometry.intersection(franja_buffered)

    b_utm["area_invadida_m2"] = inter.area.round(1)
    b_utm["area_invadida_buf_m2"] = inter_buf.area.round(1)
    b_utm["pct_invadido"] = (b_utm["area_invadida_m2"] / b_utm["area_total_m2"] * 100).round(1)
    b_utm["pct_invadido_buf"] = (b_utm["area_invadida_buf_m2"] / b_utm["area_total_m2"] * 100).round(1)

    def clasificar(r) -> str | None:
        if r["pct_invadido"] >= PCT_ROJO:
            return "roja"
        if r["pct_invadido"] >= PCT_AMBAR:
            return "ambar"
        # Totalmente dentro del buffer expandido → ámbar (incertidumbre de georef).
        if r["pct_invadido_buf"] >= 95.0:
            return "ambar"
        return None

    b_utm["severidad"] = b_utm.apply(clasificar, axis=1)
    candidatos = b_utm[b_utm["severidad"].notna()].copy()

    # Centroide en UTM (precisión correcta) y luego reproyectar a lat/lon.
    cent_utm = candidatos.geometry.centroid
    cent_wgs = gpd.GeoSeries(cent_utm, crs=CRS_UTM).to_crs(CRS_WGS)
    candidatos["lon"] = cent_wgs.x.round(6)
    candidatos["lat"] = cent_wgs.y.round(6)

    candidatos = candidatos.to_crs(CRS_WGS)

    print(
        f"  candidatos: {(candidatos['severidad']=='roja').sum()} rojos / "
        f"{(candidatos['severidad']=='ambar').sum()} ámbar "
        f"(de {len(b_utm)} edificios >= {min_area_m2} m²)"
    )
    return candidatos


def write_geojson(gdf: gpd.GeoDataFrame, path: Path) -> None:
    if gdf.empty:
        path.write_text(json.dumps({"type": "FeatureCollection", "features": []}))
        print(f"  GeoJSON vacío en {path.relative_to(ROOT)}")
        return
    cols_keep = [
        "osm_id", "severidad", "localidad", "building", "name", "amenity", "leisure",
        "tourism", "operator", "start_date",
        "area_total_m2", "area_invadida_m2", "pct_invadido", "pct_invadido_buf",
        "lat", "lon", "tags_json", "geometry",
    ]
    cols_keep = [c for c in cols_keep if c in gdf.columns]
    gdf[cols_keep].to_file(path, driver="GeoJSON")
    print(f"  GeoJSON con {len(gdf)} candidatos en {path.relative_to(ROOT)}")


def _download_thumb(lat: float, lon: float, dest: Path) -> bool:
    """Descarga un thumbnail Esri World Imagery centrado en (lat,lon).
    Devuelve True si OK, False si hubo error (deja el archivo sin tocar)."""
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    d = 0.0012  # ~130 m de lado a esta latitud
    url = (
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/"
        f"MapServer/export?bbox={lon-d},{lat-d},{lon+d},{lat+d}"
        "&bboxSR=4326&imageSR=4326&size=320,320&format=jpg&f=image"
    )
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        r.raise_for_status()
        if not r.headers.get("Content-Type", "").startswith("image/"):
            return False
        dest.write_bytes(r.content)
        return True
    except requests.RequestException:
        return False


def render_html(
    gdf: gpd.GeoDataFrame,
    path: Path,
    bbox: tuple[float, float, float, float],
    localidades: list[Localidad] | None = None,
) -> None:
    """Reporte estático con un card por candidato — para revisión humana antes
    de promover a `casos/`. Descarga thumbnails Esri al lado del HTML (evita
    problemas de CORS / mixed content al abrir como `file://`) y usa enlaces
    a Google Maps + Street View."""
    candidatos = gdf.sort_values(
        ["severidad", "area_invadida_m2"], ascending=[True, False]
    ).to_dict("records")

    thumbs_dir = path.parent / f"{path.stem}_thumbs"
    thumbs_dir.mkdir(exist_ok=True)
    print(f"  descargando {len(candidatos)} thumbnails Esri en {thumbs_dir.relative_to(ROOT)}/")
    n_ok = 0
    for c in candidatos:
        safe = c["osm_id"].replace("/", "_")
        c["_thumb_rel"] = f"{thumbs_dir.name}/{safe}.jpg"
        if _download_thumb(c["lat"], c["lon"], thumbs_dir / f"{safe}.jpg"):
            n_ok += 1
    print(f"  {n_ok}/{len(candidatos)} thumbnails descargados")

    cards: list[str] = []
    for c in candidatos:
        lat = c["lat"]; lon = c["lon"]
        sev = c["severidad"]
        sev_color = "#dc2626" if sev == "roja" else "#f59e0b"
        thumb = c["_thumb_rel"]
        gmaps = f"https://www.google.com/maps/@{lat},{lon},19z"
        gsv = f"https://www.google.com/maps?q&layer=c&cbll={lat},{lon}"
        def _str(v) -> str:
            if v is None:
                return ""
            try:
                import math
                if isinstance(v, float) and math.isnan(v):
                    return ""
            except Exception:
                pass
            return str(v)
        name = _str(c.get("name")) or "(sin nombre)"
        amen = _str(c.get("amenity")) or _str(c.get("leisure")) or _str(c.get("tourism"))
        b_type = _str(c.get("building")) or "?"
        loc_slug = _str(c.get("localidad"))
        loc_badge = (
            f'<span class="loc-badge">{loc_slug}</span>' if loc_slug else ""
        )
        cards.append(f"""
<div class="card sev-{sev}">
  <div class="hdr">
    <span class="badge" style="background:{sev_color}">{sev.upper()}</span>
    <span class="title">{name}</span>
    {loc_badge}
    <span class="osm"><a href="https://www.openstreetmap.org/{c['osm_id']}" target="_blank">{c['osm_id']}</a></span>
  </div>
  <div class="body">
    <a href="{gmaps}" target="_blank"><img src="{thumb}" alt="thumbnail" loading="lazy"></a>
    <div class="meta">
      <div><b>Tipo OSM:</b> {b_type}{' · '+amen if amen else ''}</div>
      <div><b>Área total:</b> {c['area_total_m2']} m²</div>
      <div><b>Área invadida:</b> {c['area_invadida_m2']} m² ({c['pct_invadido']}%)</div>
      <div><b>Coords:</b> {lat:.5f}, {lon:.5f}</div>
      <div class="links">
        <a href="{gmaps}" target="_blank">Google Maps</a> ·
        <a href="{gsv}" target="_blank">Street View</a> ·
        <a href="https://www.openstreetmap.org/{c['osm_id']}" target="_blank">OSM</a>
      </div>
    </div>
  </div>
</div>
""")

    n_roja = sum(1 for c in candidatos if c["severidad"] == "roja")
    n_ambar = sum(1 for c in candidatos if c["severidad"] == "ambar")
    bbox_str = f"{bbox[0]}, {bbox[1]}, {bbox[2]}, {bbox[3]}"
    if localidades:
        loc_counts: dict[str, int] = {}
        for c in candidatos:
            slug = c.get("localidad") or "(sin localidad)"
            loc_counts[slug] = loc_counts.get(slug, 0) + 1
        loc_summary = " · ".join(
            f"<b>{slug}</b>: {n}" for slug, n in sorted(loc_counts.items())
        )
    else:
        loc_summary = ""

    html = f"""<!doctype html>
<html lang="es-MX"><head>
<meta charset="utf-8">
<title>Candidatos de invasión — Playas Libres (PoC)</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #111; }}
  h1 {{ margin-bottom: 0.25rem; }}
  .sub {{ color: #555; margin-bottom: 1.5rem; }}
  .stats {{ background: #f3f4f6; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 2rem; }}
  .card {{ border: 1px solid #ddd; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }}
  .card.sev-roja {{ border-left: 6px solid #dc2626; }}
  .card.sev-ambar {{ border-left: 6px solid #f59e0b; }}
  .hdr {{ background: #fafafa; padding: 0.5rem 0.75rem; display: flex; gap: 0.75rem; align-items: center; }}
  .badge {{ color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }}
  .title {{ font-weight: 600; flex: 1; }}
  .osm {{ font-size: 0.8rem; color: #666; }}
  .body {{ display: flex; gap: 1rem; padding: 0.75rem; }}
  .body img {{ width: 320px; height: 320px; object-fit: cover; border-radius: 4px; background: #eee; }}
  .meta {{ flex: 1; line-height: 1.6; }}
  .links {{ margin-top: 0.5rem; font-size: 0.9rem; }}
  .loc-badge {{ background: #e0f2fe; color: #075985; padding: 1px 6px; border-radius: 3px; font-size: 0.7rem; font-family: ui-monospace, monospace; }}
  .warn {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; margin-bottom: 1.5rem; border-radius: 4px; }}
</style>
</head><body>
<h1>Candidatos de invasión en zona federal</h1>
<p class="sub">PoC — bbox <code>{bbox_str}</code> · fuente edificios: OpenStreetMap (Overpass)</p>
<div class="warn">
  <b>Para revisión humana únicamente.</b> Esta lista contiene falsos positivos
  esperados (palapas, sanitarios, infraestructura turística autorizada con concesión).
  Verificar contra Esri World Imagery y prensa local antes de promover a <code>casos/</code>.
</div>
<div class="stats">
  <b>{n_roja}</b> rojos (≥ {int(PCT_ROJO)}% del edificio dentro de franja federal) ·
  <b>{n_ambar}</b> ámbar ({int(PCT_AMBAR)}–{int(PCT_ROJO)}% o dentro de buffer){f' · {loc_summary}' if loc_summary else ''}
</div>
{''.join(cards) if cards else '<p>No se encontraron candidatos.</p>'}
</body></html>
"""
    path.write_text(html, encoding="utf-8")
    print(f"  Reporte HTML en {path.relative_to(ROOT)}")


def main(argv: Iterable[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument(
        "--bbox", nargs=4, type=float, metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
        default=None,
        help=(
            "Bbox de detección manual. Si se omite, se itera sobre las "
            "localidades de data/localidades.json y se asigna `localidad` "
            "a cada candidato por point-in-bbox."
        ),
    )
    p.add_argument(
        "--min-area", type=float, default=DEFAULT_MIN_AREA_M2,
        help=f"Área mínima del edificio en m² (default {DEFAULT_MIN_AREA_M2}).",
    )
    p.add_argument(
        "--buffer", type=float, default=DEFAULT_BUFFER_M,
        help=f"Buffer en m sobre franja federal para absorber error de georef (default {DEFAULT_BUFFER_M}).",
    )
    p.add_argument(
        "--include-ms", action="store_true",
        help="Incluir Microsoft Building Footprints (no implementado en PoC).",
    )
    args = p.parse_args(argv)

    print(f"== Detector de invasiones (PoC) ==")
    print(f"min_area: {args.min_area} m² · buffer franja: {args.buffer} m")

    if args.bbox is not None:
        # Modo manual: una sola bbox, sin asignación de localidad.
        bbox = tuple(args.bbox)
        localidades: list[Localidad] = []
        print(f"bbox manual: {bbox}")
    else:
        localidades = load_localidades()
        bbox = union_bbox(localidades)
        print(f"localidades: {[l.slug for l in localidades]}")
        print(f"bbox unión: {bbox}")

    print("\n[1/3] Cargando franja federal...")
    franja = load_franja_federal()

    print("\n[2/3] Descargando edificios OSM...")
    osm = fetch_osm_buildings(bbox)
    if args.include_ms:
        print("  WARN: --include-ms aún no implementado; se omite.")

    print("\n[3/3] Calculando intersecciones y severidad...")
    candidatos = detect(osm, franja, bbox, args.min_area, args.buffer)

    if localidades:
        # Asignar localidad por point-in-bbox del centroide.
        if not candidatos.empty:
            candidatos["localidad"] = [
                assign_localidad(lon, lat, localidades)
                for lon, lat in zip(candidatos["lon"], candidatos["lat"])
            ]
            sin_loc = candidatos["localidad"].isna().sum()
            if sin_loc:
                print(f"  descartando {sin_loc} candidatos fuera de bboxes de localidades")
                candidatos = candidatos[candidatos["localidad"].notna()].copy()
            for slug in sorted(set(candidatos["localidad"])):
                n = (candidatos["localidad"] == slug).sum()
                print(f"    {slug}: {n}")
    else:
        if not candidatos.empty:
            candidatos["localidad"] = None

    print("\n== Salidas ==")
    write_geojson(candidatos, OUT_GEOJSON)
    render_html(candidatos, OUT_HTML, bbox, localidades or None)
    print("\nListo. Abre el HTML en tu navegador y filtra falsos positivos antes de promover a casos/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
