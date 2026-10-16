import { CAMISETA, SITES } from "@/config/pedidos";

/**
 * Lote mensual al proveedor: qué pedidos entran, el CSV que se le reenvía y el correo a la caja.
 *
 * Solo cuentas, sin D1 ni red (eso vive en `lote-proveedor.ts`), para poder probarlo fuera del
 * Worker. Todas las fechas se razonan en hora de MADRID y se guardan en ISO UTC, como `creado`.
 *
 * El lote «2026-10» es lo que entró del 21-sep 00:00 al 21-oct 00:00 (Madrid): el día 20 entero
 * dentro, el 21 entero fuera. Intervalo semiabierto, así que el instante de corte pertenece a un
 * solo lote. La rutina corre el 21 por la mañana, con el día 20 ya terminado.
 */

export const DIA_CORTE = 21;
const ZONA = "Europe/Madrid";

/** Lo que el lote necesita de un pedido. Sin nombre, email ni teléfono: el CSV va a un tercero. */
export type PedidoLote = {
  referencia: string;
  creado: string;
  site: string | null;
  lineas: string;
  unidades: number;
  estado: string;
};

export type Lote = {
  etiqueta: string; // «AAAA-MM»
  desde: string; // ISO UTC, inicio nominal (21 del mes anterior, 00:00 Madrid)
  corte: string; // ISO UTC, fin exclusivo (21 del mes, 00:00 Madrid)
};

