import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { CAMISETA, COMISION_STRIPE, ESTADOS_SHEET, REPARTO_CAMISETA, TIENDA_ACTIVA } from "@/config/pedidos";
import ES from "@/app/[lang]/dictionaries/es.json";
import { enviarCorreo } from "@/lib/correo";
import {
  asegurarConfirmacion,
  leerPedido,
  listarPedidos,
  paraCorreo,
  paraSheet,
  secretoSheetValido,
} from "@/lib/pedidos-seguimiento";

/**
 * Puerta del Sheet de gestión (`backend-sheet/Code.gs`) hacia los pedidos. Solo la usa la
 * Apps Script, que se identifica con la cabecera `X-Caja-Secreto` (= SHEET_SHARED_SECRET).
 *
 * Acciones (POST JSON):
 *
 *   { accion: "estado", referencia, estado }
 *     Cambia el estado en D1. Al pasar a `listo` envía el aviso de recogida, UNA vez: si ya se
 *     envió, no se repite aunque la celda se cambie y se vuelva a poner. Si el correo falla,
 *     NO cambia nada y responde error, para que el Sheet devuelva la celda a su valor anterior.
 *
 *   { accion: "sincronizar" }
 *     Red de seguridad, la lanza el Sheet cada hora. Reintenta los correos de confirmación que
 *     fallaron (pedidos de los últimos 3 días) y devuelve todos los pedidos para que el Sheet
 *     añada los que le falten. Así ninguno se queda fuera aunque Google o Resend fallaran.
 *
 *     Devuelve también el CATÁLOGO (nombre, precio, coste, tallas, comisión de Stripe): el
 *     Sheet lo muestra en su hoja CATALOGO, de SOLO LECTURA, y lo usa en el DASHBOARD para
 *     calcular cuánto llega a la caja. Los precios se cambian aquí, en el código, que es lo
 *     que valida cada cobro; nunca en el Sheet.
 *
 *   { accion: "volcados", referencias: [...] }
 *     El Sheet confirma qué filas ha añadido en la sincronización (marca `en_sheet`).
 */
export const dynamic = "force-dynamic";

/** Hasta cuándo se reintenta un «pago recibido» que no salió. */
const VENTANA_REINTENTO_MS = 3 * 24 * 60 * 60 * 1000;

/** Lo que el Sheet necesita saber del catálogo. Hoy, un producto: la camiseta. */
function catalogo() {
  return {
    activo: TIENDA_ACTIVA,
    comision: COMISION_STRIPE,
    productos: [
      {
        id: CAMISETA.id,
        nombre: ES.tienda.producto.nombre,
        precio: CAMISETA.precio,
        coste: CAMISETA.coste,
        tallas: [...CAMISETA.tallas],
        // Reparto de UNA unidad pagada sola (con el fijo de Stripe entero).
        caja_por_unidad: REPARTO_CAMISETA.caja,
      },
    ],
  };
}

const json = (cuerpo: unknown, status = 200) =>
  NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!secretoSheetValido(request.headers.get("x-caja-secreto"))) {
    return json({ ok: false, error: "No autorizado." }, 403);
  }

  let body: { accion?: unknown; referencia?: unknown; estado?: unknown; referencias?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Petición no válida." }, 400);
  }

  if (body.accion === "estado") {
    const referencia = typeof body.referencia === "string" ? body.referencia.trim() : "";
    const estado = typeof body.estado === "string" ? body.estado.trim() : "";
    if (!(ESTADOS_SHEET as readonly string[]).includes(estado)) {
      return json({ ok: false, error: `Estado no válido: ${estado}` }, 400);
    }
    const p = referencia ? await leerPedido(referencia) : null;
    if (!p) return json({ ok: false, error: `No existe el pedido ${referencia}.` }, 404);

    let avisado = p.correo_listo;
    if (estado === "listo" && !avisado) {
      const clave = (env as { RESEND_API_KEY?: string }).RESEND_API_KEY;
      if (!clave) return json({ ok: false, error: "Falta RESEND_API_KEY: no se puede avisar." }, 503);
      const ok = await enviarCorreo(clave, "listo", paraCorreo(p));
      if (!ok) return json({ ok: false, error: "El correo de aviso no salió. Inténtalo de nuevo." }, 502);
      avisado = new Date().toISOString();
    }

    await env.PEDIDOS_DB.prepare("UPDATE pedidos SET estado = ?, correo_listo = ? WHERE referencia = ?")
      .bind(estado, avisado, referencia)
      .run();
    return json({ ok: true, referencia, estado, avisado });
  }

  if (body.accion === "sincronizar") {
    const pedidos = await listarPedidos();
    // Reintento de «pago recibido» solo para pedidos recientes y vivos: uno de hace semanas
    // (o de las pruebas de agosto) no debe recibir de repente una confirmación.
    const desde = new Date(Date.now() - VENTANA_REINTENTO_MS).toISOString();
    let correos = 0;
    for (const p of pedidos) {
      if (p.estado === "anulado" || p.correo_confirmacion || p.creado < desde) continue;
      if (await asegurarConfirmacion(p)) correos++;
    }
    // NO se empuja al Sheet desde aquí: el Sheet está esperando esta respuesta con su cerrojo
    // tomado, y un POST de vuelta se quedaría bloqueado. El Sheet añade él mismo las filas que
    // le falten a partir de esta lista; luego confirma cuáles con «volcados».
    return json({ ok: true, correos, pedidos: pedidos.map(paraSheet), catalogo: catalogo() });
  }

  if (body.accion === "volcados") {
    const refs = Array.isArray(body.referencias) ? body.referencias.filter((r) => typeof r === "string") : [];
    const ahora = new Date().toISOString();
    for (const r of refs) {
      await env.PEDIDOS_DB.prepare("UPDATE pedidos SET en_sheet = ? WHERE referencia = ? AND en_sheet IS NULL")
        .bind(ahora, r)
        .run();
    }
    return json({ ok: true, marcados: refs.length });
  }

  return json({ ok: false, error: "Acción desconocida." }, 400);
}
