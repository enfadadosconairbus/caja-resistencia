// Entry propio del Worker. vinext lo detecta automáticamente en `worker/index.ts` y lo usa
// como `main` (ver resolveWorkerEntry en @vinext/cloudflare). Aquí envolvemos el handler
// de vinext (App Router) y, además, publicamos las Durable Objects (contador de visitas y
// contador de referencias de pedido) para que formen parte del Worker desplegado.
import vinext from "vinext/server/fetch-handler";
import { rutinaLote } from "../src/lib/lote-proveedor";

export { VisitasCounter } from "../src/server/visitas-counter";
export { PedidoContador } from "../src/server/pedido-contador";

type Handler = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> };
type Contexto = { waitUntil: (p: Promise<unknown>) => void };
const app = vinext as unknown as Handler;

// /[lang]/tienda → /[lang]/material (5-oct-2026), conservando los parámetros.
//
// POR QUÉ AQUÍ y no con `permanentRedirect()` en la página: la capa de caché de vinext pide
// la página desde dentro del Worker y SIGUE la redirección por su cuenta, y eso entraba en
// bucle («TypeError: Too many redirects» en `wrangler tail`): la página antigua daba 500.
// Respondiendo el 308 antes de llegar a vinext, la caché ni se entera.
//
// Los parámetros se conservan para que una sesión de pago de Stripe creada antes del cambio
// (vuelta a `?pago=ok` / `?pago=cancelado`) siga aterrizando en su aviso. El parámetro interno
// de la caché de vinext no se reenvía nunca.
const TIENDA_ANTIGUA = /^\/(es|en|fr|de)\/tienda\/?$/;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    const m = TIENDA_ANTIGUA.exec(url.pathname);
    if (m) {
      url.pathname = `/${m[1]}/material`;
      url.searchParams.delete("__vinext_cache_key");
      return Response.redirect(url.toString(), 308);
    }
    return app.fetch(request, env, ctx);
  },

  // Lote mensual al proveedor (crons en wrangler.jsonc): cierra el lote del 21 y avisa a la caja.
  async scheduled(controller: { scheduledTime: number }, _env: unknown, ctx: Contexto): Promise<void> {
    ctx.waitUntil(
      rutinaLote(new Date(controller.scheduledTime)).then(
        (r) => console.log("Rutina del lote:", r),
        (err) => console.error("Rutina del lote FALLÓ:", String(err)),
      ),
    );
  },
};
