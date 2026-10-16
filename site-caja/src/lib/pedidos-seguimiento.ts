import { env } from "cloudflare:workers";
import { enviarCorreo, tallasTexto, type PedidoCorreo } from "@/lib/correo";

/**
 * Seguimiento de un pedido YA PAGADO: correo de confirmación y volcado al Sheet de gestión.
 *
 * Lo usan el webhook de Stripe (al registrar el pedido) y `/api/sheet` (la sincronización que
 * lanza el Sheet cada hora). Cada paso deja su marca en D1 (`correo_confirmacion`, `en_sheet`)
 * y solo se intenta si la marca está vacía: así se puede llamar las veces que haga falta sin
 * repetir nada, y lo que falló una vez se reintenta solo en la siguiente pasada.
 *
 * Sin `RESEND_API_KEY` o sin `SHEET_WEBHOOK_URL` el paso correspondiente no hace nada: la tienda
 * sigue cobrando y registrando en D1 aunque falte la configuración.
 */

type Entorno = {
  PEDIDOS_DB: D1Database;
  RESEND_API_KEY?: string;
  SHEET_WEBHOOK_URL?: string;
  SHEET_SHARED_SECRET?: string;
};
const e = () => env as unknown as Entorno;

export type FilaPedido = {
  referencia: string;
  creado: string;
  nombre: string;
  email: string;
  telefono: string | null;
  site: string | null;
  lineas: string;
  unidades: number;
  /** Aportación voluntaria añadida al pedido (€). Es donación pura: no compra nada. */
  donacion: number;
  total: number;
  estado: string;
  lang: string | null;
  correo_confirmacion: string | null;
  correo_listo: string | null;
  en_sheet: string | null;
  /** «AAAA-MM» del lote mensual en que se mandó a producir (null = aún no). */
  lote: string | null;
};

const COLUMNAS =
  "referencia, creado, nombre, email, telefono, site, lineas, unidades, donacion, total, estado, lang, correo_confirmacion, correo_listo, en_sheet, lote";

export async function leerPedido(referencia: string): Promise<FilaPedido | null> {
  return e()
    .PEDIDOS_DB.prepare(`SELECT ${COLUMNAS} FROM pedidos WHERE referencia = ?`)
    .bind(referencia)
    .first<FilaPedido>();
}

export async function leerPedidoPorSesion(sesion: string): Promise<FilaPedido | null> {
  return e()
    .PEDIDOS_DB.prepare(`SELECT ${COLUMNAS} FROM pedidos WHERE stripe_session = ?`)
    .bind(sesion)
    .first<FilaPedido>();
}

/** Pedidos de producto (con centro), del más antiguo al más reciente. */
export async function listarPedidos(): Promise<FilaPedido[]> {
  const r = await e()
    .PEDIDOS_DB.prepare(`SELECT ${COLUMNAS} FROM pedidos WHERE site IS NOT NULL ORDER BY creado`)
    .all<FilaPedido>();
  return r.results ?? [];
}

function lineasDe(p: FilaPedido): { talla: string; cantidad: number }[] {
  try {
    const l = JSON.parse(p.lineas) as { talla: string; cantidad: number }[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

export function paraCorreo(p: FilaPedido): PedidoCorreo {
  return {
    referencia: p.referencia,
    nombre: p.nombre,
    email: p.email,
    site: p.site,
    lineas: lineasDe(p),
    total: p.total,
    lang: p.lang,
  };
}

/** Lo que el Sheet necesita de un pedido. Nada de Stripe ni datos de pago. */
export function paraSheet(p: FilaPedido) {
  return {
    referencia: p.referencia,
    fecha: p.creado,
    estado: p.estado,
    nombre: p.nombre,
    email: p.email,
    telefono: p.telefono ?? "",
    centro: p.site ?? "",
    tallas: tallasTexto(lineasDe(p)),
    unidades: p.unidades,
    // Separada del material: la aportación es donación pura y el material, una venta.
    aportacion: p.donacion ?? 0,
    total: p.total,
    idioma: p.lang ?? "es",
    avisado: p.correo_listo ?? "",
    lote: p.lote ?? "",
  };
}

const ahora = () => new Date().toISOString();

/** Envía «pago recibido» si no ha salido ya. Devuelve true si está enviado (antes o ahora). */
export async function asegurarConfirmacion(p: FilaPedido): Promise<boolean> {
  if (p.correo_confirmacion) return true;
  const clave = e().RESEND_API_KEY;
  if (!clave) return false;
  const ok = await enviarCorreo(clave, "confirmacion", paraCorreo(p));
  if (ok) {
    p.correo_confirmacion = ahora();
    await e()
      .PEDIDOS_DB.prepare("UPDATE pedidos SET correo_confirmacion = ? WHERE referencia = ?")
      .bind(p.correo_confirmacion, p.referencia)
      .run();
  }
  return ok;
}

/** Vuelca el pedido al Sheet si no está ya. Devuelve true si está volcado (antes o ahora). */
export async function asegurarEnSheet(p: FilaPedido): Promise<boolean> {
  if (p.en_sheet) return true;
  const { SHEET_WEBHOOK_URL: url, SHEET_SHARED_SECRET: secreto } = e();
  if (!url || !secreto) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secreto, accion: "pedido", pedido: paraSheet(p) }),
    });
    // Apps Script contesta 200 aunque rechace (secreto mal, excepción…): el veredicto va en
    // el cuerpo. Mirar solo `res.ok` daría por volcado lo que no se escribió (Villatobas).
    let cuerpo: { ok?: boolean } | null = null;
    try {
      cuerpo = await res.json();
    } catch {
      /* respuesta que no es JSON: fallo */
    }
    if (!res.ok || !cuerpo?.ok) {
      console.error("El Sheet no aceptó el pedido", p.referencia, res.status, JSON.stringify(cuerpo));
      return false;
    }
  } catch (err) {
    console.error("El Sheet no respondió", p.referencia, String(err));
    return false;
  }
  p.en_sheet = ahora();
  await e()
    .PEDIDOS_DB.prepare("UPDATE pedidos SET en_sheet = ? WHERE referencia = ?")
    .bind(p.en_sheet, p.referencia)
    .run();
  return true;
}

/** Comparación en tiempo constante del secreto que manda el Sheet. */
export function secretoSheetValido(recibido: string | null): boolean {
  const esperado = e().SHEET_SHARED_SECRET;
  if (!esperado || !recibido || recibido.length !== esperado.length) return false;
  let r = 0;
  for (let i = 0; i < esperado.length; i++) r |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i);
  return r === 0;
}
