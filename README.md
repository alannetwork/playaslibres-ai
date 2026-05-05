<p align="center">
  <img src="docs/brand/icon.svg" width="96" height="96" alt="Playas Libres" />
</p>

<h1 align="center">Playas Libres</h1>

<p align="center"><em>La playa es de todos sólo si todos podemos verla.</em></p>

Plataforma ciudadana para visualizar la **Zona Federal Marítimo-Terrestre** (ZOFEMAT) en Bahía de Banderas, Nayarit, sobre imagen aérea de alta resolución. Reorganiza datos públicos del catastro oficial de SEMARNAT — que existen pero casi nadie consulta — en un mapa interactivo verificable.

Surge a raíz del conflicto en **Playa Las Cocinas** (Punta de Mita, abril 2026) donde vecinos denuncian invasión de zona federal por el desarrollo Cantiles de Mita / Montage. El sitio sirve como herramienta de transparencia ciudadana, no como prueba pericial.

---

## Documentación por temas

| Doc | Qué encontrás |
|---|---|
| **[docs/PROCESO.md](docs/PROCESO.md)** | Cómo se construyó la plataforma, paso a paso, con el contexto del descubrimiento |
| **[docs/CASO_LAS_COCINAS.md](docs/CASO_LAS_COCINAS.md)** | Dossier completo del caso: cronología, evidencia documental, OBJECTIDs SEMARNAT, links de verificación |
| **[docs/DATASETS.md](docs/DATASETS.md)** | Inventario de todos los datasets con licencias, fuentes, vigencia, incertidumbres |
| **[scripts/README.md](scripts/README.md)** | Referencia del pipeline Python: qué hace cada script, en qué orden, qué produce |
| **[data/README.md](data/README.md)** | Qué hay en cada subcarpeta de datos |
| **[docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)** | Setup operativo de Cloudflare: DNS, WAF, rate limiting, cache de PMTiles, Web Analytics sin cookies |
| **CLAUDE.md** | Guía operativa para futuras instancias de Claude Code |
| **RESUMEN_SESION.md** | Bitácora de la sesión inicial de construcción |

---

## Qué muestra el mapa

1. **🟩 Playa libre** — la franja de ~20 m entre la pleamar máxima y la línea de zona federal. Uso público inalienable por mandato del Art. 27 constitucional.
2. **🔵 Pleamar máxima** — línea oficial publicada por SEMARNAT (DGZFMTAC, levantamiento 2021).
3. **🔴 Zona federal** — borde interno de la franja federal de 20 m.
4. **🟣 Terrenos ganados al mar** — áreas rellenadas registradas oficialmente.
5. Imagen aérea de alta resolución (Esri World Imagery) o Sentinel-2 con fecha conocida (20 dic 2025).
6. Una capa "Pleamar estimada" experimental (off por defecto) derivada del DEM Copernicus 30 m + modelo armónico de marea — útil para contexto pero no para análisis. Ver `/validacion`.

---

## Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind v3 + shadcn/ui
- **Mapa**: MapLibre GL JS via `react-map-gl/maplibre`
- **Tiles vectoriales**: PMTiles servidos como archivos estáticos
- **Tiles raster**: Esri World Imagery + TiTiler.xyz para Sentinel-2 COG
- **Pipeline geoespacial**: Python (`uv`) + GDAL + shapely + tippecanoe
- **Despliegue**: AWS Amplify Hosting (`amplify.yml` con `appRoot: web`)

Detalle completo de stack y dependencias en [docs/DATASETS.md](docs/DATASETS.md) y [scripts/README.md](scripts/README.md).

---

## Estructura del repositorio

