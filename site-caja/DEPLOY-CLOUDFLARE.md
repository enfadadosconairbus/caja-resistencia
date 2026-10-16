# Despliegue en Cloudflare Workers — Web B (caja de resistencia)

Runbook para publicar `site-caja/` en **Cloudflare Workers** (migrada de Vercel a
**vinext**). Todos los comandos se ejecutan desde este directorio:

```bash
cd clientes/caja-resistencia/site-caja
```

## Qué es este despliegue

Una sola pieza en Cloudflare: **frontend Next.js (vía vinext) + middleware i18n +
`/api/visitas` (Durable Object) + assets**, todo en un Worker llamado
`caja-resistencia-huelga-airbus-2026`.

- **El dinero NUNCA pasa por Cloudflare.** La transferencia va directa al IBAN de ÚTIL; cuando
  entre Stripe, irá del visitante a Stripe y de Stripe al banco. Cloudflare solo sirve la web.
- **Cuenta Cloudflare:** `enfadadosconairbus.contacto@gmail.com`.
- **Contador de visitas:** Durable Object `VisitasCounter`. Se crea solo en el primer deploy
  (migración `v1`), arranca en 0 y cuenta solo esta web.

## 1. Login (una vez por máquina)

```bash
npx wrangler login
```

Abre el navegador → inicia sesión con **enfadadosconairbus.contacto@gmail.com** → autoriza.
Comprueba que estás en la cuenta correcta:

```bash
npx wrangler whoami
```

## 2. Antes de desplegar (comprobaciones)

```bash
npx tsc --noEmit        # tipos limpios
npm run build:vinext    # debe terminar en "Build complete"
```

- Si tienes el preview local de wrangler abierto (`caja-b-vinext`, puerto 8788), **ciérralo
  antes de construir**: bloquea `dist/` y el build falla con `EPERM`.
- Opcional, rendimiento: `npm run audit:prod` (mide LCP y puntuación; ver `../../../CLAUDE.md`).

## 3. Desplegar

```bash
npm run build:vinext
npm run deploy:vinext
```

`deploy:vinext` = `scripts/desplegar-cloudflare.mjs` (desde el 30-sep-2026). Sube la versión con
`wrangler versions upload` y la activa con `wrangler versions deploy` **sin volver a aplicar los
dominios**. El script **no construye**: se niega si el build es más viejo que `src/`, `public/` o
la config.

**Corte de 503 al publicar: acotado, sin causa raíz.** Al entrar una versión nueva, durante unos
segundos, algunas peticiones reciben un **503 vacío** (sin cuerpo, `server: cloudflare`).

Lo que se ha medido, con una sonda cada 0,3 s a los dos hosts y a cuatro recursos:

| | resultado |
|---|---|
| **NO es el dominio propio** | workers.dev falla igual (18 × 503 en el mismo despliegue). Lo anterior decía lo contrario porque no se sondeaba workers.dev **sin caché** |
| **NO son los ficheros estáticos** | el modelo (`.gltf`) aguantó 168/168 en ambos hosts, incluso sin caché |
| **Falla lo que EJECUTA el Worker** | solo las peticiones a `/es` con `?…` (fallo de caché). Las cacheadas: 168/168 |
| **Solo cuando el despliegue cambia contenido** | un redespliegue del mismo build dio **0 × 503 en 1.128 peticiones**, con `wrangler tail` sin un solo error |

**Los 503 NO llegan al Worker.** Capturado el 30-sep-2026 en un despliegue que sí cambiaba
contenido: la sonda vio **39 × 503** (18 por el dominio, 19 por workers.dev, 2 en páginas
cacheadas) y `wrangler tail`, escuchando a la vez, registró **442 peticiones con cero errores y
cero 5xx**. Es decir: el borde de Cloudflare responde 503 **antes** de invocar el Worker, durante
la ventana en que se propaga la versión nueva. **No es código nuestro**, y por eso no hay
excepción que arreglar.

