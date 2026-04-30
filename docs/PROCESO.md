# Cómo se construyó Playas Libres

> Bitácora del proceso técnico. Para el caso específico que motivó el proyecto, ver [CASO_LAS_COCINAS.md](CASO_LAS_COCINAS.md). Para el inventario de fuentes, ver [DATASETS.md](DATASETS.md).

---

## Punto de partida

En abril de 2026, vecinos de **Punta de Mita** denunciaron en *La Jornada* y *Vallarta Independiente* que el desarrollo hotelero **Cantiles de Mita / Montage** estaba ocupando la zona federal de **Playa Las Cocinas**. SEMARNAT impuso una suspensión temporal. La pregunta que quisimos responder fue concreta: ¿el gobierno mexicano tiene un mapa oficial de la franja federal en esa playa? ¿Y si lo tiene, por qué nadie lo está mirando?

La respuesta a la primera pregunta resultó ser sí. La respuesta a la segunda, también: porque vive escondido en un endpoint de ArcGIS que ningún ciudadano descarga.

Playas Libres es la herramienta que hicimos para que cualquiera pueda mirarlo.

---

## 1. Encontrar la fuente oficial

La **Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros** (DGZFMTAC) de SEMARNAT publica un servicio ArcGIS REST público:

```
https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer
```

Ese servidor expone múltiples capas, una por bahía. La que cubre Bahía de Banderas es la **capa 220, `B_BANDERAS_2021`**. Levantamiento 2021, 1319 features, escala 1:1000, proyección ITRF2008 Z13.

El primer paso fue descargarla como GeoJSON con un query simple:

```
.../MapServer/220/query?where=1=1&outFields=*&f=geojson&outSR=4326
```

Eso lo automatizamos en [`scripts/01_download_zofemat.py`](../scripts/01_download_zofemat.py). Reproyectamos a EPSG:4326 con `ogr2ogr` y dejamos el resultado en `data/processed/zofemat_bb.geojson`.

**Snapshot fechado.** Para garantizar reproducibilidad si SEMARNAT cambia o retira la capa, commiteamos también el GeoJSON crudo (`data/raw/zofemat_bb_raw.geojson`) con metadata de captura inyectada:

```json
{
  "_captured_from": "https://geomaticasig1.semarnat.gob.mx/...",
  "_captured_at": "2026-04-29T...Z",
  "_captured_by": "Playas Libres pipeline",
  "_layer_id": 220,
  "_layer_name": "B_BANDERAS_2021"
}
```

---

## 2. Entender qué nos descargamos

Las 1319 features no son una sola línea. Cada feature tiene una propiedad `Layer` que la clasifica en una de **siete categorías semánticas**:

| Layer | Features | Significado |
|---|---|---|
| `MUELLE` | 347 | Estructuras portuarias |
| `PLEAMAR MAXIMA` | 296 | Línea de pleamar máxima — la frontera mar/tierra |
| `ZONA FEDERAL` | 292 | Borde interno de la franja federal de 20 m |
| `TERRENOS GANADOS MAR` | 184 | Áreas rellenadas artificialmente |
| `MARGEN` | 113 | Marcos de planos topográficos |
| `PLAYA MARITIMA` | 55 | Playa pública entre pleamar y bajamar |
| `MANGLE` | 32 | Manglar inventariado |

Esta clasificación permitió rendear cada categoría con su propio estilo en el mapa, en vez de una capa indiferenciada de líneas rojas. El primer prototipo mostraba todo junto y se veía como un "queso suizo de rectángulos rojos" — los rectángulos resultaron ser la categoría `MARGEN` (marcos de hojas topográficas), que escondimos por defecto.

---

## 3. Validar la regla legal

La Ley General de Bienes Nacionales (art. 119 fr. I) define la ZOFEMAT como una franja de **20 metros tierra adentro** de la pleamar. Antes de construir nada encima, queríamos saber si los datos SEMARNAT cumplen esa regla.

[`scripts/07_validate.py`](../scripts/07_validate.py) hace lo siguiente:

1. Reproyecta las líneas a UTM 13N (EPSG:32613) para trabajar en metros reales.
2. Sobre cada `PLEAMAR MAXIMA`, muestrea un punto cada 5 m.
3. Para cada punto, mide la distancia perpendicular a la `ZONA FEDERAL` más cercana.
4. Compila estadísticas.

Resultado:

| Métrica | Valor | Esperado |
|---|---|---|
| N puntos | 31,584 | — |
| Mediana | **20.00 m** ✅ | ≈20 m |
| Media ± std | 20.91 ± 20.58 m | sesgo por outliers |
| p05 / p95 | 5.00 / 26.87 m | rango central |
| % en 15-25 m | 78.7% | mayoría cumple |
| Máximo | 282 m | outliers en muelles, terrenos ganados |