```
playaslibres-ai/
├── README.md                    ← este archivo
├── CLAUDE.md                    ← guía para Claude Code
├── RESUMEN_SESION.md            ← bitácora de construcción inicial
├── amplify.yml                  ← config deploy AWS Amplify
├── docs/
│   ├── PROCESO.md               ← el storytelling técnico
│   ├── CASO_LAS_COCINAS.md      ← el dossier del caso
│   ├── DATASETS.md              ← inventario de fuentes
│   └── brand/
│       └── icon.svg             ← logo (favicon, OG, header)
├── scripts/
│   ├── README.md                ← referencia del pipeline
│   ├── 01_download_zofemat.py   ← con fallback al mirror R2 si SEMARNAT cae
│   ├── 02_download_dem.py
│   ├── 03_find_sentinel.py
│   ├── 03b_download_sentinel_cog.py
│   ├── 04_compute_tides.py
│   ├── 05_make_pmtiles.sh
│   ├── 05b_make_floodlines_pmtiles.sh
│   ├── 06_compute_floodlines.py
│   ├── 07_validate.py
│   ├── 08_compute_playa_libre.py
│   ├── run_all.sh
│   └── mirror/                  ← pipeline del mirror cívico ZOFEMAT (ver scripts/README.md)
├── infra/
│   └── worker/                  ← Cloudflare Worker que sirve el mirror con auto-index
├── data/
│   ├── README.md                ← qué hay aquí
│   ├── raw/
│   │   └── zofemat_bb_raw.geojson  ← snapshot fechado SEMARNAT
│   ├── processed/
│   │   ├── zofemat_bb.geojson
│   │   ├── floodlines_bb.geojson
│   │   ├── playa_libre_bb.geojson
│   │   ├── dem_bb.tif
│   │   └── sentinel_bb.tif
│   └── tiles/
│       ├── zofemat_bb.pmtiles
│       ├── floodlines_bb.pmtiles
│       └── playa_libre_bb.pmtiles
├── notebooks/                   ← reservado para fase futura (CoastSat)
└── web/
    ├── app/                     ← Next.js App Router
    │   ├── page.tsx             ← mapa principal
    │   ├── acerca/
    │   ├── metodologia/
    │   ├── validacion/
    │   ├── opengraph-image.tsx
    │   ├── robots.ts
    │   └── sitemap.ts
    ├── components/
    │   ├── Map.tsx              ← componente principal
    │   ├── LayerToggle.tsx
    │   ├── TideSlider.tsx
    │   ├── LegalDisclaimer.tsx  ← welcome modal
    │   ├── Attribution.tsx
    │   └── InfoPanel.tsx        ← dossier disputas
    ├── lib/
    │   ├── pmtiles-protocol.ts
    │   └── tides.ts
    ├── public/
    │   ├── data/                ← JSONs servidos al cliente
    │   └── tiles/                ← PMTiles servidos al cliente
    └── scripts/                 ← QA con Playwright
        ├── inspect-map.mjs
        ├── inspect-welcome.mjs
        ├── inspect-marker.mjs
        └── inspect-collapse.mjs
```

---

## Cómo correrlo desde cero

### 1. Requisitos del sistema (macOS Apple Silicon)

```bash
brew install git node gdal tippecanoe pmtiles uv jq
```

### 2. Pipeline de datos

```bash
git clone <repo-url> playas-libres
cd playas-libres
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
bash scripts/run_all.sh
```

Tiempo aproximado en primera ejecución: ~10 minutos. Ver detalles en [scripts/README.md](scripts/README.md).

### 3. Frontend

```bash
cd web
npm install
npm run dev    # → http://localhost:3000
npm run build  # producción
```

---

## Disclaimer legal

Las capas son **referenciales, no probatorias**. La capa SEMARNAT que muestra el mapa es la **publicación oficial** del gobierno mexicano (vía MapServer ArcGIS de DGFMTAC) — válida para fines de transparencia, periodismo y denuncia ciudadana, pero no sustituye al plano peritado original con firma que requiere la **NOM-146-SEMARNAT-2017** para procesos judiciales. Los datos son del levantamiento 2021 y pueden no reflejar cambios o concesiones posteriores.

---

## Atribución

Datos: Contains modified Copernicus Sentinel data 2025 · Copernicus WorldDEM-30 © DLR/Airbus · Delimitación ZOFEMAT publicada por SEMARNAT (DGZFMTAC) · Mapa base © OpenFreeMap, OpenStreetMap contributors · Imagen aérea © Esri World Imagery · Modelo de marea FES2014 (CNES/LEGOS/CLS).

## Licencia

Código abierto bajo licencia AGPL-3.0.
