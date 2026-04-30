# Inventario de datasets

> Catálogo completo de los datos que usa Playas Libres: fuente, licencia, vigencia, formato, incertidumbre. Ver también `/validacion` en el sitio para los números del audit.

---

## Tabla resumen

| # | Dataset | Categoría | Origen | Licencia | Vigencia | Confianza |
|---|---|---|---|---|---|---|
| 1 | ZOFEMAT SEMARNAT capa 220 | Vector oficial | DGZFMTAC SEMARNAT (MapServer ArcGIS) | Pública | Levantamiento 2021 | 🟢 Alta |
| 2 | Playa Libre (derivado) | Vector calculado | Geometría sobre #1 | AGPL-3.0 (este repo) | Misma que #1 | 🟢 Alta |
| 3 | Pleamar estimada (floodlines) | Vector calculado | DEM + modelo de marea | AGPL-3.0 | Calculada en sesión | 🔴 Baja |
| 4 | Copernicus DEM 30 m | Raster oficial | © DLR/Airbus vía AWS Open Data | CC BY-NC-SA-style (atribución) | 2010-2018 | 🟢 Alta para elevación |
| 5 | Sentinel-2 L2A | Raster oficial | Copernicus / ESA | CC0 con atribución | 20 dic 2025 | 🟢 Alta |
| 6 | Esri World Imagery | Raster propietario | Esri (servicio público) | TOS Esri (uso no comercial OK) | Sin fecha certificada | 🟡 Media |
| 7 | OpenFreeMap Positron | Vector basemap | OpenStreetMap contributors | ODbL | Continua | 🟢 Alta |
| 8 | FES2014 | Modelo numérico | CNES/LEGOS/CLS via AVISO+ | Requiere registro | 2014 | 🟢 Alta — *no instalado* |
| 9 | Mareas armónicas (fallback) | Modelo simplificado | Constantes M2/S2/K1/O1 hardcodeadas | AGPL-3.0 | Aproximada | 🟡 Media |

---

## 1. ZOFEMAT SEMARNAT — la fuente principal

**El dato más crítico del proyecto.** Es la capa oficial del gobierno mexicano que delimita la Zona Federal Marítimo-Terrestre.

| | |
|---|---|
| Endpoint | `https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer` |
| Capa | **220 — `B_BANDERAS_2021`** (Bahía de Banderas, levantamiento 2021) |
| Productor | Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros (DGZFMTAC) |
| Acceso | Público, sin API key |
| Formato origen | ArcGIS Feature Service (devuelve GeoJSON con `?f=geojson`) |
| Features | 1,319 |
| Geometrías | LineString (en su mayoría); 150 anillos cerrados |
| Proyección origen | ITRF2008 zona 13N |
| Escala del plano | 1:1000 |
| Fecha de levantamiento | 2021 |
| Planos topográficos | 105 (`F13C58-1` a `F13C58-105`) |
| Licencia | Pública / información gubernamental |
| Snapshot local | `data/raw/zofemat_bb_raw.geojson` (1.7 MB, capturado 2026-04-29) |
| Procesado | `data/processed/zofemat_bb.geojson` (1.8 MB, EPSG:4326) |
| Tiles | `data/tiles/zofemat_bb.pmtiles` (745 KB, zoom 8-16) |

### Categorías semánticas (property `Layer`)

| Layer | Features | Significado |
|---|---|---|
| `MUELLE` | 347 | Estructuras portuarias |
| `PLEAMAR MAXIMA` | 296 | Línea de pleamar máxima |
| `ZONA FEDERAL` | 292 | Borde interno franja federal |
| `TERRENOS GANADOS MAR` | 184 | Áreas rellenadas |
| `MARGEN` | 113 | Marcos de plano (oculto en UI) |
| `PLAYA MARITIMA` | 55 | Playa pública |
| `MANGLE` | 32 | Manglar inventariado |

### Propiedades por feature

```json
{
  "OBJECTID": 344,
  "Layer": "TERRENOS GANADOS MAR",
  "PLANO": "F13C58-49",
  "PROYECTO": "49 DE 105",
  "ESCALA": "1:1000",
  "FECHA_LEV": "2021",
  "PROYECCION": "ITRF_2008_Z13",
  "Shape_Length": 3600.0
}
```

### Validación interna

