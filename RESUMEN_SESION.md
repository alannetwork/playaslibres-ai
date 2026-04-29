# Resumen de sesión — Playas Libres MVP

Fecha: 2026-04-29
Duración: ~3 horas (con compilación de GDAL ~17 min en medio).

## Lo que quedó funcionando

### Pipeline de datos
- `scripts/01_download_zofemat.py`: descarga capa 220 SEMARNAT (`B_BANDERAS_2021`), reproyecta a EPSG:4326. **Resultado: 1319 features, 9919 ha** sobre Bahía de Banderas.
- `scripts/02_download_dem.py`: Copernicus DEM 30 m, recortado al bbox `(-105.65, 20.50, -105.15, 20.85)`. **Resultado: 1800×1260 px, elevación −5.27 a 1313 m, 4.1 MB**.
- `scripts/03_find_sentinel.py`: STAC Element84/AWS, mejor escena 2025 con <5% nubes. **Elegida: `S2C_13QDD_20251220_0_L2A` con 0.001% de nubes**, COG vía TiTiler.xyz.
- `scripts/04_compute_tides.py`: 52 560 muestras (cada 10 min) y 1889 extremos para 2025 en Punta de Mita. **Modo: fallback armónico** (ver deuda técnica). Stats: max 1.31 m, min −0.98 m, media 0 m.
- `scripts/05_make_pmtiles.sh`: ZOFEMAT → PMTiles (745 KB, zoom 8–16).
- `scripts/06_compute_floodlines.py` + `05b_make_floodlines_pmtiles.sh`: 12 alturas (−1.0 a +1.2 m), 4572 polígonos, PMTiles 588 KB.
- `scripts/run_all.sh`: orquestador completo.

### Frontend (`web/`)
- Next.js 14 App Router + TypeScript + Tailwind v3 + shadcn/ui (button, card, dialog, slider, switch, tooltip).
- `Map.tsx` con dynamic import (ssr:false): basemap OpenFreeMap Positron, controles MapLibre, capa Sentinel-2 vía TiTiler.xyz, capa ZOFEMAT con popup de propiedades, capa pleamar dinámica filtrada por `tide_m`, markers de disputas con InfoPanel.
- `TideSlider.tsx` con play/pause (1 h por tick, 100 ms), botones a pleamares máximas, fase subiendo/bajando, indicador en metros.
- `LayerToggle.tsx` con 3 switches independientes.
- `LegalDisclaimer.tsx` con cookie `playas-libres-disclaimer-accepted` (TTL 1 año).
- `Attribution.tsx` permanente con disclaimer corto y créditos completos.
- Páginas `/acerca` y `/metodologia` en español.
- `opengraph-image.tsx` (edge runtime), `robots.ts`, `sitemap.ts`.
- `npm run build` pasa limpio (HTTP 200 en `/`, todas las rutas estáticas excepto OG image).

### Verificaciones realizadas
- Pipeline completo corre y genera todos los artefactos esperados.
- `npm run dev` arranca sin errores (HTTP 200 en `/`, `/data/sentinel_base.json`, `/data/tides_punta_mita_2025_extremes.json`, `/tiles/zofemat_bb.pmtiles` todos sirven 200).
- `npm run build` genera build de producción sin errores ni warnings de tipos.
- Tipos TypeScript pasan (`tsc --noEmit`).

## Deuda técnica explícita

### 🔴 Crítica — modelo de mareas
- Estamos en **fallback armónico** porque FES2014 requiere registro en AVISO+. Las constantes M2/S2/K1/O1 hardcodeadas en `scripts/04_compute_tides.py` son aproximadas y producen una serie útil pero no precisa.
- Para activar FES2014:
  1. Registrarse en `https://www.aviso.altimetry.fr/en/data/data-access.html`.
  2. Descargar los `.nc` de `ocean_tide` a `data/raw/tide_models/fes2014/ocean_tide/`.
  3. Implementar el bloque `compute_fes2014` (actualmente dispara `SystemExit` con instrucciones). La API de pyTMD 3.x cambió; la versión instalada es 3.0.6 — revisar `pyTMD.io.FES.read_constants` y `pyTMD.predict.time_series`.
  4. Volver a correr `python scripts/04_compute_tides.py`. El JSON pasará de `harmonic_fallback` a `FES2014`.