**Despliegue en dos tiempos (puesto el 30-sep-2026).** `deploy:vinext` ya no salta del 0 al 100 %:
sube la versión, le da el **10 %** del tráfico durante **12 s** y luego la lleva al 100 %. La
apuesta es que ese primer tramo dé tiempo a la propagación y el salto ya no corte. De regalo hace
de canario: si la versión nueva estuviera rota, solo la ve ese 10 % durante la espera.

⚠ **NO está demostrado que arregle los 503.** Hubo un momento en que se dio por bueno con una
sola medición; el siguiente despliegue lo desmintió. Todo lo medido, con la misma sonda (cada
0,3 s, dos hosts, cuatro recursos):

| | 503 |
|---|---|
| **Control: la sonda sola, sin desplegar** | **0** de 1.744 → la sonda no los provoca |
| Salto directo al 100 %, con cambios | 39 · 41 |
| En dos tiempos, con cambios | **1** · **189** · 15 · 2 |

O sea: **desplegar sí los provoca**, pero los dos tiempos no lo arreglan de forma fiable — la peor
medición de todas es de un despliegue en dos tiempos. En esa, los fallos empezaron justo al
repartir el tráfico y siguieron 35 s después de pasar al 100 %, siempre en peticiones sin caché.

Observado el 1-oct-2026 (despliegue del buzón): con la versión ya al 100 %, el **dominio propio
siguió sirviendo la versión anterior** más de un minuto —la ruta nueva daba 404 en el dominio y
400 (la respuesta correcta) en workers.dev—. Es otra cara de la misma propagación: tras publicar,
probar primero en workers.dev y esperar a que el dominio se ponga al día.

Se mantiene la vía en dos tiempos **por el canario**, no por los 503: una versión rota solo la
vería ese 10 % durante la espera. Hacen falta más muestras para decir algo del corte; como cada
despliegue da una gratis, basta con lanzar la sonda al publicar.

`DESPLIEGUE_DIRECTO=1` vuelve al salto de siempre; `DESPLIEGUE_RAMPA` / `DESPLIEGUE_ESPERA`
afinan el porcentaje y la espera.

**Buzón de sugerencias (1-oct-2026).** Tres piezas de Cloudflare, todas en `wrangler.jsonc`:

- **Email Routing** activado en `cajaderesistencia-asi-no.org` (`wrangler email routing enable`).
  Añadió los registros MX y SPF del dominio, que antes no tenía ninguno. Destino dado de alta:
  enfadadosconairbus.contacto@gmail.com, que quedó **verificado al instante** por ser el correo de
  la propia cuenta de Cloudflare. Otra dirección necesitaría pulsar el correo de verificación, y
  hasta entonces cada envío fallaría (el visitante vería el error con la dirección para escribir).
- **`send_email` → `BUZON`**, con `destination_address`: solo puede escribir a esa dirección.
  Enviar a direcciones propias verificadas es gratis en todos los planes.
- **`ratelimits` → `LIMITE_BUZON`**: 3 envíos por minuto y conexión.
- **Turnstile**: widget «Buzón de sugerencias» (modo *managed*) para el dominio y el host
  workers.dev. La clave del sitio es pública y va en `vars`. La secreta se pone con
  `npm run buzon:secreto`, que la lee del widget y se la pasa a `wrangler secret put` sin imprimirla
  (y publica al momento una versión con el mismo código y el secreto). Sin ella, el servidor no
  comprueba el token.

En local, `wrangler dev` **no envía** nada: guarda cada correo en
`dist/server/.wrangler/tmp/email/…` y lo anuncia en el registro.

**Despliegue completo** (`npm run deploy:vinext:completo`, el `vinext-cloudflare deploy` de
siempre). Solo hace falta cuando cambian en `wrangler.jsonc` las `routes` o dominios, `workers_dev`,
o cuando se añade una **migración de Durable Objects**. Esas cosas no viajan con una versión. Acepta
el parpadeo de 503. Ese config (`dist/server/wrangler.json`) lo genera el build a partir de
`wrangler.jsonc`, con las Durable Objects dentro.

