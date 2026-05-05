/**
 * Worker que sirve el mirror SEMARNAT desde el bucket R2 con:
 *  - resolución automática de index.html cuando la URL termina en "/"
 *  - CORS abierto (necesario para PMTiles, geopandas, MapLibre, etc.)
 *  - soporte de Range requests (necesario para PMTiles)
 *  - HEAD pass-through
 *  - cache headers
 *
 * Binding R2 esperado: MIRROR (ver wrangler.toml).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, If-None-Match, If-Modified-Since",
  "Access-Control-Expose-Headers":
    "ETag, Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Max-Age": "3600",
};

const CACHE_CONTROL = "public, max-age=3600";

function withCORS(headers = new Headers()) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return headers;
}

function notFound(path) {
  const body = `Not found: ${path}\n\nTry /semarnat/ for the ZOFEMAT mirror index.\n`;
  return new Response(body, {
    status: 404,
    headers: withCORS(new Headers({ "Content-Type": "text/plain; charset=utf-8" })),
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCORS() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: withCORS(),
      });
    }

    const url = new URL(request.url);
    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    // Si la URL termina en "/" o es vacía, resolvemos a index.html
    if (key === "" || key.endsWith("/")) {
      key = key + "index.html";
    }

    // Range header se reenvía a R2 si está presente
    const range = request.headers.get("range");
    const r2Opts = {};
    if (range) {
      const m = range.match(/^bytes=(\d+)-(\d*)$/);
      if (m) {
        const offset = Number(m[1]);
        const end = m[2] ? Number(m[2]) : undefined;
        const length = end !== undefined ? end - offset + 1 : undefined;
        r2Opts.range = length !== undefined ? { offset, length } : { offset };
      }
    }

    const obj = await env.MIRROR.get(key, r2Opts);
    if (!obj) {
      // Si pidieron una "carpeta" sin index.html, intentar fallback al inventory.json del root
      if (key.endsWith("/index.html") && key !== "index.html") {
        const fallback = await env.MIRROR.get("semarnat/index.html");
        if (fallback) {
          return buildResponse(request, fallback, "semarnat/index.html");
        }
      }
      return notFound(url.pathname);
    }

    return buildResponse(request, obj, key, range);
  },
};

function buildResponse(request, obj, key, rangeHeader) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", CACHE_CONTROL);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }
  withCORS(headers);

  // HEAD: solo headers
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  // Range: status 206 si hubo range request válido
  if (rangeHeader && obj.range) {
    const total = obj.size;
    const start = obj.range.offset ?? 0;
    const length = obj.range.length ?? total - start;
    const end = start + length - 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    headers.set("Content-Length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }

  return new Response(obj.body, { status: 200, headers });
}

function guessContentType(key) {
  if (key.endsWith(".html")) return "text/html; charset=utf-8";
  if (key.endsWith(".json")) return "application/json; charset=utf-8";
  if (key.endsWith(".geojson")) return "application/geo+json; charset=utf-8";
  if (key.endsWith(".geojson.gz")) return "application/gzip";
  if (key.endsWith(".gz")) return "application/gzip";
  if (key.endsWith(".pmtiles")) return "application/vnd.pmtiles";
  if (key.endsWith(".tif") || key.endsWith(".tiff")) return "image/tiff";
  if (key.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (key.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
