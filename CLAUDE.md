# CLAUDE.md

Este archivo orienta a futuras instancias de Claude Code que trabajen en este repositorio.

## Qué es este proyecto

**Playas Libres** — sitio web público que muestra, sobre un mapa satelital de Bahía de Banderas (Nayarit, México) centrado en Punta de Mita, dos capas comparables:

1. Línea de pleamar **estimada** (capa "ciudadana", aproximada) derivada de Sentinel-2 + Copernicus DEM 30 m + modelo global de marea FES2014.
2. Delimitación **oficial** de la ZOFEMAT publicada por SEMARNAT (capa 220 `B_BANDERAS_2021` del MapServer).

El sitio responde al conflicto en Playa Las Cocinas (Punta de Mita, abril 2026) donde una desarrolladora invadió presuntamente la zona federal. Sirve como herramienta de transparencia ciudadana, **no como prueba pericial**.

## Stack y restricciones no negociables

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui en `web/`. Idioma `es-MX`.
- **Mapa**: MapLibre GL JS vía `react-map-gl/maplibre`. **Prohibido** Mapbox GL v2+ y Google Maps.
- **Tiles vectoriales**: PMTiles servidos como archivos estáticos desde `web/public/tiles/` (luego R2; no implementar todavía).
- **Tiles raster Sentinel-2**: TiTiler.xyz público apuntando al COG en AWS Open Data — **no descargar la escena entera**.
- **Sin DB**, sin localStorage/sessionStorage en componentes (cookies sí permitidas).
- **Sin claves API en el repo**.
- **Disclaimer legal** visible en footer permanente y modal al primer load.

## Comandos comunes

### Pipeline de datos (raíz del repo)

```bash
# Activar venv Python
source .venv/bin/activate

# Pipeline completo
bash scripts/run_all.sh

# Scripts individuales
python scripts/01_download_zofemat.py
python scripts/02_download_dem.py
python scripts/03_find_sentinel.py
python scripts/04_compute_tides.py
bash   scripts/05_make_pmtiles.sh
python scripts/06_compute_floodlines.py
```

### Frontend (`web/`)

```bash
cd web
npm install
npm run dev          # http://localhost:3000
npm run build        # producción
npm run lint
```

### Operaciones GDAL/tippecanoe típicas

```bash
# Reproyectar GeoJSON a EPSG:4326
ogr2ogr -t_srs EPSG:4326 out.geojson in.geojson

# Recortar raster a bbox de la bahía
gdalwarp -te -105.65 20.50 -105.15 20.85 -t_srs EPSG:4326 -of COG in.tif out.tif

# Convertir GeoJSON a PMTiles
tippecanoe -o out.pmtiles --layer=name --minimum-zoom=8 --maximum-zoom=16 \
  --extend-zooms-if-still-dropping --force in.geojson
```

## Coordenadas y parámetros del MVP

- Centro mapa Punta de Mita: `lat 20.7660, lon -105.5460` (zoom inicial 13).
- BBox Bahía de Banderas: `lon_min=-105.65, lat_min=20.50, lon_max=-105.15, lat_max=20.85`.
- Año de referencia para mareas: 2025.
- Alturas para floodlines (m): `[-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2]`.

## Datasets clave (URLs de origen)

- **ZOFEMAT (SEMARNAT)**: `https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer/220/query?where=1=1&outFields=*&f=geojson` (capa 220 `B_BANDERAS_2021`; si 404, listar capas con `?f=json` y buscar `BANDERAS`).
- **Copernicus DEM 30 m**: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N20_00_W106_00_DEM/Copernicus_DSM_COG_10_N20_00_W106_00_DEM.tif`.
- **Sentinel-2 L2A**: STAC `https://earth-search.aws.element84.com/v1` (asset `visual` = COG RGB en AWS Open Data).
- **Mapa base**: `https://tiles.openfreemap.org/styles/positron` (libre, sin API key).
- **Raster tiles Sentinel via TiTiler**: `https://titiler.xyz/cog/WebMercatorQuad/tilejson.json?url={ENCODED_COG_URL}`.
- **FES2014**: requiere registro en AVISO+; si los archivos no están en `data/raw/tide_models/fes2014/ocean_tide/`, **NO descargar automáticamente** — usar fallback armónico hardcodeado en `scripts/04_compute_tides.py` y dejarlo claramente marcado como aproximación.

## Reglas operativas

- Antes de **instalar** algo nuevo: verificar que no esté ya y avisar.
- Antes de **borrar/sobrescribir** archivos en `data/processed/` o `web/public/`: preguntar.
- Antes de **acciones git destructivas** (rebase, force push, reset --hard): preguntar.
- Si un script Python falla: mostrar **traceback completo** antes de intentar arreglar.
- Si una descarga HTTP falla (403/404/timeout): no inventar URLs alternas — mostrar el error y proponer 2-3 alternativas.
- Commits pequeños en español: `tipo(scope): descripción`.
- Ante dudas de arquitectura, listar pros/contras (≤5 líneas) y preguntar.
- Prioridad: **correcto > simple > rápido > elegante**.

## Textos legales obligatorios (literal)

### Disclaimer largo (modal de primer load + página /acerca)

> **Aviso legal.** Esta plataforma muestra dos tipos de capas. La capa "Pleamar estimada (uso ciudadano)" se genera a partir de imágenes satelitales abiertas (Copernicus Sentinel-2), un modelo digital de elevación (Copernicus DEM 30 m) y un modelo global de mareas (FES2014); tiene una incertidumbre estimada de ±10 a 30 metros y **no constituye una delimitación oficial ni produce efectos jurídicos**. La capa "ZOFEMAT oficial (SEMARNAT)" reproduce información publicada por la Secretaría de Medio Ambiente y Recursos Naturales con fines informativos; los planos con valor jurídico son únicamente los firmados por perito autorizado y validados por la Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros (DGZFMTAC) conforme a la NOM-146-SEMARNAT-2017 y a las tablas numéricas de predicción de marea publicadas por la Secretaría de Marina.

### Disclaimer corto (footer permanente)

> Capas referenciales. No constituyen delimitación oficial de la ZOFEMAT. Ver Metodología.

### Atribución (footer)

> Datos: Contains modified Copernicus Sentinel data 2025 · Copernicus WorldDEM-30 © DLR e.V. 2010–2014 y © Airbus Defence and Space GmbH 2014–2018 · Delimitación ZOFEMAT publicada por SEMARNAT (DGZFMTAC) · Mapa base © OpenFreeMap, OpenStreetMap contributors · Modelo de marea FES2014 (CNES/LEGOS/CLS) · Código abierto bajo licencia AGPL-3.0.

## Licencias relevantes

- Sentinel-2 Copernicus: libre con atribución.
- Copernicus DEM: libre con atribución (DLR/Airbus).
- ZOFEMAT SEMARNAT: cita obligatoria.
- MapLibre: BSD.
- PMTiles: BSD.
- Código del proyecto: AGPL-3.0.
