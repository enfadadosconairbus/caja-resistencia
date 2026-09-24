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

/** Camiseta solidaria: precio único y cuánto va a la caja (el resto cubre coste + IVA). */
export const CAMISETA = {
  id: "camiseta",
  precio: 10, // € que aporta quien la adquiere
  aLaCaja: 5, // € de cada camiseta que van a la caja
  tallas: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const,
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

export type EstadoPedido = "pendiente" | "pagado" | "anulado";
