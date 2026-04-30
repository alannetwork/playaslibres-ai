# `data/`

Esta carpeta contiene los archivos generados por el pipeline. Para entender qué se descarga, qué se procesa y por qué, ver:

- [`scripts/README.md`](../scripts/README.md) — referencia del pipeline
- [`docs/DATASETS.md`](../docs/DATASETS.md) — inventario de fuentes con licencias
- [`docs/PROCESO.md`](../docs/PROCESO.md) — bitácora del proceso completo

---

## Estructura

```
data/
├── raw/         ← descargas crudas (mayormente gitignored)
├── processed/   ← datos limpios EPSG:4326 listos para consumo
└── tiles/       ← PMTiles para servir al frontend
```

---

## `data/raw/` — descargas crudas

| Archivo | Tamaño | Origen | En git |
|---|---|---|---|
| `zofemat_bb_raw.geojson` | 1.7 MB | MapServer SEMARNAT capa 220 | ✅ snapshot fechado |
| `dem/cop30_n20w106.tif` | 22 MB | AWS Open Data Copernicus DEM | ❌ gitignored |
| `tide_models/fes2014/...` | (varios) | AVISO+ (no instalado) | ❌ gitignored |

El **snapshot SEMARNAT** se commitea con metadata de captura (`_captured_at`, `_captured_from`) inyectada para garantizar reproducibilidad. El resto se gitignora por tamaño y porque es regenerable con `scripts/run_all.sh`.

## `data/processed/` — listos para consumo

Generados por el pipeline a partir de `raw/`. Todos en EPSG:4326.

| Archivo | Tamaño | Generado por | En git |
|---|---|---|---|
| `zofemat_bb.geojson` | 1.8 MB | `01_download_zofemat.py` | ✅ |
| `dem_bb.tif` | 3.9 MB | `02_download_dem.py` | ✅ |
| `sentinel_bb.tif` | 2.1 MB | `03b_download_sentinel_cog.py` | ✅ |
| `floodlines_bb.geojson` | 2.5 MB | `06_compute_floodlines.py` | ✅ |
| `playa_libre_bb.geojson` | 303 KB | `08_compute_playa_libre.py` | ✅ |

Los TIFs son COGs comprimidos:
- `dem_bb.tif`: COG DEFLATE
- `sentinel_bb.tif`: COG JPEG calidad 85

## `data/tiles/` — PMTiles servidos al frontend

Cada PMTiles se copia a `web/public/tiles/` para ser servido como archivo estático.

| Archivo | Tamaño | Layer interno | Zoom | Generado por |
|---|---|---|---|---|
| `zofemat_bb.pmtiles` | 745 KB | `zofemat` | 8-16 | `05_make_pmtiles.sh` |
| `floodlines_bb.pmtiles` | 588 KB | `floodlines` | 8-16 | `05b_make_floodlines_pmtiles.sh` |
| `playa_libre_bb.pmtiles` | 159 KB | `playa_libre` | 8-16 | `08_compute_playa_libre.py` (incluye tippecanoe inline) |

---

## Inspeccionar archivos

### GeoJSON

```bash
# resumen
jq '.features | length' data/processed/zofemat_bb.geojson

# features por categoría
jq '[.features[].properties.Layer] | group_by(.) | map({key: .[0], count: length})' \
  data/processed/zofemat_bb.geojson
```

### COG

```bash
gdalinfo -stats data/processed/dem_bb.tif
gdalinfo -stats data/processed/sentinel_bb.tif
```

### PMTiles

```bash
pmtiles show data/tiles/zofemat_bb.pmtiles
pmtiles show data/tiles/playa_libre_bb.pmtiles
```

### Visualizar localmente

- Drag & drop del GeoJSON en https://geojson.io o https://kepler.gl
- PMTiles en https://protomaps.github.io/PMTiles/
- COG en QGIS o https://geotiff.io

---

## Por qué este split (raw / processed / tiles)

- **`raw/`** preserva exactamente lo que descargamos. Útil para auditorías y para reproducir bugs.
- **`processed/`** es el formato canónico del proyecto: EPSG:4326, atributos limpiados, geometrías validadas.
- **`tiles/`** es el formato de transporte: comprimido, indexado por zoom, optimizado para servir.

El frontend solo consume `tiles/` (vía `web/public/tiles/`) y los JSONs en `web/public/data/`. Nunca toca `raw/` o `processed/` directamente.
