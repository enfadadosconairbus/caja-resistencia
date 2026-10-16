/**
 * Configuración de PEDIDOS de la tienda (merchandising). Es la fuente de verdad del catálogo
 * y la economía que el BACKEND valida: el navegador nunca decide el precio. El IBAN sale de
 * `fondo.ts` (FONDO.cuenta); aquí solo lo específico de la tienda.
 *
 * PREFIJO temporal `AIRW-`: la tienda de GitHub sigue viva con `AIR26-`; un prefijo distinto
 * evita colisiones de referencia. Al unificar (retirar GitHub), se continuará la serie
 * `AIR26-` desde el máximo de GitHub sembrando el contador (ver PedidoContador.sembrar).
 */
export const PREFIJO_REF = "AIRW";

/**
 * Interruptor de la tienda. Con `false`, el frontend muestra un aviso en vez del formulario y
 * el backend rechaza el pedido. En `true` desde el 1-oct-2026: Stripe en LIVE, cobra de verdad.
 * Volver a `false` es la forma de cerrar la tienda sin tocar nada más.
 */
export const TIENDA_ACTIVA = true;

/**
 * Comisión de Stripe POR TRANSACCIÓN: 1,25 % del importe + 0,25 € fijos. Desde que la compra
 * de producto se paga por Stripe (ya no por transferencia), sale de cada venta y hay que
 * descontarla antes de decir cuánto llega a la caja.
 */
export const COMISION_STRIPE = { pct: 0.0125, fijo: 0.25 };

/** Redondeo al céntimo, como cobra Stripe: así la cifra cuadra con el extracto del banco. */
const alCentimo = (v: number) => Math.round(v * 100) / 100;

export function comisionStripe(importe: number): number {
  return alCentimo(importe * COMISION_STRIPE.pct + COMISION_STRIPE.fijo);
}

/** Camiseta solidaria: precio único y lo que cuesta producirla (IVA incluido). */
export const CAMISETA = {
  id: "camiseta",
  precio: 10, // € que aporta quien la adquiere
  coste: 5, // € de producción por unidad
  tallas: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const,
};

/**
 * Reparto de UNA camiseta pagada sola (una transacción): 5 € de coste, 0,38 € de Stripe
 * (0,375 redondeado al céntimo, como aparece en el extracto) y 4,62 € a la caja. No se
 * guarda el «a la caja»: se deriva, para que cambiar el precio, el coste o la tarifa no
 * pueda dejarlo desfasado. En un pedido de varias, el fijo de 0,25 € se
 * paga una sola vez y a la caja le llega algo más por camiseta.
 */
const comisionCamiseta = comisionStripe(CAMISETA.precio);
export const REPARTO_CAMISETA = {
  coste: CAMISETA.coste,
  comision: comisionCamiseta,
  caja: alCentimo(CAMISETA.precio - CAMISETA.coste - comisionCamiseta),
};

export type Talla = (typeof CAMISETA.tallas)[number];

/** Donación opcional que se puede añadir al pedido (se paga junto, en la misma transferencia). */
export const DONACIONES = [0, 5, 10, 20, 50] as const;

/** Tope de camisetas por pedido. */
export const MAX_UNIDADES = 20;

/** Sites de recogida (la entrega la hace el coordinador de logística de cada site). */
export const SITES = ["Getafe", "Illescas", "Albacete", "San Pablo", "Tablada", "Cádiz"] as const;
export type Site = (typeof SITES)[number];

/** Beneficiario de la transferencia (confirmado por la coordinación, 19-sep-2026). */
export const BENEFICIARIO = "Caja de Resistencia Huelga Airbus 2026 - Sindicato Útil";

/**
 * Ciclo de un pedido: pagado → listo (para recoger) → entregado, o anulado. `pendiente` es de
 * la época de las transferencias y ya no se crea, pero puede quedar en pedidos antiguos.
 * El estado se gestiona desde el Sheet (`backend-sheet/Code.gs`); pasar a `listo` envía el
 * aviso de recogida, una sola vez.
 */
export type EstadoPedido = "pendiente" | "pagado" | "listo" | "entregado" | "anulado";

/** Estados que el Sheet puede poner. */
export const ESTADOS_SHEET = ["pagado", "listo", "entregado", "anulado"] as const;

/**
 * Remitente de los correos al comprador (Resend, dominio verificado). Las respuestas van al
 * Gmail de la caja, que recibe también copia oculta de cada correo: así queda constancia de
 * qué se envió y a quién, sin depender del panel de Resend.
 */
export const CORREO = {
  from: "Caja de resistencia #EnfadadosconAirbus <pedidos@cajaderesistencia-asi-no.org>",
  replyTo: "enfadadosconairbus.contacto@gmail.com",
  bcc: "enfadadosconairbus.contacto@gmail.com",
};

/**
 * Lote mensual al proveedor (`src/lib/lote-proveedor.ts`): el día 21 a las 8:00 llega aquí el
 * correo con el CSV de lo pagado del 21 al 20. NO va directo al proveedor: una persona lo revisa
 * y lo reenvía (decisión de 16-oct-2026).
 */
export const LOTE_PROVEEDOR = { para: ["enfadadosconairbus.contacto@gmail.com"] };

/** Teléfono opcional: dígitos, espacios, guiones, paréntesis y un `+` inicial. */
export const TELEFONO_RE = /^\+?[0-9 ()-]{6,20}$/;
