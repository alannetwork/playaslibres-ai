<!--
Plantilla específica para PRs que agregan o actualizan un caso bajo casos/<slug>/.
Para PRs de código, ignorá esta plantilla y describí los cambios libremente.
-->

## Caso

- **Slug**: `<las-cocinas>`
- **Nombre**: 
- **Tipo de cambio**: nuevo caso · actualización · cambio de estado · cierre

## Resumen

Una o dos líneas. Qué cambia y por qué.

## Checklist obligatorio

- [ ] El directorio sigue la estructura de `casos/SCHEMA.md`.
- [ ] `caso.mdx` tiene frontmatter YAML válido (corrí `python scripts/09_validate_casos.py <slug>` localmente).
- [ ] Hay al menos una fuente verificable en `fuentes[]` con URL pública.
- [ ] **No** hay datos personales de terceros sin consentimiento (nombres, teléfonos, direcciones particulares).
- [ ] Lenguaje cauto cuando la afirmación no tiene sustento documental directo (`presunto`, `denunciado`, `según vecinos`).
- [ ] Si toca `poligono.geojson`: está en EPSG:4326 y abre correctamente en geojson.io o QGIS.
- [ ] Reconozco que este sitio no produce efectos jurídicos.

## Fuentes citadas

<!-- Pegá aquí las URLs principales para revisión rápida -->

- 

## Para mantenedores

- [ ] CI pasó (`validate-casos`).
- [ ] Geometría revisada en visor (si aplica).
- [ ] Si es nuevo caso: corrí `python scripts/10_build_casos_index.py` y `casos.json` está actualizado.
