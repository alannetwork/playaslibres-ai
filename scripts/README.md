# Pipeline de datos

> Referencia de cada script Python/Bash que construye los datos del proyecto. Para correrlo todo de una vez, ejecutar `bash scripts/run_all.sh`.

---

## Requisitos

- **Sistema** (macOS Apple Silicon):
  ```bash
  brew install gdal tippecanoe pmtiles uv jq curl
  ```

- **Python**: usar `uv` para crear el venv:
  ```bash
  uv venv
  source .venv/bin/activate
  uv pip install -r requirements.txt
  ```

- **Tooling**: `tippecanoe` (Felt) para PMTiles, `pmtiles` (protomaps) opcional para inspección.

---

## Pipeline completo

```bash
bash scripts/run_all.sh
```

Tiempo aproximado en primera ejecución: ~10 min (~25 MB de descargas).

Idempotente: cada script verifica si su salida ya existe y reutiliza si es posible. Para forzar regeneración, eliminar manualmente los archivos en `data/processed/`.

---

## Scripts individuales

### `01_download_zofemat.py`

Descarga la capa **220 `B_BANDERAS_2021`** del MapServer ArcGIS de SEMARNAT.

- Endpoint: `https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer/220/query`
- Si la capa 220 retorna 404, lista las capas (`?f=json`) y busca por nombre `BANDERAS`.
- Reproyecta a EPSG:4326 con `ogr2ogr`.

**Salidas**:
- `data/raw/zofemat_bb_raw.geojson` — copia cruda con metadata de captura inyectada (`_captured_at`, `_captured_from`, etc.)
- `data/processed/zofemat_bb.geojson` — versión final EPSG:4326

**Imprime**: número de features, bbox, área total en hectáreas.

---

### `02_download_dem.py`

Descarga el tile **Copernicus DEM 30 m** que cubre Bahía de Banderas y lo recorta al bbox de la bahía.

- URL: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N20_00_W106_00_DEM/...`
- Recorta con `gdalwarp -te -105.65 20.50 -105.15 20.85 -t_srs EPSG:4326 -of COG`.

**Salidas**:
- `data/raw/dem/cop30_n20w106.tif` — tile global (~22 MB, gitignored)
- `data/processed/dem_bb.tif` — recortado y comprimido (~3.9 MB)

**Imprime**: dimensiones, elevación min/max, tamaño en MB.

---

### `03_find_sentinel.py`

Busca la mejor escena Sentinel-2 L2A con < 5% de nubes sobre Bahía de Banderas en 2025, vía catálogo STAC abierto.

- STAC: `https://earth-search.aws.element84.com/v1`
- Colección: `sentinel-2-l2a`
- Asset usado: `visual` (RGB compuesto a 10 m/pixel)

**Salida**: `web/public/data/sentinel_base.json` con id, datetime, cloud_cover, URL del COG, etc.

**Imprime**: las 5 mejores escenas (menor nubosidad primero).

---

### `03b_download_sentinel_cog.py`

Descarga el COG Sentinel-2 RGB **recortado al bbox de Bahía de Banderas**, vía HTTP range request (`/vsicurl`). NO baja la escena entera (~250 MB), solo el bbox.

- Lee la URL del COG desde `web/public/data/sentinel_base.json`.
- `gdal_translate -projwin -105.65 20.85 -105.15 20.50 -of COG -co COMPRESS=JPEG`.

**Salida**: `data/processed/sentinel_bb.tif` (~2.1 MB).

Sirve como respaldo local en caso de que TiTiler.xyz o el COG remoto se caigan.

---

### `04_compute_tides.py`

Calcula altura de marea cada 10 minutos durante 2025 en Punta de Mita.

- Usa `pyTMD` con FES2014 si los archivos `.nc` existen en `data/raw/tide_models/fes2014/ocean_tide/`.
- Si no, **fallback armónico** con constantes hardcodeadas (M2/S2/K1/O1) — marcado claramente como aproximado en el JSON.

**Salidas** (en `web/public/data/`):
- `tides_punta_mita_2025_full.json` (~2.2 MB, 52,560 muestras del año)
- `tides_punta_mita_2025_extremes.json` (~109 KB, ~1,890 extremos)

**Imprime**: modelo usado (FES2014 o `harmonic_fallback`), stats max/min/mean.

---

### `05_make_pmtiles.sh`

Convierte `zofemat_bb.geojson` a PMTiles con `tippecanoe`.

```bash
tippecanoe -o data/tiles/zofemat_bb.pmtiles \
  --layer=zofemat \
  --minimum-zoom=8 --maximum-zoom=16 \
  --extend-zooms-if-still-dropping --force \
  data/processed/zofemat_bb.geojson
```

Copia la salida a `web/public/tiles/`.

---

### `06_compute_floodlines.py`

