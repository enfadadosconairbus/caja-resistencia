import { env } from "cloudflare:workers";
import { CORREO, LOTE_PROVEEDOR } from "@/config/pedidos";
import {
  componerCorreoLote,
  csvProveedor,
  DIA_CORTE,
  enMadrid,
  loteDelMes,
  type Lote,
  type PedidoLote,
} from "@/lib/lotes";

/**
 * Rutina mensual del lote al proveedor, contra D1 y Resend. Las cuentas están en `lotes.ts`.
 *
 * Dos pasos, cada uno con su marca, así que repetirla nunca duplica nada:
 *   1. Cerrar: los pedidos pagados SIN lote y anteriores al corte pasan a llevar `lote`. Lo que
 *      ya tenía lote no se toca; lo que entró después del corte espera al mes siguiente.
 *   2. Avisar: correo a la caja con el CSV, solo si `lotes.correo` está vacío. Si falla, el
 *      siguiente disparo del cron (o el botón del panel) lo reintenta.
 */

type Entorno = { PEDIDOS_DB: D1Database; RESEND_API_KEY?: string };
const e = () => env as unknown as Entorno;

export type EstadoLote = { etiqueta: string; corte: string; cerrado: string; correo: string | null };

export async function leerLote(etiqueta: string): Promise<EstadoLote | null> {
  return e()
    .PEDIDOS_DB.prepare("SELECT etiqueta, corte, cerrado, correo FROM lotes WHERE etiqueta = ?")
    .bind(etiqueta)
    .first<EstadoLote>();
}

/** Los pedidos de un lote, sin los anulados después de cerrarlo. */
export async function pedidosDelLote(etiqueta: string): Promise<PedidoLote[]> {
  const r = await e()
    .PEDIDOS_DB.prepare(
      `SELECT referencia, creado, site, lineas, unidades, estado FROM pedidos
       WHERE lote = ? AND estado != 'anulado' ORDER BY creado`,
    )
    .bind(etiqueta)
    .all<PedidoLote>();
  return r.results ?? [];
}

/** Paso 1. Devuelve cuántos pedidos entraron AHORA (0 si ya estaba cerrado y no había nada nuevo). */
export async function cerrarLote(lote: Lote, ahora = new Date()): Promise<number> {
  // Un lote no se cierra antes de su corte: se llevaría solo parte del mes.
  if (ahora.toISOString() < lote.corte) throw new Error(`El lote ${lote.etiqueta} aún no ha llegado a su corte.`);
  const db = e().PEDIDOS_DB;
  const [, asignar] = await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO lotes (etiqueta, corte, cerrado) VALUES (?, ?, ?)")
      .bind(lote.etiqueta, lote.corte, ahora.toISOString()),
    // `site IS NOT NULL`: solo producto (las donaciones sueltas no se fabrican). Estados: lo
    // pagado y vivo; `pendiente` es de la época de transferencias y `anulado` no se produce.
    db
      .prepare(
        `UPDATE pedidos SET lote = ?
         WHERE lote IS NULL AND site IS NOT NULL
           AND estado IN ('pagado', 'listo', 'entregado') AND creado < ?`,
      )
      .bind(lote.etiqueta, lote.corte),
  ]);
  return asignar.meta.changes ?? 0;
}

/** Codifica en base64 un texto UTF-8 (adjuntos de Resend). */
function base64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Paso 2. Manda el correo del lote a la caja. `forzar` lo reenvía aunque ya hubiera salido (botón
 * del panel); sin él, solo si no salió. Devuelve el instante de envío, o null si no salió.
 */
export async function avisarLote(lote: Lote, forzar = false): Promise<string | null> {
  const estado = await leerLote(lote.etiqueta);
  if (!estado) return null;
  if (estado.correo && !forzar) return estado.correo;
  const clave = e().RESEND_API_KEY;
  if (!clave) {
    console.error("Lote", lote.etiqueta, "cerrado pero sin RESEND_API_KEY: no sale el correo");
    return null;
  }
  const pedidos = await pedidosDelLote(lote.etiqueta);
  const { asunto, html, texto } = componerCorreoLote(lote, pedidos);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        // Dos disparos del cron a la vez mandan UN correo; el reenvío manual lleva clave propia.
        "Idempotency-Key": forzar ? `lote/${lote.etiqueta}/${Date.now()}` : `lote/${lote.etiqueta}`,
      },
      body: JSON.stringify({
        from: CORREO.from,
        to: LOTE_PROVEEDOR.para,
        subject: asunto,
        html,
        text: texto,
        attachments: pedidos.length
          ? [{ filename: `lote-${lote.etiqueta}.csv`, content: base64(csvProveedor(lote, pedidos)) }]
          : undefined,
      }),
    });
    if (!res.ok) {
      console.error("Resend rechazó el correo del lote", lote.etiqueta, res.status, await res.text());
      return null;
    }
  } catch (err) {
    console.error("Resend no respondió (lote)", lote.etiqueta, String(err));
    return null;
  }
  const enviado = new Date().toISOString();
  await e().PEDIDOS_DB.prepare("UPDATE lotes SET correo = ? WHERE etiqueta = ?").bind(enviado, lote.etiqueta).run();
  return enviado;
}

/**
 * Lo que lanza el cron. Los crons de Cloudflare van en UTC y Madrid cambia de hora, así que hay
 * varios disparos el día 21 y aquí se decide: solo actúa el día 21 de Madrid desde las 8:00. Los
 * disparos posteriores no hacen nada si todo salió, y reintentan el correo si falló.
 */
export async function rutinaLote(ahora: Date): Promise<string> {
  const m = enMadrid(ahora);
  if (m.dia !== DIA_CORTE || m.hora < 8) return `fuera de hora (${m.dia}, ${m.hora} h Madrid)`;
  const lote = loteDelMes(m.anio, m.mes);
  const nuevos = await cerrarLote(lote, ahora);
  const correo = await avisarLote(lote);
  return `lote ${lote.etiqueta}: ${nuevos} pedidos asignados ahora · correo ${correo ?? "NO enviado"}`;
}
