# Caso Playa Las Cocinas — Punta de Mita, Nayarit

> Dossier documental del conflicto que motivó la construcción de Playas Libres. Información verificable contra fuentes oficiales y prensa pública.

**Estado:** En conflicto · **Última actualización:** abril 2026

---

## Ubicación

| | |
|---|---|
| Coordenadas | **20.7714° N, 105.5085° O** |
| Localidad | Playa Las Cocinas |
| Municipio | Bahía de Banderas |
| Estado | Nayarit |
| Hoja topográfica SEMARNAT | F13C58 (planos 49 y 50) |

[Ver en Google Maps](https://maps.app.goo.gl/6NfvSTRzPWNTHF7u5) · [Ver en Playas Libres](https://playaslibres.ai/)

---

## Cronología pública

| Fecha | Hito |
|---|---|
| **2021** | SEMARNAT realiza el levantamiento topográfico oficial de la ZOFEMAT en Bahía de Banderas (escala 1:1000, ITRF2008, capa 220 `B_BANDERAS_2021`). El catastro registra dos polígonos en Las Cocinas con categoría **TERRENOS GANADOS MAR** (OBJECTID 344 y 358). |
| **abril 2026** | *La Jornada* publica reportaje sobre la denuncia ciudadana contra el desarrollo Cantiles de Mita / Montage. *Vallarta Independiente* da seguimiento. SEMARNAT impone suspensión temporal. |
| **2026-04-29** | Lanzamiento de Playas Libres. Snapshot del MapServer SEMARNAT capturado y commiteado al repositorio. |

---

## Evidencia documental — registro SEMARNAT 2021

El catastro oficial publicado por la **Dirección General de Zona Federal Marítimo-Terrestre y Ambientes Costeros** (DGZFMTAC) ya documenta, desde el levantamiento 2021, que en Playa Las Cocinas existe un **terreno ganado al mar**.

### Features identificadas

| OBJECTID | Plano | Capa | Fecha lev. | Escala | Proyección |
|---|---|---|---|---|---|
| **344** | F13C58-49 | TERRENOS GANADOS MAR | 2021 | 1:1000 | ITRF2008 Z13 |
| **358** | F13C58-50 | TERRENOS GANADOS MAR | 2021 | 1:1000 | ITRF2008 Z13 |

Bbox geográfico de los polígonos: `(-105.5063, 20.7706) → (-105.5062, 20.7709)`

### Verificación contra MapServer SEMARNAT

Cualquier persona puede consultar estos features directamente contra el servidor oficial — los siguientes URLs descargan el GeoJSON con todas las propiedades:

- **Capa completa**:
  https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer/220
- **OBJECTID 344**:
  `.../MapServer/220/query?where=OBJECTID%3D344&outFields=*&f=geojson&outSR=4326`
- **OBJECTID 358**:
  `.../MapServer/220/query?where=OBJECTID%3D358&outFields=*&f=geojson&outSR=4326`

Estos polígonos están además incluidos en el snapshot fechado del repositorio: `data/raw/zofemat_bb_raw.geojson` (capturado 2026-04-29).

### Qué significa "TERRENOS GANADOS MAR"

En la nomenclatura SEMARNAT, esta categoría identifica **áreas de costa modificadas artificialmente — esto es, suelo firme donde antes había agua**. Pueden corresponder a:
- Rellenos para muelles o escolleras
- Plataformas para construcciones costeras
- Modificaciones autorizadas o no por la propia DGZFMTAC

La categoría no implica per se ilegalidad — **algunas modificaciones tienen concesión vigente** y otras no. Lo que sí establece es un hecho: **en ese punto la línea de costa fue alterada por intervención humana**.

### Geometría observable hoy

En la imagen aérea actual (Esri World Imagery), el área marcada como TERRENOS GANADOS MAR aparece como una **lengua de tierra que se proyecta hacia el mar**, contigua al desarrollo hotelero **Cantiles de Mita / Montage**. Las líneas oficiales de pleamar máxima y zona federal rodean ese relleno serpenteando — geometría inusual que confirma la modificación.

---

## La denuncia ciudadana actual

Vecinos de Punta de Mita, organizados a través de comités vecinales y respaldados por colectivos ambientalistas locales, sostienen que el desarrollo Cantiles de Mita / Montage **extendió la incursión más allá de lo registrado en 2021**. La denuncia incluye:

1. Construcciones nuevas dentro de la franja federal, posteriores al levantamiento SEMARNAT.
2. Bloqueo del acceso público a la playa a través de áreas previamente abiertas.
3. Modificaciones del perfil costero no contempladas en concesiones existentes.

SEMARNAT respondió con una **suspensión temporal** del proyecto. El caso continúa abierto al momento de este escrito.

### Cobertura periodística

- **La Jornada (28 abril 2026)**: ["La naturaleza no se privatiza" – En Bahía de Banderas se oponen al despojo de Playa Las Cocinas](https://www.jornada.com.mx/noticia/2026/04/28/estados/la-naturaleza-no-se-privatiza-en-bahia-de-banderas-se-oponen-al-despojo-de-playa-las-cocinas)
- **Vallarta Independiente (20 abril 2026)**: [Persiste la denuncia de ciudadanos para clausurar desarrollo inmobiliario en Playa Las Cocinas](https://vallartaindependiente.com/2026/04/20/persiste-la-denuncia-de-ciudadanos-para-clausurar-desarrollo-inmobiliario-en-playa-las-cocinas-en-punta-de-mita/)

---

## Marco legal aplicable

| Instrumento | Disposición clave |
|---|---|
| [Constitución, art. 27](https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf) | Las playas y la zona federal marítimo-terrestre son **bienes nacionales de uso común, inalienables e imprescriptibles**. |
| [Ley General de Bienes Nacionales, art. 119](https://www.diputados.gob.mx/LeyesBiblio/pdf/LGBN.pdf) | Define la ZOFEMAT como una franja de **20 metros tierra adentro** de la pleamar máxima. Establece el régimen de concesiones. |
| [NOM-146-SEMARNAT-2017 (DOF)](https://www.dof.gob.mx/nota_detalle.php?codigo=5485172) | Procedimiento técnico para delimitar la ZOFEMAT. **Sólo los planos firmados por perito autorizado y validados por DGZFMTAC tienen valor jurídico**. |
| Reforma 2025 al Reglamento Nacional de Áreas Protegidas | Endurece criterios en áreas costeras sensibles. |

### Tres distinciones importantes

1. **Datos oficiales vs plano peritado**: la capa que muestra Playas Libres es la **publicación oficial digital** del catastro SEMARNAT — referencia válida para periodismo, investigación y denuncia ciudadana. Para procesos judiciales, la NOM-146 requiere el **plano original peritado**, que puede solicitarse a la DGZFMTAC.

2. **Registro vs concesión**: que un polígono aparezca en el catastro como `TERRENOS GANADOS MAR` no implica automáticamente que la modificación tenga concesión vigente. Esa información se solicita por separado a SEMARNAT.

3. **2021 vs hoy**: el catastro publicado es del levantamiento 2021. Modificaciones posteriores **no aparecen** en el dato. La denuncia ciudadana de 2026 sostiene precisamente que se construyó después de esa fecha.

---

## Lo que Playas Libres aporta al caso

1. **Visibilidad**: pone en un mapa público lo que estaba enterrado en un endpoint ArcGIS.
2. **Verificación**: cada feature mostrada tiene su `OBJECTID` y `PLANO` referenciables. El popup del marcador incluye links directos al MapServer SEMARNAT para auditar.
3. **Snapshot fechado**: el repositorio tiene una captura del catastro con timestamp (`_captured_at: 2026-04-29`), inalterable. Si SEMARNAT modifica la capa, conservamos la versión auditada.
4. **Validación científica**: la página `/validacion` audita la consistencia interna de los datos (la regla legal de 20 m se cumple con mediana exacta, p95 = 27 m).
5. **Marco legal accesible**: cada referencia legal lleva al texto oficial en DOF/diputados.gob.mx.

## Lo que Playas Libres NO sustituye

- No es plano peritado.
- No es prueba pericial.
- No suple un peritaje topográfico de campo.
- No determina ilegalidades — solo visualiza datos.

---

## Cómo verificar tú mismo

```bash
# 1. Descargar la capa entera del MapServer SEMARNAT
curl 'https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/zofem/Delimitaciones_ZOFEMAT/MapServer/220/query?where=1=1&outFields=*&f=geojson&outSR=4326' \
  -o zofemat_banderas.geojson

# 2. Filtrar las features de Las Cocinas
jq '[.features[] | select(.properties.OBJECTID == 344 or .properties.OBJECTID == 358)]' zofemat_banderas.geojson

# 3. O abrir el GeoJSON en QGIS, ArcGIS, geojson.io, kepler.gl, etc.
```

O simplemente abrir el sitio: https://playaslibres.ai/, hacer click en el marcador ⚠ amarillo de Las Cocinas, y desde el panel verificar contra cualquiera de los 3 links a SEMARNAT, los 2 links de prensa y los 3 links de marco legal.

---

## Si querés contribuir

- **Reportar errores en el dossier**: abrir issue en el repositorio.
- **Documentar otros casos**: el formato `disputas.json` está diseñado para extenderse a otras playas en disputa con `evidence`, `links` y `legal_refs`.
- **Validar in situ**: peritajes topográficos comparativos contra el catastro 2021 — para distinguir entre construcción registrada y construcción posterior.
- **Reportería**: cobertura periodística vinculable desde el sitio.

El proyecto es código abierto bajo licencia AGPL-3.0.
