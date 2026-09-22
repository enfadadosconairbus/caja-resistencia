import { env } from "cloudflare:workers";
import { verificarAccess, CABECERA_ACCESS } from "@/lib/access";

/**
 * Cambia el estado de un pedido (pendiente | pagado | anulado). Lo llama el formulario del panel.
 * Está bajo `/panel/*`, así que Cloudflare Access lo cubre; aun así verificamos el JWT aquí
 * (defensa en profundidad, fail-closed). Tras actualizar, redirige de vuelta al panel (303).
 */
export const dynamic = "force-dynamic";

const ESTADOS = ["pendiente", "pagado", "anulado"] as const;

export async function POST(request: Request) {
  const identidad = await verificarAccess(request.headers.get(CABECERA_ACCESS));
  if (!identidad) return new Response("No autorizado", { status: 403 });

  const form = await request.formData();
  const referencia = String(form.get("referencia") ?? "").trim();
  const estado = String(form.get("estado") ?? "").trim();

  if (!referencia || !(ESTADOS as readonly string[]).includes(estado)) {
    return new Response("Datos no válidos", { status: 400 });
  }

  await env.PEDIDOS_DB.prepare("UPDATE pedidos SET estado = ? WHERE referencia = ?")
    .bind(estado, referencia)
    .run();

  return Response.redirect(new URL("/panel", request.url).toString(), 303);
}
