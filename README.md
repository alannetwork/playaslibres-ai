# Playas Libres

Plataforma web pública que muestra, sobre un mapa satelital de Bahía de Banderas (Nayarit, México) centrado en Punta de Mita, dos capas comparables:

1. **Pleamar estimada (uso ciudadano)** — derivada de imágenes Sentinel-2, Copernicus DEM 30 m y modelo global de marea FES2014. Marcada explícitamente como aproximada (incertidumbre ±10–30 m).
2. **ZOFEMAT oficial (SEMARNAT)** — Zona Federal Marítimo-Terrestre publicada por SEMARNAT vía MapServer ArcGIS. Marcada como referencial, no como plano legal.

El objetivo es servir como herramienta de transparencia ciudadana frente a invasiones presuntas de zona federal (caso Playa Las Cocinas / Cantiles de Mita / Montage, abril 2026), no como prueba pericial.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui en `web/`.
- **Mapa**: MapLibre GL JS vía `react-map-gl/maplibre`.
- **Tiles vectoriales**: PMTiles servidos como archivos estáticos (`web/public/tiles/`).
- **Tiles raster Sentinel-2**: TiTiler.xyz público apuntando a COG en AWS Open Data.
- **Pipeline de datos**: Python (`uv`) + GDAL + tippecanoe.

## Estructura

```
data/        # raw/, processed/, tiles/  (raw y .tif gitignored)
scripts/     # 01..06 + run_all.sh
notebooks/   # vacío, para fase futura con CoastSat
web/         # Next.js
```

## Cómo correr el proyecto desde cero

### 1. Requisitos del sistema (macOS Apple Silicon)

```bash
brew install git node gdal tippecanoe pmtiles uv jq
```

### 2. Pipeline de datos

```bash
# Crear venv e instalar dependencias Python
uv venv
source .venv/bin/activate
uv pip install requests geopandas shapely pyproj rasterio pyTMD numpy pandas pystac-client

# Ejecutar pipeline completo
bash scripts/run_all.sh
```

Esto deja en `web/public/data/` y `web/public/tiles/` todos los datasets que el frontend consume.

### 3. Frontend

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

## Disclaimer legal

Las capas mostradas son **referenciales**. La capa "Pleamar estimada" tiene una incertidumbre estimada de ±10 a 30 metros y **no constituye una delimitación oficial ni produce efectos jurídicos**. Los planos con valor jurídico son únicamente los firmados por perito autorizado y validados por la DGZFMTAC conforme a la NOM-146-SEMARNAT-2017.

## Atribución

Datos: Contains modified Copernicus Sentinel data 2025 · Copernicus WorldDEM-30 © DLR/Airbus · Delimitación ZOFEMAT publicada por SEMARNAT (DGZFMTAC) · Mapa base © OpenFreeMap, OpenStreetMap contributors · Modelo de marea FES2014 (CNES/LEGOS/CLS).

## Licencia

Código abierto bajo licencia AGPL-3.0.
