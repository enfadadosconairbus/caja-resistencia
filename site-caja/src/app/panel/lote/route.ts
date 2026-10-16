import { verificarAccess, CABECERA_ACCESS } from "@/lib/access";
import { avisarLote, cerrarLote, leerLote, pedidosDelLote } from "@/lib/lote-proveedor";
import { csvProveedor, loteDeEtiqueta, loteVencido } from "@/lib/lotes";

/**
 * Lote mensual al proveedor, a mano. Bajo `/panel/*` (Access) + verificación propia del JWT.
 *
 *   GET  /panel/lote?etiqueta=AAAA-MM   → el CSV de ese lote, el mismo que lleva el correo.
 *   POST /panel/lote  accion=cerrar     → cierra el lote vencido y manda el correo si no salió.
 *                     accion=reenviar   → vuelve a mandar el correo del lote vencido.
 *
 * Es la red de la rutina del día 21: si el cron no corrió o el correo falló, esto lo arregla
 * sin duplicar nada (un pedido con lote no cambia de lote).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await verificarAccess(request.headers.get(CABECERA_ACCESS)))) {
    return new Response("No autorizado", { status: 403 });
  }
  const etiqueta = new URL(request.url).searchParams.get("etiqueta") ?? "";
  const lote = loteDeEtiqueta(etiqueta);
  if (!lote || !(await leerLote(etiqueta))) return new Response("Ese lote no está cerrado.", { status: 404 });
  const csv = csvProveedor(lote, await pedidosDelLote(etiqueta));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lote-${etiqueta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!(await verificarAccess(request.headers.get(CABECERA_ACCESS)))) {
    return new Response("No autorizado", { status: 403 });
  }
  const accion = String((await request.formData()).get("accion") ?? "");
  if (accion !== "cerrar" && accion !== "reenviar") return new Response("Acción no válida", { status: 400 });

  const lote = loteVencido(new Date());
  await cerrarLote(lote);
  const enviado = await avisarLote(lote, accion === "reenviar");
  if (!enviado) return new Response("Lote cerrado, pero el correo no salió. Vuelve a intentarlo.", { status: 502 });
  return Response.redirect(new URL("/panel", request.url).toString(), 303);
}
