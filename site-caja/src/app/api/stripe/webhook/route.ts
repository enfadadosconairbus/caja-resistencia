import { env } from "cloudflare:workers";
import { verificarWebhook } from "@/lib/stripe";
import { PREFIJO_REF, TELEFONO_RE } from "@/config/pedidos";
import { asegurarConfirmacion, asegurarEnSheet, leerPedidoPorSesion } from "@/lib/pedidos-seguimiento";

/**
 * Webhook de Stripe: única fuente de verdad del pago. Con un evento verificado y el cobro
 * confirmado MATERIALIZA el pedido ya PAGADO en D1 a partir de la `metadata` de la sesión.
 * Idempotente: la sesión Stripe es clave única, así que reintentos de Stripe no lo duplican.
 *
 * Las APORTACIONES (`metadata.tipo = "donacion"`, de `/api/donacion`) llegan al mismo
 * endpoint y NO se guardan aquí: no hay nada que entregar, y las cifras públicas de la caja
 * salen del corte conciliado de Tesorería, no de este webhook. Stripe las conserva.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = (env as { STRIPE_WEBHOOK_SECRET?: string }).STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook no configurado.", { status: 503 });

  const payload = await request.text();
  const evento = await verificarWebhook(payload, request.headers.get("stripe-signature"), secret);
  if (!evento) return new Response("Firma no válida.", { status: 400 });

  // Dos eventos pueden traer un pago CONFIRMADO: `completed` (tarjeta, wallets, Bizum…, que
  // cobran al momento) y `async_payment_succeeded` (métodos diferidos, como una domiciliación
  // SEPA, que confirman horas o días después). Se atienden los dos; la idempotencia por sesión
  // impide que un mismo pago se registre dos veces.
  const tipos = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (tipos.includes(String(evento.type))) {
    const sesion = (evento.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
    const sid = typeof sesion.id === "string" ? sesion.id : "";
    // SOLO `payment_status === "paid"`. Antes valía también `status === "complete"`, pero una
    // sesión con método diferido termina «complete» con el cobro aún `unpaid`: se habría
    // registrado un pedido pagado sin dinero. Ese pago llega luego como async_payment_succeeded.
    const pagado = sesion.payment_status === "paid";
    const meta = (sesion.metadata as Record<string, unknown> | undefined) ?? {};

    const dato = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");
    // Sesiones antiguas no llevan `tipo`: sin él se tratan como pedido, como hasta ahora.
    const esDonacion = dato("tipo") === "donacion";
    const nombre = dato("nombre");
    const email = dato("email");
    const site = dato("site");
    const lineas = dato("lineas") || "[]";
    const unidades = Math.max(0, Math.floor(Number(dato("unidades")) || 0));
    const total = Math.max(0, Math.floor(Number(dato("total")) || 0));
    const telefono = TELEFONO_RE.test(dato("telefono")) ? dato("telefono") : null;
    const lang = ["es", "en", "fr", "de"].includes(dato("lang")) ? dato("lang") : null;

    if (!esDonacion && sid && pagado && nombre && email) {
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
             (referencia, creado, nombre, email, telefono, site, lineas, unidades, donacion, total,
              estado, metodo, stripe_session, lang)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pagado', 'stripe', ?, ?)`,
        )
          .bind(
            referencia,
            new Date().toISOString(),
            nombre,
            email,
            telefono,
            site || null,
            lineas,
            unidades,
            total,
            sid,
            lang,
          )
          .run();
      }

      // Correo de «pago recibido» y volcado al Sheet. Cada paso deja marca en D1 y solo se
      // intenta si falta, así que un reintento de Stripe no duplica nada. Si alguno falla, NO
      // se devuelve error a Stripe (reintentaría días y acabaría desactivando el webhook): lo
      // recoge la sincronización horaria del Sheet (`/api/sheet`, acción «sincronizar»).
      const pedido = await leerPedidoPorSesion(sid);
      if (pedido) {
        await asegurarConfirmacion(pedido);
        await asegurarEnSheet(pedido);
      }
    }
  }

  // Siempre 200 ante un evento verificado (aunque no lo procesemos) para que Stripe no reintente.
  return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });
}
