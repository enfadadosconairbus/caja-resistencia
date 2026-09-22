/**
 * Formateos compartidos entre servidor y cliente.
 *
 * Viven aquí, y no en un componente, porque los usan las dos orillas: el bloque de la
 * horquilla se pinta en servidor y su gráfico es cliente. Exportarlos desde un módulo
 * `"use client"` haría que el servidor no pudiera llamarlos.
 */

/** Euros en formato corto: 299,9 M€ · 1,2 M€ · 640 k€. */
export function eurosCorto(v: number, lang: string): string {
  const nf = (d: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: d });
  if (Math.abs(v) >= 1e6) return `${nf(1).format(v / 1e6)} M€`;
  if (Math.abs(v) >= 1e3) return `${nf(0).format(v / 1e3)} k€`;
  return `${nf(0).format(v)} €`;
}

/**
 * Fecha en la zona peninsular, siempre.
 *
 * La zona fija no es un capricho: en los componentes cliente el servidor pinta en UTC y el
 * navegador repintaría en la zona del visitante, el texto no casaría y React rompería la
 * hidratación (ya pasó: error #418 medido en producción). Además el conflicto es en España.
 */
export function fechaES(iso: string, lang: string, opciones: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat(lang, { ...opciones, timeZone: "Europe/Madrid" }).format(d);
}