La regla legal de 20 m se cumple con mediana exacta. Detalle en [PROCESO.md §3](PROCESO.md#3-validar-la-regla-legal) o `/validacion`.

### Alcance legal

⚠ **No es plano peritado.** Es la publicación oficial digital con fines informativos. Para procesos judiciales se requiere el plano firmado por perito autorizado y validado por DGZFMTAC, conforme a la NOM-146-SEMARNAT-2017.

---

## 2. Playa Libre (derivado)

**El polígono entre las dos líneas oficiales.** No es un dato externo sino un cálculo geométrico sobre #1.

| | |
|---|---|
| Generación | `scripts/08_compute_playa_libre.py` |
| Algoritmo | Polígono punto-a-punto entre PLEAMAR MAXIMA y ZONA FEDERAL del mismo `PLANO` |
| Cobertura total | 267.66 ha (Bahía de Banderas) |
| Polígonos | 48 (después de `unary_union`) |
| Salida | `data/processed/playa_libre_bb.geojson` (303 KB) |
| Tiles | `data/tiles/playa_libre_bb.pmtiles` (159 KB, zoom 8-16) |
| Licencia | AGPL-3.0 (cálculo derivado) |

### Por qué este algoritmo

Probamos primero buffer-intersect (12 m a cada línea, intersección). Funcionaba en tramos rectos pero dejaba huecos donde las líneas se separaban más de 24 m. La versión definitiva (polígono cerrado conectando extremos del mismo plano) es geométricamente exacta.

### Lo que NO es

- No incluye tramos donde las dos líneas están a más de 60 m (descarte por outliers de muelles/escolleras).
- No representa la ZOFEMAT con valor probatorio — para eso, plano peritado.

---

## 3. Pleamar estimada (capa ciudadana experimental)

**La capa más débil del sitio.** Mantenida desactivada por defecto.

| | |
|---|---|
| Generación | `scripts/06_compute_floodlines.py` |
| Inputs | DEM Copernicus 30 m + modelo de marea |
| Algoritmo | `dem ≤ tide_m + offset` → vectorizar contornos → simplificar |
| Alturas calculadas | −1.0, −0.8, ..., +1.2 m (12 niveles) |
| Salida | `data/processed/floodlines_bb.geojson` (2.5 MB) |
| Tiles | `data/tiles/floodlines_bb.pmtiles` (588 KB) |

### Incertidumbre real (medida vs SEMARNAT oficial)

| Métrica | Valor |
|---|---|
| Mediana | 25.9 m |
| p95 | **11,576 m** |
| Máximo | 16,643 m |
| % a ≤ 30 m del oficial | 53% |

Las causas se documentan en [PROCESO.md §5](PROCESO.md#5-la-capa-ciudadana-y-su-honestidad).

---

## 4. Copernicus DEM 30 m

| | |
|---|---|
| Productor | © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018 |
| Distribuidor | AWS Open Data Registry |
| Endpoint | `https://copernicus-dem-30m.s3.amazonaws.com` |
| Tile usado | `Copernicus_DSM_COG_10_N20_00_W106_00_DEM` |
| Tipo | DSM (Digital Surface Model) — incluye edificios y vegetación |
| Datum vertical | Geoide EGM2008 |
| Resolución | 30 m |
| Licencia | Libre con atribución |
| Recortado a la bahía | `data/processed/dem_bb.tif` (3.9 MB, COG DEFLATE) |
| Stats globales en repo | min −5.27 m, max 1313 m, 2.27M píxeles |

⚠ **DSM, no DTM**: mide la superficie. Edificios y vegetación elevan la cota — esa es la causa principal del error de la pleamar estimada en zonas urbanas y cantiles.

---

## 5. Sentinel-2 L2A

| | |
|---|---|
| Productor | European Space Agency (ESA) — Programa Copernicus |
| Distribuidor (catálogo STAC) | Element84 / AWS Open Data: `https://earth-search.aws.element84.com/v1` |
| Colección | `sentinel-2-l2a` |
| Mejor escena 2025 (< 5% nubes) | **`S2C_13QDD_20251220_0_L2A`** (20 dic 2025, 0.001% nubes) |
| Asset usado | `visual` — RGB compuesto de las bandas B04/B03/B02, 10 m/pixel |
| URL del COG | `https://sentinel-cogs.s3.us-west-2.amazonaws.com/.../TCI.tif` |
| Servido al cliente | TiTiler.xyz (`/cog/WebMercatorQuad/tilejson.json?url=...`) |
| Bbox de la escena | `(-105.97, 20.71) → (-104.91, 21.70)` (cubre el norte de la bahía) |
| Recortado a la bahía | `data/processed/sentinel_bb.tif` (2.1 MB, COG JPEG q85) |
| Licencia | Copernicus open access — atribución obligatoria |

### Cómo se descargó el recorte

Vía `/vsicurl` HTTP range request: `gdal_translate -projwin ... /vsicurl/<URL>` → solo 5200×3900 pixels en vez de 10980×10980. Detalle en `scripts/03b_download_sentinel_cog.py`.

---

## 6. Esri World Imagery

| | |
|---|---|
| Productor | Esri |
| Endpoint | `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |
| Resolución | Variable, sub-métrica en muchas zonas |
| Fecha | Sin fecha certificada (mosaico de fuentes propietarias) |
| Licencia | TOS Esri — uso no comercial permitido con atribución |
| Servido al cliente | Tile service directo, opacidad 0.95 |
| Snapshot local | NO descargado (depende de Esri) |

⚠ **Riesgo**: si Esri cambia su política o rate-limita, el sitio se queda sin imagen aérea de alta resolución. Como respaldo tenemos #5 (Sentinel-2) que sí está commiteado.

---

## 7. OpenFreeMap Positron

| | |
|---|---|
| Productor | OpenFreeMap project |
| Tiles | `https://tiles.openfreemap.org/styles/positron` |
| Datos subyacentes | OpenStreetMap contributors |
| Licencia | ODbL (OSM) |
| Servido al cliente | Estilo MapLibre vector |
| Snapshot local | NO (vector tiles dinámicos) |

---

## 8. FES2014 (no instalado)

| | |
|---|---|
| Productor | CNES / LEGOS / CLS |
| Distribuidor | AVISO+ — requiere registro y licencia |
| URL | `https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html` |
| Tipo | Modelo global de marea oceánica con 34 constituyentes |
| Resolución | 1/16° (~7 km en el ecuador) |
| Estado en el proyecto | **No instalado.** Requiere registro AVISO+. |
| Fallback usado | Modelo armónico simplificado (#9) |

Para activar:
1. Registrarse en AVISO+ y aceptar la licencia.
2. Descargar archivos NetCDF a `data/raw/tide_models/fes2014/ocean_tide/`.
3. Implementar `compute_fes2014()` en `scripts/04_compute_tides.py` (la API de pyTMD 3.x cambió respecto a versiones anteriores).
4. Re-correr el pipeline.

---

## 9. Mareas armónicas (fallback)

| | |
|---|---|
| Implementación | `scripts/04_compute_tides.py` |
| Constituyentes | M2 (semidiurno principal), S2, K1, O1 |
| Constantes | Hardcodeadas para Punta de Mita (régimen mixto semidiurno del Pacífico mexicano) |
| Salida | `web/public/data/tides_punta_mita_2025_full.json` (2.2 MB, 52,560 muestras / año) |
| Salida extremos | `web/public/data/tides_punta_mita_2025_extremes.json` (109 KB, 1,889 extremos) |
| Stats 2025 | max 1.31 m, min −0.98 m, mean 0.00 m |
| Incertidumbre | ±20–50 cm vs FES2014 |
| Licencia | AGPL-3.0 |

Las constantes son aproximadas. Para precisión profesional usar FES2014 (#8) o las tablas oficiales SEMAR para Puerto Vallarta.

---

## Datasets que NO incluimos

- **Tablas SEMAR de marea oficial**: PDFs publicados por la Secretaría de Marina por puerto. Validan los datos pero no se descargan automáticamente.
- **Concesiones ZOFEMAT vigentes**: existe un padrón nacional de concesiones, pero la API es distinta a la del MapServer cartográfico. Pendiente para fase 2.
- **Datos catastrales de propiedad privada**: cada estado tiene su sistema. Para Bahía de Banderas requiere convenio con catastro de Nayarit.

---

## Resumen de licencias

| Dato | Licencia | Atribución requerida |
|---|---|---|
| ZOFEMAT SEMARNAT | Pública | Sí — DGZFMTAC SEMARNAT |
| Copernicus DEM | Libre con atribución | Sí — DLR/Airbus |
| Sentinel-2 | Atribución | Sí — Copernicus / ESA |
| Esri World Imagery | TOS Esri | Sí — Esri |
| OpenFreeMap | ODbL | Sí — OSM contributors |
| FES2014 | AVISO+ con registro | Sí — CNES/LEGOS/CLS |
| Código del proyecto | AGPL-3.0 | — |

Texto de atribución completo en `Attribution.tsx` y en el footer del sitio.
