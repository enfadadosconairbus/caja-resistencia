import { env } from "cloudflare:workers";
import { verificarAccess, CABECERA_ACCESS } from "@/lib/access";

/**
 * Exporta todos los pedidos en CSV (UTF-8 con BOM, para que Excel respete los acentos).
 * Bajo `/panel/*` (cubierto por Access) + verificación propia del JWT.
 */
export const dynamic = "force-dynamic";

type Fila = {
  referencia: string;
  creado: string;
  nombre: string;
  email: string;
  site: string | null;
  lineas: string;
  unidades: number;
  donacion: number;
  total: number;
  estado: string;
};

const CABECERAS = [
  "referencia",
  "creado",
  "nombre",
  "email",
  "site",
  "lineas",
  "unidades",
  "donacion",
  "total",
  "estado",
] as const;

function celda(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Entrecomilla siempre y escapa las comillas: robusto ante comas, saltos de línea y ";".
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const identidad = await verificarAccess(request.headers.get(CABECERA_ACCESS));
  if (!identidad) return new Response("No autorizado", { status: 403 });

  const { results } = await env.PEDIDOS_DB.prepare(
    `SELECT referencia, creado, nombre, email, site, lineas, unidades, donacion, total, estado
     FROM pedidos ORDER BY creado DESC`,
  ).all<Fila>();
  const filas = results ?? [];

  const lineas = [
    CABECERAS.join(","),
    ...filas.map((f) => CABECERAS.map((c) => celda((f as Record<string, unknown>)[c])).join(",")),
  ];
  const csv = "﻿" + lineas.join("\r\n") + "\r\n";

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