Calcula la **pleamar estimada** (capa ciudadana, experimental) a partir del DEM y un offset de datum.

Para cada altura discreta de marea (de −1.0 m a +1.2 m en pasos de 0.2 m):
1. Máscara `dem ≤ altura + DATUM_OFFSET_M` filtrada al área costera (`dem ≤ 5 m`).
2. Vectoriza el contorno con `rasterio.features.shapes`.
3. Simplifica con shapely (~10 m de tolerancia).
4. Exporta como FeatureCollection con propiedad `tide_m`.

**Salida**: `data/processed/floodlines_bb.geojson` (~2.5 MB).

**Configuración**: `DATUM_OFFSET_M = 0.0` por defecto. Hay que calibrarlo contra puntos de costa visibles para reducir el error.

---

### `05b_make_floodlines_pmtiles.sh`

Convierte `floodlines_bb.geojson` a PMTiles.

```bash
tippecanoe -o data/tiles/floodlines_bb.pmtiles \
  --layer=floodlines \
  --minimum-zoom=8 --maximum-zoom=16 \
  --extend-zooms-if-still-dropping --force \
  data/processed/floodlines_bb.geojson
```

---

### `07_validate.py`

**Audit científico de la data.** Genera el reporte que se publica en `/validacion`.

Verifica:
1. **Metadata SEMARNAT**: año del levantamiento, escala, proyección, número de planos.
2. **Test legal de 20 m**: muestrea ~31,500 puntos sobre la línea PLEAMAR y mide la distancia perpendicular a la ZONA FEDERAL más cercana. Reporta percentiles.
3. **Comparación pleamar estimada vs oficial**: cuán cerca/lejos cae la línea ciudadana respecto al catastro. Útil para honestar las limitaciones.
4. **Estadística del DEM costero**: rango, número de píxeles, anomalías.
5. **Tabla de incertidumbres** por componente.

**Salida**: `web/public/data/validation_report.json` (~2 KB, consumido por la página `/validacion`).

Imprime también un reporte legible en stdout.

---

### `08_compute_playa_libre.py`

Genera el **polígono "Playa Libre"** entre PLEAMAR MAXIMA y ZONA FEDERAL.

Algoritmo:
1. Indexa features por `PLANO`.
2. Para cada par (pleamar, zona_federal) del mismo plano:
   - Reproyecta a UTM 13N.
   - Detecta orientación correcta comparando extremos.
   - Construye polígono cerrado conectando las dos líneas.
3. Une todos con `shapely.ops.unary_union`.
4. Reproyecta a WGS84.
5. Convierte a PMTiles con tippecanoe.

**Salidas**:
- `data/processed/playa_libre_bb.geojson` (~303 KB)
- `data/tiles/playa_libre_bb.pmtiles` (~159 KB) → copiado a `web/public/tiles/`

**Configuración**:
- `MAX_PAIR_DISTANCE_M = 60` — descarta pares con líneas a más de 60 m (muelles aislados, casos atípicos).
- Polígonos > 20 ha se descartan como artefactos.

**Imprime**: planos procesados, polígonos generados, área total en hectáreas.

---

### `run_all.sh`

Orquestador. Ejecuta todos los scripts en orden con `set -euo pipefail` (fail-fast).

```bash
01 → 02 → 03 → 03b → 04 → 05 → 06 → 05b → 07 → 08
```

Si el venv `.venv/` no existe, falla con un mensaje claro.

---

## Cómo regenerar todo desde cero

```bash
# eliminar artefactos
rm -rf data/processed/* data/tiles/*

# regenerar
source .venv/bin/activate
bash scripts/run_all.sh
```

Esto re-descarga las fuentes externas y recalcula todo. Útil cuando SEMARNAT publica una versión nueva del catastro o cuando aparece una mejor escena Sentinel-2.

## Cómo agregar una nueva playa en disputa

1. Editar `web/public/data/disputas.json` agregando una entrada al array.
2. Estructura mínima:
   ```json
   {
     "id": "playa-x",
     "name": "Playa X",
     "coords": [LON, LAT],
     "status": "en_conflicto",
     "summary": "...",
     "links": [{"label": "...", "url": "..."}]
   }
   ```
3. Para incluir dossier completo, agregar también `evidence` (con OBJECTIDs SEMARNAT) y `legal_refs`. Ver el ejemplo de Las Cocinas.

## Tests de QA con Playwright

Ver `web/scripts/inspect-*.mjs`. Ejecución:

```bash
cd web
node scripts/inspect-map.mjs       # capas, toggles
node scripts/inspect-welcome.mjs   # modal + sub-capas
node scripts/inspect-marker.mjs    # marker hover + InfoPanel
node scripts/inspect-collapse.mjs  # chips colapsables
```

Requiere `playwright` instalado en `web/node_modules` y el dev server corriendo en `:3000`.
