# Mirror cívico ZOFEMAT (SEMARNAT)

Este bucket contiene una copia espejo de las **delimitaciones de Zona Federal Marítimo-Terrestre (ZOFEMAT)** publicadas por la Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT) en su servidor de geomática `geomaticasig1.semarnat.gob.mx`.

## Por qué existe este mirror

- **Resiliencia**: si el servidor oficial cae, esta copia sigue disponible para consulta y descarga.
- **Reproducibilidad**: el proyecto [Playas Libres](https://github.com/alanestrada/playaslibres-ai) depende de ZOFEMAT; este espejo permite que cualquiera clone el repo y corra la pipeline aunque SEMARNAT esté caído.
- **Trazabilidad histórica**: cada snapshot conserva fecha de captura, permitiendo detectar cambios en delimitaciones oficiales a lo largo del tiempo.

## Qué encontrarás

```
semarnat/
├── README.md                 (este archivo)
├── inventory.json            (manifest: capas y metadata, fecha de captura)
├── inventory_summary.txt     (resumen humano legible)
└── zofem/
    └── zofem__Delimitaciones_ZOFEMAT/
        ├── 0001__<municipio_o_zona>.geojson.gz   (datos vectoriales en EPSG:4326)
        ├── 0001__<municipio_o_zona>.meta.json    (metadata original)
        ├── 0002__...
        └── ...                                   (411 capas, una por delimitación)
```

Cada capa es una delimitación oficial publicada por la **DGZFMTAC** (Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros) de SEMARNAT.

## Limitaciones importantes

- **No es fuente oficial**. Para efectos jurídicos consulta directamente el portal de SEMARNAT y los planos validados conforme a la **NOM-146-SEMARNAT-2017**.
- **Snapshot fechado**: mira `inventory.json → fetched_at` para saber la fecha de captura.
- **Solo geometría vectorial** en EPSG:4326. Los planos firmados por perito tienen formatos adicionales no espejados aquí.

## Licencia y atribución

Los datos originales son propiedad de **SEMARNAT** y se publican como datos abiertos de gobierno. Si los reutilizas, cita:

> Fuente: Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT) — Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros (DGZFMTAC), `geomaticasig1.semarnat.gob.mx`. Espejo no oficial mantenido por el proyecto Playas Libres.

Los scripts que generan este mirror están publicados bajo **AGPL-3.0** en https://github.com/alanestrada/playaslibres-ai (carpeta `scripts/mirror/`).

## Cómo usar las capas

### Buscar la delimitación de un municipio específico

```bash
curl -s https://<bucket-public-base>/semarnat/inventory.json \
  | jq '.folders.zofem.services[0].layers[] | select(.name | test("BANDERAS"; "i"))'
```

### Descargar una capa

```bash
curl -O https://<bucket-public-base>/semarnat/zofem/zofem__Delimitaciones_ZOFEMAT/0220__B_BANDERAS_2021.geojson.gz
gunzip 0220__B_BANDERAS_2021.geojson.gz
```

### Cargar en QGIS / GeoPandas

```python
import geopandas as gpd
gdf = gpd.read_file("0220__B_BANDERAS_2021.geojson")
```

## Cobertura

Una capa por cada delimitación municipal/zonal publicada por la DGZFMTAC. Cubre los **17 estados costeros** de México (Pacífico, Golfo, Caribe).

## Reportar problemas

Issues y propuestas: https://github.com/alanestrada/playaslibres-ai/issues
