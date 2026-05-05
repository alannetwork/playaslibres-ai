# Worker: playaslibres-mirror

Cloudflare Worker que sirve el mirror SEMARNAT desde R2 con:

- **Auto-index**: requests a `/semarnat/` resuelven `index.html` automáticamente.
- **CORS abierto**: permite consumo desde MapLibre, geopandas, browser.
- **Range requests**: necesario para PMTiles y descargas parciales grandes.
- **Cache control** + **ETag** + **content-type** correcto por extensión.

## Cómo desplegar

Desde `infra/worker/`:

```bash
# 1. Login una vez (abre navegador)
npx wrangler login

# 2. Deploy
npx wrangler deploy
```

Wrangler te dará la URL de producción tipo:

```
https://playaslibres-mirror.<tu-account-subdomain>.workers.dev
```

## Cómo probar

```bash
# Auto-index (esto antes daba 404 con r2.dev directo)
curl -I https://playaslibres-mirror.<sub>.workers.dev/semarnat/

# Capa específica
curl -O https://playaslibres-mirror.<sub>.workers.dev/semarnat/zofem/zofem__Delimitaciones_ZOFEMAT/0220__B_BANDERAS_2021.geojson.gz

# Range request (para PMTiles)
curl -H "Range: bytes=0-1023" https://playaslibres-mirror.<sub>.workers.dev/semarnat/inventory.json
```

## Arquitectura

```
[ Cliente ]
     │
     ▼
[ Worker (este código) ]
     │
     │ env.MIRROR.get(key, {range})
     ▼
[ R2 bucket: delimitacioneszofemat ]
```

El binding R2 está en [wrangler.toml](wrangler.toml). El código en [src/index.js](src/index.js).

## Cómo desarrollar localmente

```bash
npx wrangler dev
# luego en otra terminal:
curl http://localhost:8787/semarnat/
```

## Costos

Cloudflare Workers tiene un free tier generoso:
- 100,000 requests/día gratis
- $5/mes para 10M requests adicionales

Para un mirror de tráfico moderado (cientos a miles de visitas/día), el free tier alcanza con holgura.

## Custom domain (opcional, recomendado)

Cuando tengas listo un subdominio (ej. `mirror.playaslibres.ai`):

```bash
npx wrangler triggers deploy
```

Y agregas en `wrangler.toml`:

```toml
routes = [
  { pattern = "mirror.playaslibres.ai/*", zone_name = "playaslibres.ai" }
]
```

## Cómo actualizar

Cualquier cambio en `src/index.js` se publica con `npx wrangler deploy`.
Los archivos del bucket no se tocan desde el Worker — se siguen subiendo
con `bash scripts/mirror/02_upload_r2.sh`.
