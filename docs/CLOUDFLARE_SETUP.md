# Cloudflare — Setup operativo

Guía paso a paso para poner el dominio de Playas Libres detrás de Cloudflare:
analítica sin cookies, mitigación de DDoS/bots, rate limiting y cache agresivo
para los `.pmtiles`.

> **Antes de empezar.** Necesitas (1) acceso al registrador del dominio
> `playas-libres.mx` para cambiar nameservers, (2) una cuenta gratis en
> [cloudflare.com](https://cloudflare.com), (3) la URL de hosting actual
> — este proyecto se despliega en **AWS Amplify Hosting** (ver `amplify.yml`),
> que expone un dominio del tipo `main.dXXXXXX.amplifyapp.com`.

---

## 1. Activar Cloudflare como proxy DNS

1. En el dashboard de Cloudflare → **Add a site** → `playas-libres.mx` → plan
   **Free**.
2. Cloudflare escanea registros DNS existentes. Verifica que estén:
   - `CNAME` raíz (o `www`) apuntando al dominio Amplify del proyecto
     (`main.dXXXXXX.amplifyapp.com`). En Amplify → **Domain management** →
     "Add domain" — el wizard genera el certificado ACM y los registros DNS
     a copiar.
   - Si Amplify pide validación con un registro `_<hash>.playas-libres.mx`
     CNAME, créalo en Cloudflare con la nube **gris ⚪** (DNS only) — es solo
     validación, no debe ir proxied.
   - Cualquier `MX` / `TXT` (SPF, DKIM) que ya uses para email — todos en
     gris ⚪.
3. **Importantísimo**: la nube naranja 🟠 (proxied) debe estar encendida en los
   registros web (`@` y `www`). Si la dejas gris ⚪ (DNS only), Cloudflare no
   ve el tráfico y todo lo demás de esta guía no aplica.
4. Copia los dos nameservers que te asigna Cloudflare y cámbialos en tu
   registrador. Propagación: minutos a 24 h.
5. Espera al email "Cloudflare is now protecting your site". Verifica en
   `dig NS playas-libres.mx`.

---

## 2. SSL/TLS y HTTPS forzado

Dashboard del dominio → **SSL/TLS**:

- **Overview** → modo `Full (strict)`. AWS Amplify sirve HTTPS válido con
  certificado ACM, así que esto funciona sin ajustes adicionales. **No usar
  `Flexible`** — rompe el handshake con Amplify y degrada la seguridad.
- **Edge Certificates**:
  - `Always Use HTTPS` → **On**.
  - `Automatic HTTPS Rewrites` → **On**.
  - `Minimum TLS Version` → **TLS 1.2**.
  - `HTTP Strict Transport Security (HSTS)` → **Enable** con
    `max-age=15552000` (6 meses), incluir subdominios, no preload todavía
    (preload es difícil de revertir; activar solo cuando estés seguro).

---

## 3. Seguridad — WAF, bots, DDoS

Dashboard → **Security**:

- **Settings**:
  - `Security Level` → **Medium**.
  - `Bot Fight Mode` → **On** (detecta bots simples sin captcha visible).
  - `Challenge Passage` → 30 minutos.
  - `Browser Integrity Check` → **On**.
- **WAF → Managed Rules** (en Free): activar el ruleset gratuito por defecto.
- **WAF → Custom Rules** (5 reglas gratis). Recomendadas:

  | # | Nombre | Expresión | Acción |
  |---|--------|-----------|--------|
  | 1 | Bloquear países con tráfico de scraping conocido (opcional) | `(ip.geoip.country in {"RU" "CN" "KP"})` | Managed Challenge |
  | 2 | Permitir Googlebot/Bingbot legítimos | `(cf.client.bot)` | Skip → Bot Fight Mode |
  | 3 | Bloquear hotlink a tiles desde dominios ajenos | `(http.request.uri.path contains "/tiles/" and not http.referer contains "playas-libres.mx" and not http.referer eq "")` | Block |

  > Las dos primeras son opcionales y dependen de quién quieras dejar entrar.
  > La #3 evita que terceros se cuelguen de tu CDN para servir los PMTiles
  > pesados.

- **DDoS** → ya activo por defecto en Free (L3/4 + L7 básicos).
- **"Under Attack Mode"** → kill-switch manual. Activarlo solo si detectas un
  ataque real; muestra interstitial JS challenge a todos los visitantes durante
  ~5 segundos. Está en `Security → Settings → Security Level → I'm Under Attack`.

---

## 4. Rate limiting (Free incluye 1 regla)

Dashboard → **Security → Rate limiting rules** → **Create rule**:

- **Nombre**: `general-throttle`
- **Match**: `(http.request.uri.path eq "/")` o más amplio
  `(http.host eq "playas-libres.mx")`.
- **Counting characteristics**: IP address.
- **Period**: 10 segundos.
- **Requests**: 20.
- **Action**: `Block` durante 60 segundos.

Para los tiles (que sí reciben muchas requests legítimas por sesión, MapLibre
hace HTTP range requests), **excluir la ruta**:

- Crea una segunda regla con period 10s / 200 requests / path `/tiles/*` si
  necesitas; o ajusta la primera para excluir `/tiles/`.

> En Free solo tienes **1 regla activa de rate limiting**. Prioriza proteger
> rutas costosas (HTML del root, futura `/api/*`) y deja los tiles servidos
> desde caché.

---

## 5. Cache agresivo para `.pmtiles`

Los PMTiles son estáticos e inmutables hasta el siguiente `bash scripts/run_all.sh`.
Conviene cachearlos en el edge de Cloudflare durante mucho tiempo.

Dashboard → **Caching → Cache Rules** → **Create rule**:

- **Nombre**: `pmtiles-immutable`
- **Match**: `(http.request.uri.path contains "/tiles/" and ends_with(http.request.uri.path, ".pmtiles"))`
- **Settings**:
  - `Cache eligibility` → **Eligible for cache**.
  - `Edge TTL` → **Override origin** → 1 month.
  - `Browser TTL` → **Override origin** → 1 day (los browsers ya hacen range
    requests; un TTL bajo permite invalidar tras republicar).
  - `Respect strong ETags` → **On**.

> Cuando republiques tiles tras correr el pipeline:
> Dashboard → **Caching → Configuration → Purge Cache** → "Custom purge" →
> URL del `.pmtiles` afectado. Tarda ~30 s en propagarse globalmente.

> Nota: el header `Cache-Control: max-age=0, must-revalidate` que
> `web/next.config.mjs` envía hoy es para evitar tiles cacheados
> incorrectamente en **dev local**. Cloudflare puede sobreescribirlo con la
> regla anterior en producción sin tocar el código.

---

## 6. Web Analytics (sin cookies, sin banner)

1. Dashboard → **Analytics & Logs → Web Analytics** → **Add a site**.
2. Selecciona "Automatic setup" si tu sitio ya está proxied por Cloudflare,
   o "Manual setup" para obtener el token y pegarlo como variable de entorno.
3. Copia el `data-cf-beacon` token (formato `abc123...`).
4. En **AWS Amplify Console** → la app → **Hosting → Environment variables** →
   añade:
   ```
   NEXT_PUBLIC_CF_ANALYTICS_TOKEN=abc123...
   ```
   El prefijo `NEXT_PUBLIC_` es necesario para que Next.js lo embeba en el
   bundle del cliente. Asegúrate de que `amplify.yml` lo expone al build (las
   variables `NEXT_PUBLIC_*` se inyectan automáticamente en `next build`).
5. Trigger redeploy desde la consola de Amplify (o push vacío a `main`). El componente [`CloudflareAnalytics`](../web/components/CloudflareAnalytics.tsx)
   inyecta el beacon automáticamente cuando la variable existe; en local sin
   variable, no carga nada.
6. Verifica en DevTools → Network → debe aparecer una request a
   `static.cloudflareinsights.com/beacon.min.js` y luego POSTs a
   `cloudflareinsights.com/cdn-cgi/rum`.

> Cloudflare Web Analytics no usa cookies ni huellas de navegador, por lo que
> **no requiere banner de consentimiento** bajo GDPR/LFPDPPP. Esto encaja con
> el tono de transparencia ciudadana del proyecto.

---

## 7. Scrape Shield y endurecimiento adicional

Dashboard → **Scrape Shield**:

- `Email Address Obfuscation` → **On** (ofusca cualquier `mailto:` en el HTML).
- `Server-side Excludes` → **On**.
- `Hotlink Protection` → **Off** (los tiles ya están cubiertos por la regla
  WAF #3; activar esto rompería previsualizaciones legítimas en redes
  sociales).

---

## 8. Checklist de verificación

Después del setup, valida con:

```bash
# DNS apunta a Cloudflare
dig +short playas-libres.mx
# Debe devolver IPs en rangos 104.16.x.x / 172.64.x.x / 198.41.x.x

# HTTPS forzado
curl -I http://playas-libres.mx
# Debe devolver 301 → https://...

# HSTS activo
curl -sI https://playas-libres.mx | grep -i strict-transport
# strict-transport-security: max-age=15552000; includeSubDomains

# Tiles cacheados en edge
curl -sI https://playas-libres.mx/tiles/playa_libre_bb.pmtiles | grep -i cf-cache
# cf-cache-status: HIT (tras la segunda request)

# Beacon de analítica cargando
# Abrir https://playas-libres.mx en incógnito + DevTools, buscar:
# - GET https://static.cloudflareinsights.com/beacon.min.js → 200
# - POST https://cloudflareinsights.com/cdn-cgi/rum → 204
```

---

## 9. Operaciones recurrentes

- **Tras cada `bash scripts/run_all.sh`** que regenere PMTiles: Purge selectivo
  del archivo `.pmtiles` (sección 5).
- **Tras cada deploy del frontend**: nada — Vercel/Netlify maneja su propio
  cache; Cloudflare respeta `Cache-Control` del HTML por defecto.
- **Si se detecta un pico anómalo de tráfico**: revisa
  `Security → Events`, identifica patrones (país, ASN, path), y crea regla WAF
  custom específica antes de activar "Under Attack Mode".
- **Mensual**: revisa `Analytics → Security` para ajustar reglas según falsos
  positivos.