### 🟡 Media — datum del DEM
- `scripts/06_compute_floodlines.py` usa `DATUM_OFFSET_M = 0.0`. El cero del Copernicus DEM es EGM2008 (geoide), pero el cero de marea local (Nivel Medio del Mar en Punta de Mita) probablemente difiere por algunas decenas de centímetros.
- **Calibración necesaria**: comparar la línea estimada en el mapa contra puntos conocidos de costa (rompeolas, cantil) en imagen Sentinel-2 reciente, ajustar el offset, regenerar los floodlines y los PMTiles.

### 🟡 Media — TiTiler.xyz
- Dependencia externa al servicio público `https://titiler.xyz`. Sin SLA. Si rate-limita o cae, las imágenes Sentinel-2 dejan de mostrarse.
- Mitigación: levantar TiTiler propio (Docker) cuando el proyecto crezca, y firmar las URLs en una API edge que las cachée.

### 🟢 Baja
- El bbox declarado `(-105.65, 20.50, -105.15, 20.85)` es generoso; los datos reales de ZOFEMAT van de `−105.54 a −105.27, 20.67 a 20.96`. Punta de Mita queda apenas dentro del extremo oeste de la cobertura ZOFEMAT (−105.546 vs −105.541). **Verificar visualmente** si Las Cocinas tiene polígono de ZOFEMAT en el mapa.
- Las clases utilitarias de Tailwind generadas por shadcn (con sintaxis v4 como `data-open`, `origin-(--var)`) podrían no aplicar correctamente en Tailwind v3. Los componentes funcionan pero su estado animado puede no verse bien. Migrar a Tailwind v4 o reescribir las clases.
- `web/public/tiles/*.pmtiles` (1.3 MB combinados) está commiteado en git. Para R2/CDN en el futuro, sacarlos del repo.

## Próximos 3 pasos sugeridos

1. **Calibrar el datum y validar visualmente** — subir el dev server, comparar la pleamar máxima estimada (1.2 m) contra la línea de costa de Sentinel-2 en Las Cocinas, ajustar `DATUM_OFFSET_M` hasta que coincidan, regenerar floodlines + PMTiles. Idealmente, comparar contra una foto de pleamar reciente.
2. **Activar FES2014** — registro AVISO+, implementar `compute_fes2014` en `04_compute_tides.py`, correr y commitear el JSON resultante.
3. **Deploy a Cloudflare Pages** — `wrangler pages deploy` con dominio custom (`playas-libres.mx` o similar). Configurar `NEXT_PUBLIC_SITE_URL` y verificar que TiTiler.xyz responde desde la zona del CDN.

## Cómo correr el proyecto desde cero en una máquina limpia

```bash
# 1. Sistema (macOS Apple Silicon)
brew install git node gdal tippecanoe pmtiles uv jq

# 2. Clonar y entrar
git clone <repo-url> playas-libres
cd playas-libres

# 3. Pipeline de datos
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
bash scripts/run_all.sh

# 4. Frontend
cd web
npm install
npm run dev   # http://localhost:3000
```

Tiempo estimado en primera ejecución: ~10 min para el pipeline (descarga DEM ~25 MB, escena Sentinel STAC search, mareas, tippecanoe).

## Commits creados

1. `chore: scaffold del proyecto Playas Libres`
2. `feat(data): pipeline de descarga y transformación de ZOFEMAT, DEM, Sentinel-2 y mareas`
3. `feat(web): scaffold Next.js + MapLibre + capas integradas`
4. `feat(floodlines): cálculo de líneas de inundación derivadas del DEM Copernicus`
5. (próximo) `feat(content): página acerca, metodología, casos en disputa, SEO y disclaimer reforzado`
