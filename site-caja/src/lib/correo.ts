import { CORREO } from "@/config/pedidos";

/**
 * Correos al comprador de la tienda, por Resend (REST, sin SDK: compatible con Workers).
 *
 * Dos correos, y solo dos:
 *   · `confirmacion` — sale del webhook cuando Stripe confirma el cobro.
 *   · `listo`        — sale cuando el pedido pasa a «Listo para recoger» en el Sheet.
 *
 * Cada envío lleva una `Idempotency-Key` (`<tipo>/<referencia>`): si un reintento llega a Resend
 * dos veces, Resend manda UN correo. La marca en D1 (`correo_*`) evita además volver a intentarlo.
 */

export type Lang = "es" | "en" | "fr" | "de";
export type TipoCorreo = "confirmacion" | "listo";

export type PedidoCorreo = {
  referencia: string;
  nombre: string;
  email: string;
  site: string | null;
  lineas: { talla: string; cantidad: number }[];
  total: number;
  lang: string | null;
};

const LANGS: Lang[] = ["es", "en", "fr", "de"];
const idioma = (l: string | null): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : "es");

const T: Record<
  Lang,
  {
    hola: (n: string) => string;
    firma: string;
    titular: string;
    ref: string;
    tallas: string;
    total: string;
    centro: string;
    dudas: string;
    confirmacion: { asunto: (r: string) => string; cuerpo: (c: string) => string[] };
    listo: { asunto: (r: string, c: string) => string; cuerpo: (c: string) => string[] };
  }