/** Fecha y hora de pared en Madrid para un instante. */
export function enMadrid(instante: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

/** Las 00:00 de ese día en Madrid, como instante UTC. Vale en horario de verano y de invierno. */
export function medianocheMadrid(anio: number, mes: number, dia: number): Date {
  const pared = Date.UTC(anio, mes - 1, dia);
  let t = pared;
  // Dos pasadas: la segunda corrige si la primera cayó al otro lado de un cambio de hora.
  for (let i = 0; i < 2; i++) {
    const m = enMadrid(new Date(t));
    const desfase = Date.UTC(m.anio, m.mes - 1, m.dia, m.hora, m.minuto, m.segundo) - t;
    t = pared - desfase;
  }
  return new Date(t);
}

const dosCifras = (n: number) => String(n).padStart(2, "0");

/** El lote de un mes concreto. */
export function loteDelMes(anio: number, mes: number): Lote {
  const anterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  return {
    etiqueta: `${anio}-${dosCifras(mes)}`,
    desde: medianocheMadrid(anterior.anio, anterior.mes, DIA_CORTE).toISOString(),
    corte: medianocheMadrid(anio, mes, DIA_CORTE).toISOString(),
  };
}

/**
 * El último lote que ya debería estar cerrado en ese instante: el del mes en curso a partir del
 * día 21 (Madrid), y si no, el del mes anterior. Lanzarlo a mano cualquier día cierra el que toca.
 */
export function loteVencido(ahora: Date): Lote {
  const m = enMadrid(ahora);
  if (m.dia >= DIA_CORTE) return loteDelMes(m.anio, m.mes);
  return m.mes === 1 ? loteDelMes(m.anio - 1, 12) : loteDelMes(m.anio, m.mes - 1);
}

/** «AAAA-MM» válida → su lote; cualquier otra cosa → null. */
export function loteDeEtiqueta(etiqueta: string): Lote | null {
  const m = /^(\d{4})-(\d{2})$/.exec(etiqueta);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return loteDelMes(Number(m[1]), Number(m[2]));
}

/* ───────────────────────────── Recuento ───────────────────────────── */

function lineasDe(p: PedidoLote): { talla: string; cantidad: number }[] {
  try {
    const l = JSON.parse(p.lineas) as { talla: string; cantidad: number }[];
    return Array.isArray(l) ? l.filter((x) => x && typeof x.talla === "string") : [];
  } catch {
    return [];
  }
}

/** Tallas en el orden del catálogo; una talla desconocida (no debería) va al final, no se pierde. */
function ordenTallas(pedidos: PedidoLote[]): string[] {
  const base: string[] = [...CAMISETA.tallas];
  for (const p of pedidos) for (const l of lineasDe(p)) if (!base.includes(l.talla)) base.push(l.talla);
  return base;
}

export function resumenLote(lote: Lote, pedidos: PedidoLote[]) {
  const tallas = ordenTallas(pedidos);
  const porTalla: Record<string, number> = Object.fromEntries(tallas.map((t) => [t, 0]));
  const porCentro: Record<string, { pedidos: number; uds: number }> = {};
  let uds = 0;
  for (const p of pedidos) {
    const centro = p.site ?? "—";
    porCentro[centro] ??= { pedidos: 0, uds: 0 };
    porCentro[centro].pedidos++;
    for (const l of lineasDe(p)) {
      porTalla[l.talla] += Number(l.cantidad) || 0;
      porCentro[centro].uds += Number(l.cantidad) || 0;
      uds += Number(l.cantidad) || 0;
    }
  }
  const centros = [
    ...SITES.filter((s) => porCentro[s]),
    ...Object.keys(porCentro).filter((s) => !(SITES as readonly string[]).includes(s)),
  ];
  return {
    tallas,
    porTalla,
    porCentro,
    centros,
    uds,
    // Pedidos de antes del 21 del mes anterior: un lote que no se cerró a tiempo. Se mandan
    // ahora, pero conviene saberlo.
    arrastrados: pedidos.filter((p) => p.creado < lote.desde).map((p) => p.referencia),
    // Ya marcados como listos o entregados antes de producir: puede ser un error en el Sheet.
    raros: pedidos.filter((p) => p.estado !== "pagado").map((p) => `${p.referencia} (${p.estado})`),
  };
}

/* ─────────────────────────────── CSV ─────────────────────────────── */

const celda = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** «16/10/2026 12:21» en hora de Madrid. */
export function fechaMadrid(iso: string): string {
  const m = enMadrid(new Date(iso));
  return `${dosCifras(m.dia)}/${dosCifras(m.mes)}/${m.anio} ${dosCifras(m.hora)}:${dosCifras(m.minuto)}`;
}

/**
 * CSV para el proveedor: una fila por pedido con una columna por talla, y la fila TOTAL. Separado
 * por `;` y con BOM, que es lo que abre bien un Excel en español (con `,` sale todo en una columna).
 * Sin datos personales: referencia y centro bastan para producir y repartir.
 */
export function csvProveedor(lote: Lote, pedidos: PedidoLote[]): string {
  const r = resumenLote(lote, pedidos);
  const cab = ["Referencia", "Fecha", "Centro", ...r.tallas, "Uds."];
  const filas = pedidos.map((p) => {
    const n: Record<string, number> = {};
    for (const l of lineasDe(p)) n[l.talla] = (n[l.talla] ?? 0) + (Number(l.cantidad) || 0);
    const total = Object.values(n).reduce((a, b) => a + b, 0);
    return [p.referencia, fechaMadrid(p.creado), p.site ?? "", ...r.tallas.map((t) => n[t] ?? 0), total];
  });
  const total = ["TOTAL", "", "", ...r.tallas.map((t) => r.porTalla[t]), r.uds];
  return "﻿" + [cab, ...filas, total].map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}

/* ────────────────────────────── Correo ────────────────────────────── */

/** «1 pedido», «3 pedidos». */
const n = (k: number, una: string, varias: string) => `${k} ${k === 1 ? una : varias}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** «21/09/2026» del día de pared en Madrid. */
export function diaMadrid(iso: string) {
  const m = enMadrid(new Date(iso));
  return `${dosCifras(m.dia)}/${dosCifras(m.mes)}/${m.anio}`;
}

/** El último día que entra: el anterior al corte. */
export function ultimoDia(lote: Lote) {
  return diaMadrid(new Date(new Date(lote.corte).getTime() - 12 * 3600 * 1000).toISOString());
}

/** Correo a la caja con el lote. Lo revisa una persona y reenvía el adjunto al proveedor. */
export function componerCorreoLote(lote: Lote, pedidos: PedidoLote[]) {
  const r = resumenLote(lote, pedidos);
  const periodo = `del ${diaMadrid(lote.desde)} al ${ultimoDia(lote)} (ambos incluidos)`;
  const asunto = pedidos.length
    ? `Lote ${lote.etiqueta} para el proveedor: ${n(pedidos.length, "pedido", "pedidos")}, ${n(r.uds, "camiseta", "camisetas")}`
    : `Lote ${lote.etiqueta}: sin pedidos nuevos`;

  const texto: string[] = [`Lote ${lote.etiqueta} · pedidos pagados ${periodo}, hora de Madrid.`, ""];
  if (!pedidos.length) {
    texto.push("No ha entrado ningún pedido en este periodo. No hay nada que mandar al proveedor.");
  } else {
    texto.push(
      `${n(pedidos.length, "pedido", "pedidos")} · ${n(r.uds, "camiseta", "camisetas")}.`,
      "",
      "Por talla:",
      ...r.tallas.filter((t) => r.porTalla[t]).map((t) => `  ${t}: ${r.porTalla[t]}`),
      "",
      "Por centro:",
      ...r.centros.map((c) => `  ${c}: ${r.porCentro[c].uds} uds. (${n(r.porCentro[c].pedidos, "pedido", "pedidos")})`),
      "",
      `Adjunto: lote-${lote.etiqueta}.csv. Reenvíalo al proveedor: lleva referencia, centro y tallas, sin nombres ni contactos.`,
    );
  }
  const avisos: string[] = [];
  if (r.arrastrados.length) {
    avisos.push(
      `Incluye ${n(r.arrastrados.length, "pedido", "pedidos")} de antes del ${diaMadrid(lote.desde)} sin mandar en su mes (¿falló un lote anterior?): ${r.arrastrados.join(", ")}.`,
    );
  }
  if (r.raros.length) {
    avisos.push(`Ya figuran como listos o entregados antes de producirse; revísalos en el Sheet: ${r.raros.join(", ")}.`);
  }
  if (avisos.length) texto.push("", "OJO:", ...avisos.map((a) => `  · ${a}`));
  texto.push(
    "",
    "Cada pedido queda marcado con su lote en la web: no volverá a salir en el del mes que viene.",
    "Rutina automática de cajaderesistencia-asi-no.org (día 21, 8:00).",
  );

  const tabla = (cab: string[], filas: (string | number)[][]) =>
    `<table style="border-collapse:collapse;margin:8px 0 16px;font-size:14px">` +
    `<tr>${cab.map((c) => `<th style="text-align:left;padding:4px 12px 4px 0;border-bottom:2px solid #101e33">${esc(c)}</th>`).join("")}</tr>` +
    filas
      .map(
        (f) =>
          `<tr>${f.map((c) => `<td style="padding:4px 12px 4px 0;border-bottom:1px solid #e2e6ec">${esc(String(c))}</td>`).join("")}</tr>`,
      )
      .join("") +
    `</table>`;

  let cuerpo = `<p style="margin:0 0 12px">Pedidos pagados <strong>${esc(periodo)}</strong>, hora de Madrid.</p>`;
  if (!pedidos.length) {
    cuerpo += `<p>No ha entrado ningún pedido en este periodo. No hay nada que mandar al proveedor.</p>`;
  } else {
    cuerpo +=
      `<p style="font-size:20px;margin:0 0 16px"><strong>${pedidos.length}</strong> pedidos · <strong>${r.uds}</strong> camisetas</p>` +
      `<h3 style="margin:0">Por talla</h3>` +
      tabla(["Talla", "Uds."], [...r.tallas.filter((t) => r.porTalla[t]).map((t) => [t, r.porTalla[t]]), ["TOTAL", r.uds]]) +
      `<h3 style="margin:0">Por centro</h3>` +
      tabla(["Centro", "Pedidos", "Uds."], r.centros.map((c) => [c, r.porCentro[c].pedidos, r.porCentro[c].uds])) +
      `<p>Adjunto: <strong>lote-${esc(lote.etiqueta)}.csv</strong>. Reenvíalo al proveedor: lleva referencia, centro y tallas, sin nombres ni contactos.</p>`;
  }
  if (avisos.length) {
    cuerpo +=
      `<div style="background:#fff4ce;padding:10px 14px;margin:12px 0"><strong>Ojo</strong><ul style="margin:6px 0 0;padding-left:18px">` +
      avisos.map((a) => `<li>${esc(a)}</li>`).join("") +
      `</ul></div>`;
  }
  cuerpo +=
    `<p style="color:#5b6b82;font-size:12px;margin-top:20px">Cada pedido queda marcado con su lote en la web: no volverá a salir en el del mes que viene.<br>` +
    `Rutina automática de cajaderesistencia-asi-no.org (día 21, 8:00).</p>`;

  const html =
    `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#101e33;max-width:640px">` +
    `<h2 style="margin:0 0 8px">Lote ${esc(lote.etiqueta)} · camisetas</h2>${cuerpo}</body></html>`;

  return { asunto, html, texto: texto.join("\n") };
}
