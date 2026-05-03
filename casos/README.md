# Casos — Zonas en disputa

Este directorio reúne **dossiers de casos** documentados de invasión, modificación o conflicto en zona federal marítimo-terrestre (ZOFEMAT) y áreas costeras de uso común.

Cada subdirectorio es un caso. La estructura está diseñada para ser:

1. **Auditable**: cada afirmación se respalda en una fuente verificable (oficial o periodística).
2. **Versionable**: cambios pasan por PR; el historial git es la cronología.
3. **Procesable**: un script lee todos los casos y genera el índice que consume el mapa.

## Estructura de un caso

```
casos/<slug>/
  caso.mdx              # obligatorio — frontmatter YAML + cuerpo libre
  poligono.geojson      # opcional — zona reclamada como invadida (EPSG:4326)
  evidencia/            # opcional — fotos, capturas, PDFs
    <archivo>.{jpg,png,pdf,md}
  timeline.mdx          # generado por scripts/12_consolidate_case.py (no editar a mano)
  cambios.json          # generado por scripts/11_change_detection.py
```

El `<slug>` es minúsculas, sin acentos, separado por guiones. Ej: `las-cocinas`, `nuevo-vallarta-norte`, `bucerias-frente`.

## Cómo proponer un caso (flujo PR)

1. **Abrir un Issue** usando la plantilla *"Reportar caso de invasión"* — si no estás familiarizado con git, este es el camino. Un mantenedor convertirá el reporte en PR.
2. **O abrir un PR directo** con la estructura de arriba. La plantilla de PR de Caso (`.github/PULL_REQUEST_TEMPLATE/caso.md`) tiene el checklist completo.
3. **El CI valida** schema, fuentes, y geometría antes de poder merge.

## Reglas no negociables

- **Cita obligatoria**: cada afirmación material requiere `fuentes[]` con URL verificable.
- **Sin datos personales sin consentimiento**: nombres de denunciantes individuales, teléfonos, direcciones particulares — nunca.
- **Sin acusaciones sin sustento documental**: usar lenguaje cauto (`presunto`, `denunciado`, `según vecinos`) cuando la afirmación no tenga respaldo en expediente oficial o nota periodística firmada.
- **Disclaimer aplica**: este sitio no produce efectos jurídicos. Los casos publicados son herramienta de transparencia y periodismo, no prueba pericial.

## Ver el schema completo

→ [`SCHEMA.md`](SCHEMA.md)
