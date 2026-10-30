#!/usr/bin/env node
/**
 * Guardia del panel de transparencia de /la-caja: que los datos detallados cuadren al
 * céntimo con las cifras publicadas.
 *
 *   · Cada gasto con `pagos` suma exactamente su `importe` (los pagos salen del extracto).
 *   · La recaudación diaria (`src/config/recaudacion.json`) suma `FONDO.cifras.recaudado`, y
 *     sus aportaciones por transferencia, `FONDO.cifras.aportaciones`.
 *   · Nada lleva fecha posterior al corte (`FONDO.cifras.actualizado`).
 *
 * Si algo no cuadra, el panel enseñaría una cosa en las tarjetas y otra en los gráficos.
 *
 *   node scripts/check-panel.mjs
 */
import { readFileSync } from "node:fs";
import { FONDO } from "../src/config/fondo.ts";

const cent = (v) => Math.round(v * 100);
const fallos = [];
const corte = FONDO.cifras.actualizado;

for (const c of FONDO.campanas) {
  for (const g of c.gastos) {
    if (g.importe === null) continue;
    if (!g.pagos?.length) {
      fallos.push(`${c.clave}/${g.clave}: sin pagos (el panel no sabría su fecha)`);
      continue;
    }
    const suma = g.pagos.reduce((a, p) => a + cent(p.importe), 0);
    if (suma !== cent(g.importe)) fallos.push(`${c.clave}/${g.clave}: pagos ${suma / 100} ≠ importe ${g.importe}`);
    for (const p of g.pagos) if (corte && p.fecha > corte) fallos.push(`${c.clave}/${g.clave}: pago del ${p.fecha}, posterior al corte ${corte}`);
  }
}

const { dias } = JSON.parse(readFileSync(new URL("../src/config/recaudacion.json", import.meta.url), "utf8"));
const total = dias.reduce((a, d) => a + cent(d.importe), 0);
const transf = dias.filter((d) => d.via === "transferencia").reduce((a, d) => a + d.aportaciones, 0);
if (total !== cent(FONDO.cifras.recaudado)) fallos.push(`recaudación diaria ${total / 100} ≠ recaudado ${FONDO.cifras.recaudado}`);
if (transf !== FONDO.cifras.aportaciones) fallos.push(`aportaciones diarias ${transf} ≠ aportaciones ${FONDO.cifras.aportaciones}`);
for (const d of dias) if (corte && d.fecha > corte) fallos.push(`recaudación del ${d.fecha}, posterior al corte ${corte}`);

if (fallos.length) {
  console.error("✖ El panel no cuadra:\n  " + fallos.join("\n  "));
  process.exit(1);
}
console.log(`✓ Panel: ${dias.length} días de recaudación (${total / 100} €, ${transf} aportaciones) y los pagos cuadran con cada gasto.`);
