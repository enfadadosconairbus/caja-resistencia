/**
 * Integración mínima con Stripe (solo lo que la caja necesita), SIN SDK: llamadas REST con
 * `fetch` y verificación del webhook con Web Crypto (compatible con Workers). El navegador nunca
 * ve la clave secreta ni decide importes: la Checkout Session se crea en el servidor con precios
 * del catálogo, y el pago se confirma por webhook firmado, no por la redirección de vuelta.
 */

const API = "https://api.stripe.com/v1";

export type LineaCheckout = { nombre: string; unitAmount: number; cantidad: number };

/** Crea una Checkout Session (pago único) y devuelve su id + URL de pago alojada por Stripe. */
export async function crearCheckoutSession(
  secretKey: string,
  opts: {
    lineas: LineaCheckout[];
    email?: string;
    successUrl: string;
    cancelUrl: string;
    locale?: string;
    /** Métodos de pago a ofrecer (p. ej. ["card", "bizum"]). Si se omite, Stripe decide. */
    paymentMethodTypes?: string[];
    /** Datos del pedido; se leen en el webhook para crear el pedido ya pagado. */
    metadata?: Record<string, string>;
  },
): Promise<{ id: string; url: string }> {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", opts.successUrl);
  p.set("cancel_url", opts.cancelUrl);
  if (opts.email) p.set("customer_email", opts.email);
  if (opts.locale) p.set("locale", opts.locale);
  opts.paymentMethodTypes?.forEach((m, i) => p.set(`payment_method_types[${i}]`, m));
  // El pedido viaja en metadata (y se copia al PaymentIntent) → el webhook lo materializa.
  for (const [k, v] of Object.entries(opts.metadata ?? {})) {
    p.set(`metadata[${k}]`, v);
    p.set(`payment_intent_data[metadata][${k}]`, v);
  }
  opts.lineas.forEach((l, i) => {
    p.set(`line_items[${i}][quantity]`, String(l.cantidad));
    p.set(`line_items[${i}][price_data][currency]`, "eur");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitAmount));
    p.set(`line_items[${i}][price_data][product_data][name]`, l.nombre);
  });

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.id || !data.url) {
    throw new Error(data.error?.message ?? `Stripe respondió ${res.status}`);
  }
  return { id: data.id, url: data.url };
}

/**
 * Verifica la firma del webhook de Stripe (cabecera `Stripe-Signature`) contra el secreto del
 * endpoint y devuelve el evento parseado, o `null` si la firma no es válida o está caducada.
 */
export async function verificarWebhook(
  payload: string,
  firmaHeader: string | null,
  secret: string,
  toleranciaSeg = 300,
): Promise<Record<string, unknown> | null> {
  if (!firmaHeader) return null;

  // Cabecera: "t=<timestamp>,v1=<hexsig>[,v1=<hexsig>...]"
  let t = "";
  const firmas: string[] = [];
  for (const parte of firmaHeader.split(",")) {
    const idx = parte.indexOf("=");
    const k = parte.slice(0, idx);
    const v = parte.slice(idx + 1);
    if (k === "t") t = v;
    else if (k === "v1") firmas.push(v);
  }
  if (!t || firmas.length === 0) return null;

  // Rechaza eventos demasiado viejos/futuros (anti-replay).
  const ahora = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(t)) || Math.abs(ahora - Number(t)) > toleranciaSeg) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const esperado = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!firmas.some((f) => iguales(f, esperado))) return null;

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Comparación de tiempo constante para dos cadenas hex. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
