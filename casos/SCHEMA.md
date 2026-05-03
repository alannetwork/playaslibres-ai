# Schema — `caso.mdx`

Cada caso es un archivo MDX con **frontmatter YAML obligatorio** y un cuerpo libre en Markdown.

El frontmatter es lo que el sitio consume; el cuerpo es para humanos (dossier extendido, contexto, antecedentes).

## Frontmatter — campos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `slug` | string | sí | Debe coincidir con el nombre del directorio. `[a-z0-9-]+`. |
| `nombre` | string | sí | Nombre legible. Ej: `"Playa Las Cocinas"`. |
| `estado` | enum | sí | `en_conflicto` \| `suspendido` \| `resuelto` \| `archivado`. |
| `ubicacion.lat` | float | sí | Latitud en grados decimales (EPSG:4326). |
| `ubicacion.lon` | float | sí | Longitud en grados decimales. |
| `ubicacion.municipio` | string | sí | Municipio. |
| `ubicacion.estado_mx` | string | sí | Estado de la república. |
| `fecha_apertura` | date (`YYYY-MM-DD`) | sí | Cuándo se documentó. |
| `ultima_actualizacion` | date | sí | Última edición material del dossier. |
| `resumen` | string | sí | 1–3 oraciones. Aparece en el panel del mapa. |
| `responsable_presunto` | object \| null | no | `{nombre, tipo}`. `tipo` ∈ `desarrollo_inmobiliario` \| `concesionario` \| `particular` \| `desconocido`. |
| `expediente_oficial[]` | array | no | Lista de actos/expedientes oficiales. Ver abajo. |
| `fuentes[]` | array | sí (≥1) | Lista de fuentes verificables. Ver abajo. |
| `poligono_zofemat_objectids[]` | array<int> | no | OBJECTIDs del MapServer SEMARNAT capa 220 vinculados al caso. |
| `coords_bbox` | array<float, 4> | no | `[lon_min, lat_min, lon_max, lat_max]` para change detection. Si se omite, se infiere del polígono. |
| `marco_legal[]` | array | no | Referencias a normas aplicables específicas del caso. El sitio ya muestra un marco legal general (Constitución art. 27, LGBN, NOM-146); usar este campo solo cuando el caso invoque normas adicionales o quiera resaltar alguna. Ver sub-schema. |
| `contribuyente` | string | no | Atribución del autor del PR. `@handle` o `anonymous`. |
| `contacto` | string \| null | no | Solo si la persona quiere ser contactable. **Nunca** datos personales de terceros. |

### `fuentes[]` — sub-schema

```yaml
fuentes:
  - tipo: prensa            # prensa | oficial | redes | testimonio | foto | video | documento
    titulo: "..."           # obligatorio
    url: "https://..."      # obligatorio si tipo != testimonio
    medio: "La Jornada"     # obligatorio si tipo == prensa
    autoridad: "SEMARNAT"   # obligatorio si tipo == oficial
    fecha: 2026-04-28       # obligatorio (YYYY-MM-DD o YYYY-MM o YYYY)
    descripcion: "..."      # opcional
```

### `marco_legal[]` — sub-schema

```yaml
marco_legal:
  - tipo: ley                # constitucion | ley | reglamento | norma | tratado | otro
    titulo: "..."            # obligatorio
    url: "https://..."       # obligatorio (idealmente DOF o sitio oficial)
    articulo: "27"           # opcional
    descripcion: "..."       # opcional
```

### `expediente_oficial[]` — sub-schema

```yaml
expediente_oficial:
  - tipo: suspension_temporal      # suspension_temporal | clausura | concesion | denuncia | resolucion | otro
    autoridad: "SEMARNAT"
    fecha: 2026-04
    referencia: "OFI-..."          # número de expediente si es público
    descripcion: "..."
    url: "https://..."             # si está publicado
```

## Ejemplo mínimo

```yaml
---
slug: ejemplo-playa
nombre: "Playa Ejemplo"
estado: en_conflicto
ubicacion:
  lat: 20.7700
  lon: -105.5500
  municipio: "Bahía de Banderas"
  estado_mx: "Nayarit"
fecha_apertura: 2026-05-01
ultima_actualizacion: 2026-05-01
resumen: "Vecinos denuncian construcción nueva dentro de zona federal."
fuentes:
  - tipo: prensa
    titulo: "Reportaje sobre la denuncia"
    medio: "Medio Local"
    fecha: 2026-04-28
    url: "https://medio.example/nota"
contribuyente: "@anonymous"
---

Cuerpo libre en Markdown...
```

## Archivos auto-generados (no editar a mano)

- `web/public/data/casos.json` — índice consolidado para el frontend. Lo genera `scripts/10_build_casos_index.py` e incluye un `timeline[]` cronológico armado a partir de `fuentes[]` + `expediente_oficial[]`.
- `casos/<slug>/cambios.json` — opcional. Lo genera `scripts/11_change_detection.py` y contiene escenas Sentinel-2 antes/después del periodo del caso, más un link a EO-Browser para inspección visual.

## Validación

```bash
python scripts/09_validate_casos.py            # valida todos
python scripts/09_validate_casos.py las-cocinas # un solo caso
```

El CI corre lo mismo en cada PR que toque `casos/`.