**Veredicto**: el catastro SEMARNAT cumple la regla legal con consistencia interna alta. Los outliers no son errores — corresponden a tramos donde la zona federal legítimamente se aparta de la pleamar (muelles, escolleras, terrenos ganados al mar autorizados). Esto pasa la prueba como fuente confiable.

El reporte completo se persiste en `web/public/data/validation_report.json` y se renderiza en `/validacion`.

---

## 4. Calcular la franja "Playa libre"

Con dos líneas oficiales (pleamar máxima y zona federal), la franja entre ellas es legalmente la ZOFEMAT pública. Pero las dos líneas son `LineString`, no un polígono.

Probamos dos algoritmos:

### Versión 1: buffer-intersect (descartada)

Buffer de 12 m a cada línea, intersección de los dos buffers. Funciona en tramos rectos pero **deja huecos en curvas** y donde las líneas se separan más de 24 m (caso real: Las Cocinas tiene tramos a 30 m). En el primer prototipo, sobre Las Cocinas la franja salía vacía justo donde más interesa.

### Versión 2: polígono punto-a-punto (en producción)

Para cada par PLEAMAR ↔ ZONA FEDERAL del **mismo plano topográfico**:

1. Detectar orientación correcta comparando extremos.
2. Construir polígono cerrado: pleamar forward + zona federal en reverso + cerrar al inicio.

```
PLEAMAR ────────────►
│                    │
ZONA FED ◄───────────
```

Implementación en [`scripts/08_compute_playa_libre.py`](../scripts/08_compute_playa_libre.py). Usa `shapely.geometry.Polygon` con coordenadas concatenadas, y `shapely.ops.unary_union` para fusionar polígonos solapantes.

Resultado:

| | v1 buffer | v2 polígono exacto |
|---|---|---|
| Cobertura | 219 ha | **267.66 ha** |
| Polígonos | 423 | 48 |
| PMTiles | 228 KB | 159 KB |
| Geometría | aproximada | exacta |

Pintamos la franja en **verde brillante** (`#22c55e`, opacidad 0.55) con outline `#86efac`. Verde porque amarillo tenía mal contraste sobre arena/agua de la imagen Esri.

---

## 5. La capa "ciudadana" y su honestidad

El brief original prometía además una **pleamar estimada** derivada de:
- Copernicus DEM 30 m (modelo digital de elevación)
- Modelo de marea (FES2014 — pero como requiere registro AVISO+ usamos un fallback armónico con 4 constituyentes)

[`scripts/06_compute_floodlines.py`](../scripts/06_compute_floodlines.py) toma el DEM, para cada altura discreta de marea (de −1.0 m a +1.2 m en pasos de 0.2 m) genera la máscara `dem ≤ altura + offset`, vectoriza el contorno y lo simplifica.

**El audit fue brutal**: vs la pleamar oficial SEMARNAT, nuestra línea estimada tiene **mediana de error 26 m, p95 de 11 km, máximo de 16 km**. Solo el 53% de los puntos están dentro de 30 m del oficial.

¿Por qué tan mal?

1. **Copernicus DEM es DSM, no DTM**: mide la superficie (incluyendo edificios y vegetación), no el suelo desnudo. En cantiles y zonas urbanas la cota está inflada decenas de metros.
2. **Datum sin calibrar**: el cero del DEM (geoide EGM2008) no coincide con el nivel medio del mar local. Asumimos offset 0.
3. **Mareas con fallback armónico**: 4 constituyentes hardcodeados, no FES2014. Diferencia 20–50 cm.
4. **Resolución 30 m**: cada pixel = 30×30 m. La precisión teórica máxima.

La decisión honesta: dejar la capa pero **desactivada por defecto**, etiquetada como "experimental", con link directo a `/validacion` donde explicamos por qué no es confiable. La línea estimada sirve para contexto visual aproximado, nunca como referencia legal.

---

## 6. Stack del frontend

- **Next.js 14 App Router + TypeScript**: layout en español (`es-MX`), metadata SEO, OG image en runtime nodejs (estática).
- **MapLibre GL JS** vía `react-map-gl/maplibre`: renderiza tiles vectoriales.
- **PMTiles**: archivos estáticos servidos por Next, leídos con `pmtiles://` protocol via `pmtiles-protocol.ts`.
- **shadcn/ui + Tailwind v3**: Dialog, Slider, Switch, Card. Tuvimos que reescribir el `Switch` porque el default usaba sintaxis Tailwind v4 que no se evaluaba.
- **Esri World Imagery** como fondo aéreo de alta resolución (sub-métrico). Sentinel-2 RGB queda como opción para verificación temporal con fecha conocida (vía TiTiler.xyz).

Páginas:
- `/` — el mapa
- `/acerca` — qué es y por qué existe
- `/metodologia` — fuentes, proceso, referencias legales completas
- `/validacion` — auditoría científica con números
- `/opengraph-image` — OG image generada por `next/og`