**En el primer deploy**, Cloudflare:
- crea el Worker `caja-resistencia-huelga-airbus-2026`,
- **aplica la migración `v1`** de la Durable Object (`VisitasCounter`),
- te devuelve una URL `https://caja-resistencia-huelga-airbus-2026.<subdominio>.workers.dev`.

## 4. Verificar

Abre la URL `workers.dev` y comprueba:
- `/` redirige a `/es` (i18n). ✅
- Portada, `/es/la-caja` (transparencia + IBAN) y `/es/gobernanza` cargan. ✅
- El contador del footer **sube al recargar** (Durable Object). ✅
- Fuentes propias: DevTools → Network → los `.woff2` salen de tu dominio, no de Google. ✅
- `/robots.txt` → `Disallow: /` mientras `SITE_INDEXABLE` sea `"false"` (correcto: aún no
  queremos indexar el `workers.dev`).

Logs en vivo / diagnóstico sin salir de la CLI:

```bash
npx wrangler tail        # logs en directo del Worker en producción
```

(El conector MCP de Vercel del repo **no aplica** aquí; para Cloudflare usa `wrangler tail`
o el dashboard.)

## 5. Dominio propio (a nombre del sindicato)

1. Compra el dominio (ver `../../../design-intelligence/referencias/RECURSOS.md`).
2. En Cloudflare: **Workers & Pages → el Worker → Settings → Domains & Routes → Add Custom
   Domain** (o añade la zona si el dominio no está ya en Cloudflare).
3. **Ajusta las variables** en `wrangler.jsonc` → `vars` y vuelve a desplegar:

   ```jsonc
   "vars": {
     "SITE_URL": "https://tu-dominio-real",   // canonical, hreflang, sitemap, Open Graph
     "SITE_INDEXABLE": "true"                  // deja indexar en el dominio definitivo
   }
   ```

   ```bash
   npm run build:vinext && npm run deploy:vinext
   ```

   > **Por qué es obligatorio:** `src/lib/site-url.ts` lee `SITE_URL` de `process.env`. En
   > Vercel venía de una variable que Cloudflare no tiene; sin esto el sitemap y los canonical
   > saldrían con `localhost`. El puente `vars → process.env` ya está resuelto con el flag
   > `nodejs_compat_populate_process_env` en `wrangler.jsonc`. Verifícalo tras desplegar:
   > `curl https://tu-dominio-real/sitemap.xml` debe mostrar tu dominio, no `localhost`.

## 6. Vercel

El proyecto Vercel de la caja (`caja-resistencia-huelga-airbus-2026`) **ya se eliminó**
(18-sep-2026); la caja vive solo en Cloudflare. Solo tenía subdominios `*.vercel.app`, sin
dominio propio, así que no hubo cutover: cuando conectes el dominio, apúntalo directo a
Cloudflare (§5). El proyecto Vercel `site` (Web A del movimiento) es OTRO y sigue vivo.

## 7. Rollback

- El deploy a Cloudflare **no toca Vercel**: si algo falla, Vercel sigue sirviendo.
- Para revertir el Worker a la versión anterior:

  ```bash
  npx wrangler rollback     # o desde el dashboard: el Worker → Deployments → Rollback
  ```

## 8. Gotchas (solo si reinstalas `node_modules` desde cero)

- `npm install` falla por peer-deps (Babel 7 de `shadcn` vs Babel 8 de vinext) → añade
  `--legacy-peer-deps`.
- El guard de scripts bloquea postinstall necesarios → `npm approve-scripts workerd esbuild unrs-resolver`.
- Si **Next dev** (no vinext) se queja de `nanoid/non-secure` → `npm install nanoid --legacy-peer-deps`.
- Tras editar `wrangler.jsonc` → `npx wrangler types` (regenera `worker-configuration.d.ts`).
- Si `tsc` se queja de `.next/types/...` → borra `.next/` (es caché de Next; vinext usa `dist/`).

## 9. Lo que este despliegue NO cambia

- Reglamento/acuerdo del fondo: **no se cuelga el PDF** hasta que estén firmados.
- El marco legal de la tienda/camiseta (venta con IVA) sigue pendiente del asesor antes de
  cobrar camisetas por Stripe bajo el CIF de ÚTIL.
