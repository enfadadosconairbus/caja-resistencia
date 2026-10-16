import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { CAMISETA, MAX_UNIDADES, SITES, TELEFONO_RE, TIENDA_ACTIVA } from "@/config/pedidos";
import { SITE_URL } from "@/lib/site-url";
import { crearCheckoutSession, type LineaCheckout } from "@/lib/stripe";

/**
 * Inicia la compra de merchandising. Modelo **pago = orden**: aquí NO se toca la base de datos.
 * Se valida todo en servidor (tallas, cantidades, tope, precio — el navegador nunca decide el
 * dinero), se crea una Checkout Session de Stripe (tarjeta + Bizum) con el pedido en `metadata`,
 * y se devuelve su URL. El pedido se materializa YA PAGADO en el webhook (`checkout.session.
 * completed`). Las aportaciones sin producto van por `/api/donacion`, separadas a propósito:
 * una camiseta es una compraventa y una aportación no tiene contraprestación (Art. 5).
 */
export const dynamic = "force-dynamic";

const LOCALES = ["es", "en", "fr", "de"] as const;

type LineaEntrada = { talla?: unknown; cantidad?: unknown };

function error(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(request: Request) {
  // Tienda cerrada (Stripe en test): rechaza cualquier intento de pedido, venga de donde venga.
  if (!TIENDA_ACTIVA) return error("La tienda no está disponible ahora mismo.", 503);

  let body: {
    lineas?: unknown;
    nombre?: unknown;
    email?: unknown;
    site?: unknown;
    telefono?: unknown;
    lang?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return error("Petición no válida.");
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const site = typeof body.site === "string" ? body.site.trim() : "";
  // Opcional: vacío vale; si viene, tiene que parecer un teléfono.
  const telefono = typeof body.telefono === "string" ? body.telefono.trim() : "";
  const lineasRaw = Array.isArray(body.lineas) ? (body.lineas as LineaEntrada[]) : [];
  const lang = (LOCALES as readonly string[]).includes(body.lang as string)
    ? (body.lang as string)
    : "es";

  if (!nombre) return error("Indica tu nombre.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Revisa tu email.");
  if (telefono && !TELEFONO_RE.test(telefono)) return error("Revisa tu teléfono.");

  // Normaliza líneas: agrupa por talla válida, cantidades enteras positivas.
  const porTalla = new Map<string, number>();
  for (const l of lineasRaw) {
    const talla = typeof l.talla === "string" ? l.talla : "";
    const cantidad = Math.floor(Number(l.cantidad ?? 0));
    if (!(CAMISETA.tallas as readonly string[]).includes(talla)) continue;
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    porTalla.set(talla, (porTalla.get(talla) ?? 0) + cantidad);
  }
  const lineas = [...porTalla.entries()].map(([talla, cantidad]) => ({ talla, cantidad }));
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0);

  if (unidades === 0) return error("Añade al menos una camiseta.");
  if (unidades > MAX_UNIDADES) return error(`Máximo ${MAX_UNIDADES} unidades por pedido.`);
  if (!(SITES as readonly string[]).includes(site)) return error("Elige tu site de recogida.");

  const stripeKey = (env as { STRIPE_SECRET_KEY?: string }).STRIPE_SECRET_KEY;
  if (!stripeKey) return error("El pago no está disponible ahora mismo.", 503);

  const total = unidades * CAMISETA.precio;
  const lineasCheckout: LineaCheckout[] = lineas.map((l) => ({
    nombre: `Camiseta solidaria · talla ${l.talla}`,
    unitAmount: CAMISETA.precio * 100,
    cantidad: l.cantidad,
  }));

  try {
    const sesion = await crearCheckoutSession(stripeKey, {
      lineas: lineasCheckout,
      email,
      successUrl: `${SITE_URL}/${lang}/material?pago=ok`,
      cancelUrl: `${SITE_URL}/${lang}/material?pago=cancelado`,
      locale: lang,
      // Sin `paymentMethodTypes`: Stripe ofrece los métodos ACTIVADOS en el dashboard
      // (tarjeta + Bizum cuando lo actives), sin fallar si alguno no está habilitado.
      metadata: {
        tipo: "pedido",
        lineas: JSON.stringify(lineas),
        unidades: String(unidades),
        total: String(total),
        site,
        nombre,
        email,
        telefono,
        lang,
      },
    });
    return NextResponse.json(
      { ok: true, url: sesion.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error("No se pudo iniciar el pago. Inténtalo de nuevo.", 502);
  }
}