> = {
  es: {
    hola: (n) => `Hola, ${n}:`,
    firma: "Caja de resistencia · #EnfadadosconAirbus",
    titular: "Titular: Unión de Trabajadores Independientes y Libres (Sindicato Útil) · CIF G10605053",
    ref: "Referencia",
    tallas: "Tallas",
    total: "Total pagado",
    centro: "Recogida",
    dudas: "Si tienes cualquier duda, responde a este correo.",
    confirmacion: {
      asunto: (r) => `Pedido ${r} recibido: gracias por sostener la caja`,
      cuerpo: (c) => [
        "Hemos recibido tu pago y registrado tu pedido. Gracias por sostener la caja.",
        `Las camisetas se producen bajo pedido. Cuando estén listas para recoger en ${c}, te avisaremos por correo. La entrega la hace el coordinador de logística de tu centro.`,
      ],
    },
    listo: {
      asunto: (r, c) => `Tu pedido ${r} está listo para recoger en ${c}`,
      cuerpo: (c) => [
        `Tus camisetas ya están listas. Puedes recogerlas en ${c} con el coordinador de logística: dile tu nombre o la referencia del pedido.`,
      ],
    },
  },
  en: {
    hola: (n) => `Hi ${n},`,
    firma: "Resistance fund · #EnfadadosconAirbus",
    titular: "Holder: Unión de Trabajadores Independientes y Libres (Sindicato Útil) · Tax ID G10605053",
    ref: "Reference",
    tallas: "Sizes",
    total: "Total paid",
    centro: "Pickup",
    dudas: "If you have any questions, just reply to this email.",
    confirmacion: {
      asunto: (r) => `Order ${r} received: thank you for supporting the fund`,
      cuerpo: (c) => [
        "We have received your payment and registered your order. Thank you for supporting the fund.",
        `The T-shirts are made to order. When they are ready for pickup at ${c}, we will let you know by email. They are handed out by your site's logistics coordinator.`,
      ],
    },
    listo: {
      asunto: (r, c) => `Your order ${r} is ready for pickup at ${c}`,
      cuerpo: (c) => [
        `Your T-shirts are ready. You can pick them up at ${c} from the logistics coordinator: give your name or the order reference.`,
      ],
    },
  },
  fr: {
    hola: (n) => `Bonjour ${n},`,
    firma: "Caisse de résistance · #EnfadadosconAirbus",
    titular: "Titulaire : Unión de Trabajadores Independientes y Libres (Sindicato Útil) · CIF G10605053",
    ref: "Référence",
    tallas: "Tailles",
    total: "Total payé",
    centro: "Retrait",
    dudas: "Pour toute question, réponds simplement à ce courriel.",
    confirmacion: {
      asunto: (r) => `Commande ${r} reçue : merci de soutenir la caisse`,
      cuerpo: (c) => [
        "Nous avons reçu ton paiement et enregistré ta commande. Merci de soutenir la caisse.",
        `Les t-shirts sont fabriqués à la commande. Quand ils seront prêts à retirer à ${c}, nous te préviendrons par courriel. La remise est assurée par le coordinateur logistique de ton site.`,
      ],
    },
    listo: {
      asunto: (r, c) => `Ta commande ${r} est prête à retirer à ${c}`,
      cuerpo: (c) => [
        `Tes t-shirts sont prêts. Tu peux les retirer à ${c} auprès du coordinateur logistique : donne ton nom ou la référence de la commande.`,
      ],
    },
  },
  de: {
    hola: (n) => `Hallo ${n},`,
    firma: "Streikfonds · #EnfadadosconAirbus",
    titular: "Träger: Unión de Trabajadores Independientes y Libres (Sindicato Útil) · CIF G10605053",
    ref: "Referenz",
    tallas: "Größen",
    total: "Bezahlt",
    centro: "Abholung",
    dudas: "Bei Fragen antworte einfach auf diese E-Mail.",
    confirmacion: {
      asunto: (r) => `Bestellung ${r} eingegangen: Danke, dass du den Fonds unterstützt`,
      cuerpo: (c) => [
        "Wir haben deine Zahlung erhalten und deine Bestellung erfasst. Danke, dass du den Fonds unterstützt.",
        `Die T-Shirts werden auf Bestellung gefertigt. Sobald sie in ${c} abholbereit sind, sagen wir dir per E-Mail Bescheid. Die Übergabe macht der Logistik-Koordinator deines Standorts.`,
      ],
    },
    listo: {
      asunto: (r, c) => `Deine Bestellung ${r} ist in ${c} abholbereit`,
      cuerpo: (c) => [
        `Deine T-Shirts sind fertig. Du kannst sie in ${c} beim Logistik-Koordinator abholen: Nenne deinen Namen oder die Bestellreferenz.`,
      ],
    },
  },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function tallasTexto(lineas: PedidoCorreo["lineas"]): string {
  return lineas.map((l) => `${l.talla} × ${l.cantidad}`).join(" · ");
}

/** Compone asunto, HTML y texto plano. Se exporta para poder probarlo sin enviar nada. */
export function componerCorreo(tipo: TipoCorreo, p: PedidoCorreo) {
  const l = idioma(p.lang);
  const t = T[l];
  const centro = p.site ?? "—";
  const total = new Intl.NumberFormat(l, { style: "currency", currency: "EUR" }).format(p.total);
  const asunto =
    tipo === "confirmacion" ? t.confirmacion.asunto(p.referencia) : t.listo.asunto(p.referencia, centro);
  const parrafos = tipo === "confirmacion" ? t.confirmacion.cuerpo(centro) : t.listo.cuerpo(centro);
  const datos: [string, string][] = [
    [t.ref, p.referencia],
    [t.tallas, tallasTexto(p.lineas)],
    [t.centro, centro],
    ...(tipo === "confirmacion" ? ([[t.total, total]] as [string, string][]) : []),
  ];

  const texto = [
    t.hola(p.nombre),
    "",
    ...parrafos.flatMap((x) => [x, ""]),
    ...datos.map(([k, v]) => `${k}: ${v}`),
    "",
    t.dudas,
    "",
    "—",
    t.firma,
    t.titular,
  ].join("\n");

  const filas = datos
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5b6b82;font-size:13px;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;color:#101e33">${esc(v)}</td></tr>`,
    )
    .join("");
  const html =
    `<!doctype html><html lang="${l}"><body style="margin:0;background:#f4f6fa;padding:24px 12px">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border-top:4px solid #cf3517;padding:28px 28px 20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#101e33;line-height:1.55">` +
    `<p style="margin:0 0 16px;font-size:16px">${esc(t.hola(p.nombre))}</p>` +
    parrafos.map((x) => `<p style="margin:0 0 14px;font-size:15px">${esc(x)}</p>`).join("") +
    `<table role="presentation" style="margin:8px 0 18px;border-collapse:collapse">${filas}</table>` +
    `<p style="margin:0 0 22px;font-size:14px;color:#5b6b82">${esc(t.dudas)}</p>` +
    `<p style="margin:0;border-top:1px solid #e3e8f0;padding-top:14px;font-size:13px;font-weight:600">${esc(t.firma)}</p>` +
    `<p style="margin:4px 0 0;font-size:11px;color:#8a97ab">${esc(t.titular)}</p>` +
    `</div></body></html>`;

  return { asunto, html, texto };
}

/**
 * Envía un correo del pedido. Devuelve `true` si Resend lo aceptó. Nunca lanza: quien llama
 * decide qué hacer con un fallo (marcar para reintento, revertir el estado en el Sheet…).
 */
export async function enviarCorreo(apiKey: string, tipo: TipoCorreo, p: PedidoCorreo): Promise<boolean> {
  const { asunto, html, texto } = componerCorreo(tipo, p);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${tipo}/${p.referencia}`,
      },
      body: JSON.stringify({
        from: CORREO.from,
        to: [p.email],
        bcc: [CORREO.bcc],
        reply_to: CORREO.replyTo,
        subject: asunto,
        html,
        text: texto,
      }),
    });
    if (!res.ok) console.error("Resend rechazó el correo", tipo, p.referencia, res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Resend no respondió", tipo, p.referencia, String(err));
    return false;
  }
}
