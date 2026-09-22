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

`deploy:vinext` = `vinext-cloudflare deploy --config dist/server/wrangler.json` (ese config lo
genera el build a partir de `wrangler.jsonc`, ya con la Durable Object dentro).

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
