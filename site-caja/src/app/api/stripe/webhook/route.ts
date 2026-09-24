import { env } from "cloudflare:workers";
import { verificarWebhook } from "@/lib/stripe";
import { PREFIJO_REF } from "@/config/pedidos";

/**
 * Webhook de Stripe: única fuente de verdad del pago. En `checkout.session.completed` (verificado)
 * MATERIALIZA el pedido ya PAGADO en D1 a partir de la `metadata` de la sesión. Idempotente: la
 * sesión Stripe es clave única, así que reintentos de Stripe no duplican el pedido.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = (env as { STRIPE_WEBHOOK_SECRET?: string }).STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook no configurado.", { status: 503 });

  const payload = await request.text();
  const evento = await verificarWebhook(payload, request.headers.get("stripe-signature"), secret);
  if (!evento) return new Response("Firma no válida.", { status: 400 });

  if (evento.type === "checkout.session.completed") {
    const sesion = (evento.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
    const sid = typeof sesion.id === "string" ? sesion.id : "";
    const pagado = sesion.payment_status === "paid" || sesion.status === "complete";
    const meta = (sesion.metadata as Record<string, unknown> | undefined) ?? {};

    const dato = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");
    const nombre = dato("nombre");
    const email = dato("email");
    const site = dato("site");
    const lineas = dato("lineas") || "[]";
    const unidades = Math.max(0, Math.floor(Number(dato("unidades")) || 0));
    const total = Math.max(0, Math.floor(Number(dato("total")) || 0));

    if (sid && pagado && nombre && email) {
      // Idempotencia: si ya materializamos esta sesión, no reservamos otra referencia.
      const yaExiste = await env.PEDIDOS_DB.prepare(
        "SELECT 1 FROM pedidos WHERE stripe_session = ? LIMIT 1",
      )
        .bind(sid)
        .first();

      if (!yaExiste) {
        const ns = env.PEDIDO_REF;
        const numero = await ns.get(ns.idFromName("tienda")).siguiente();
        const referencia = `${PREFIJO_REF}-${String(numero).padStart(5, "0")}`;
        await env.PEDIDOS_DB.prepare(
          `INSERT OR IGNORE INTO pedidos
             (referencia, creado, nombre, email, site, lineas, unidades, donacion, total, estado, metodo, stripe_session)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pagado', 'stripe', ?)`,
        )
          .bind(
            referencia,
            new Date().toISOString(),
            nombre,
            email,
            site || null,
            lineas,
            unidades,
            total,
            sid,
          )
          .run();
      }
    }
  }

  // Siempre 200 ante un evento verificado (aunque no lo procesemos) para que Stripe no reintente.
  return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });
}
