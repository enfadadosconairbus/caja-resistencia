import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { APORTACION_ONLINE, pasarelaActiva } from "@/config/fondo";
import { SITE_URL } from "@/lib/site-url";
import { crearCheckoutSession } from "@/lib/stripe";

/**
 * Inicia una APORTACIÓN online a la caja: crea una Checkout Session de Stripe con el importe
 * que la persona eligió y devuelve su URL. Es el hermano de `/api/pedido`, separado a
 * propósito: una aportación no tiene contraprestación (Art. 5 del Reglamento), así que
 * nunca viaja en la misma sesión que una camiseta.
 *
 * El importe lo decide la persona, pero lo VALIDA el servidor: número finito, con céntimos
 * como mucho, dentro de `APORTACION_ONLINE`. Sin `paymentMethodTypes`: Stripe ofrece los
 * métodos activados en el dashboard (tarjeta, wallets, Bizum…) que admitan una donación.
 *
 * No se guarda nada aquí ni en el webhook: el pago lo registra Stripe, y las cifras públicas
 * salen del corte de Tesorería. `metadata.tipo = "donacion"` es lo que hace que el webhook
 * no la confunda con un pedido de la tienda.
 */
export const dynamic = "force-dynamic";

const LOCALES = ["es", "en", "fr", "de"] as const;

/** Nombre de la línea en la página de pago de Stripe y en el recibo. */
const CONCEPTO: Record<(typeof LOCALES)[number], string> = {
  es: "Aportación a la caja de resistencia",
  en: "Contribution to the resistance fund",
  fr: "Contribution à la caisse de résistance",
  de: "Beitrag zum Streikfonds",
};

function error(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(request: Request) {
  if (!pasarelaActiva) return error("El pago online no está disponible ahora mismo.", 503);

  let body: { importe?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Petición no válida.");
  }

  const lang = (LOCALES as readonly string[]).includes(body.lang as string)
    ? (body.lang as (typeof LOCALES)[number])
    : "es";

  // A céntimos enteros ANTES de comparar: así 12,345 no cuela como 12,35 por redondeo.
  const importe = Number(body.importe);
  const centimos = Math.round(importe * 100);
  if (!Number.isFinite(importe) || Math.abs(importe * 100 - centimos) > 1e-6) {
    return error("Importe no válido.");
  }
  if (centimos < APORTACION_ONLINE.min * 100 || centimos > APORTACION_ONLINE.max * 100) {
    return error(`El importe debe estar entre ${APORTACION_ONLINE.min} y ${APORTACION_ONLINE.max} €.`);
  }

  const stripeKey = (env as { STRIPE_SECRET_KEY?: string }).STRIPE_SECRET_KEY;
  if (!stripeKey) return error("El pago no está disponible ahora mismo.", 503);

  try {
    const sesion = await crearCheckoutSession(stripeKey, {
      lineas: [{ nombre: CONCEPTO[lang], unitAmount: centimos, cantidad: 1 }],
      successUrl: `${SITE_URL}/${lang}/la-caja?aporte=ok#aportar`,
      cancelUrl: `${SITE_URL}/${lang}/la-caja?aporte=cancelado#aportar`,
      locale: lang,
      submitType: "donate",
      metadata: { tipo: "donacion", importe: (centimos / 100).toFixed(2) },
    });
    return NextResponse.json(
      { ok: true, url: sesion.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error("No se pudo iniciar el pago. Inténtalo de nuevo.", 502);
  }
}
