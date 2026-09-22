import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { FONDO } from "@/config/fondo";
import {
  CAMISETA,
  DONACIONES,
  MAX_UNIDADES,
  SITES,
  PREFIJO_REF,
  BENEFICIARIO,
} from "@/config/pedidos";

/**
 * Crea un pedido de la tienda y devuelve los datos de la transferencia.
 *
 * Todo se valida AQUÍ (servidor): tallas, cantidades, tope, donación y precio. El navegador
 * nunca decide el dinero. La referencia es correlativa y atómica (Durable Object `PEDIDO_REF`),
 * y el pedido se guarda en D1 (`PEDIDOS_DB`) en estado `pendiente` hasta que Tesorería concilia
 * la transferencia por su concepto (= referencia).
 */
export const dynamic = "force-dynamic";

type LineaEntrada = { talla?: unknown; cantidad?: unknown };

function error(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(request: Request) {
  let body: {
    lineas?: unknown;
    donacion?: unknown;
    nombre?: unknown;
    email?: unknown;
    site?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return error("Petición no válida.");
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const site = typeof body.site === "string" ? body.site.trim() : "";
  const donacion = Math.floor(Number(body.donacion ?? 0));
  const lineasRaw = Array.isArray(body.lineas) ? (body.lineas as LineaEntrada[]) : [];

  if (!nombre) return error("Indica tu nombre.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Revisa tu email.");
  if (!(DONACIONES as readonly number[]).includes(donacion)) return error("Donación no válida.");

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

  if (unidades === 0 && donacion === 0) return error("Añade al menos una camiseta o una donación.");
  if (unidades > MAX_UNIDADES) return error(`Máximo ${MAX_UNIDADES} unidades por pedido.`);
  if (unidades > 0 && !(SITES as readonly string[]).includes(site))
    return error("Elige tu site de recogida.");

  const iban = FONDO.cuenta.iban;
  if (!iban) return error("La cuenta del fondo no está disponible.", 503);

  const total = unidades * CAMISETA.precio + donacion;

  // Referencia correlativa y atómica.
  const ns = env.PEDIDO_REF;
  const stub = ns.get(ns.idFromName("tienda"));
  const numero = await stub.siguiente();
  const referencia = `${PREFIJO_REF}-${String(numero).padStart(5, "0")}`;

  await env.PEDIDOS_DB.prepare(
    `INSERT INTO pedidos (referencia, creado, nombre, email, site, lineas, unidades, donacion, total, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
  )
    .bind(
      referencia,
      new Date().toISOString(),
      nombre,
      email,
      unidades > 0 ? site : null,
      JSON.stringify(lineas),
      unidades,
      donacion,
      total,
    )
    .run();

  return NextResponse.json(
    { ok: true, referencia, beneficiario: BENEFICIARIO, iban, total, concepto: referencia },
    { headers: { "Cache-Control": "no-store" } },
  );
}