---

## 7. UX de capas

Iteramos varias veces. La versión final:

- **Modal de bienvenida** al primer load con disclaimer destacado y leyenda visual.
- **Chips colapsables** abajo a la izquierda — Capas, Marea, Créditos. Por defecto cerrados → ~95% de pantalla para el mapa.
- **Toggle ZOFEMAT con sub-capas individuales** — playa libre, pleamar, zona federal, terrenos ganados, manglar, muelle. Cada uno con switch propio y badge "OFICIAL" en verde.
- **Slider de mareas** con play/pause de 1 hora cada 100 ms, marcadores a las 6 pleamares máximas del año.
- **Hover tooltips** sobre cada línea con descripción legal.
- **Markers de disputas** con dossier completo (tabla de OBJECTIDs, links de verificación SEMARNAT, prensa, marco legal).

---

## 8. QA con Playwright headless

Antes de cualquier deploy corremos `web/scripts/inspect-*.mjs` con Chromium headless:

- `inspect-map.mjs` — verifica que las capas existen, features se renderean, toggles cambian visibility.
- `inspect-welcome.mjs` — modal de bienvenida + sub-capas + zoom a Las Cocinas.
- `inspect-marker.mjs` — marker no se desplaza al hover, click abre InfoPanel con evidencia.
- `inspect-collapse.mjs` — los chips colapsan y expanden correctamente.

Esto encontró bugs reales que no aparecían en logs server-side:
- `mapRef.current` se asignaba dentro de un callback async, los `useEffect` dependientes lo leían null y abortaban.
- TileJSON URL pasada como template `tiles[]` (incorrecto) en vez de `url:` (correcto).
- ZOFEMAT renderizaba rectángulos por usar layer `fill` sobre `LineString`.
- Switch de shadcn usaba clases Tailwind v4 → invisible en v3.
- Marker se desplazaba a (0,0) en hover por sobreescribir el `transform: translate` de MapLibre con `scale`.

---

## 9. Resiliencia y copia local de fuentes

7.7 MB de respaldo commiteados al repo:

- **ZOFEMAT raw 1.7 MB** (snapshot fechado SEMARNAT) — si retiran la capa 220, conservamos la versión auditada.
- **DEM Copernicus recortado 3.9 MB** — independiente de cambios en URLs de AWS Open Data.
- **Sentinel-2 RGB recortado 2.1 MB** — vía `/vsicurl` HTTP range request, NO descargamos la escena entera (~250 MB), solo el bbox de la bahía. Sirve como respaldo si TiTiler.xyz cae.

Lo que sigue siendo dependencia externa: Esri World Imagery, OpenFreeMap, TiTiler.xyz. Si se vuelven inestables, hay que levantar TiTiler propio en docker o cachear tiles en R2/S3.

---

## 10. Despliegue

- **AWS Amplify Hosting** (Gen 2) con `amplify.yml` configurando `appRoot: web`, `baseDirectory: .next`. SSR funcional. Build estática para `/opengraph-image` (runtime nodejs).
- Variable de entorno: `NEXT_PUBLIC_SITE_URL` para metadata SEO y sitemap.
- Cloudflare Pages como alternativa documentada.

---

## Próximos pasos

1. **Calibrar el datum** del DEM contra puntos de costa visibles para reducir el error de la línea estimada.
2. **Activar FES2014** (registro AVISO+ + reimplementación de `compute_fes2014` en pyTMD 3.x).
3. **Levantar TiTiler propio** para no depender de TiTiler.xyz en producción.
4. **Expandir cobertura** a otras playas en disputa: las 105 hojas topográficas SEMARNAT cubren toda la bahía; el caso podría reproducirse para otros municipios costeros.
5. **CoastSat** o similar para análisis temporal de cambios costeros 2015–2025 desde Sentinel-2 series. Fase futura, ya hay carpeta `notebooks/` reservada.

---

## Lo que aprendimos en el camino

- **Los datos del gobierno son mucho más útiles de lo que la gente cree, pero la barrera no es legal sino de descubrimiento.** El MapServer está abierto. La capa 220 estaba ahí desde 2021. Faltaba que alguien la descargara, la ordenara y la mostrara con un botón de "verificar".
- **La validación científica es parte del producto, no un anexo.** Mostrar las incertidumbres reales le da más legitimidad al sitio que esconderlas.
- **El catastro SEMARNAT ya documentó el caso Las Cocinas en 2021.** OBJECTID 344 y 358, categoría TERRENOS GANADOS MAR. La denuncia ciudadana de 2026 no es un grito en el aire — es un dato que el propio gobierno tenía registrado y que la plataforma vuelve visible.

Ver el dossier completo del caso en [CASO_LAS_COCINAS.md](CASO_LAS_COCINAS.md).
