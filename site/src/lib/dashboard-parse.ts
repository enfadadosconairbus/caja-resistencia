/**
 * Extracción del `const DATA = {…}` del dashboard de terceros (airbus-huelga.github.io).
 *
 * Módulo sin dependencias ni alias, a propósito: lo importan tanto la web
 * (src/lib/termometro-source.ts) como el script de snapshot que corre en Node
 * (scripts/snapshot-termometro.mjs). Una sola implementación del parseo.
 */

/** Un día de la banda de impacto acumulado (mínimo y máximo por escenario). */
export type PuntoHorquilla = {
  dia: string;
  minAcum: number;
  maxAcum: number;
  minDia: number;
  maxDia: number;
  /** true a partir de hoy: es proyección, no dato observado. */
  proyeccion: boolean;
};

export type Horquilla = {
  serie: PuntoHorquilla[];
  /** Último punto NO proyectado. */
  hoy: PuntoHorquilla | null;
  /** Último punto de la serie (final de la proyección). */
  fin: PuntoHorquilla | null;
  /**
   * Fecha del ANÁLISIS que sostiene la banda (los costes por planta y los colchones de
   * inventario), en ISO. No es la fecha del último dato: la serie se alarga sola cada día,
   * pero los supuestos sobre los que se calcula solo cambian cuando el tercero rehace el
   * análisis. De ahí sale el aviso de «desactualizado», y por eso se retira solo.
   */
  analisis: string | null;
};

const MESES_ES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Saca la fecha del análisis del título de la tarjeta del panel, que la escribe a mano:
 * «Horquilla mín–máx: impacto por regímenes (análisis 13 jul 2026)».
 */
export function parseAnalisisHorquilla(html: string): string | null {
  const m = html.match(/an[áa]lisis\s+(\d{1,2})\s+([a-záéíóú]{3})[a-záéíóú.]*\s+(\d{4})/i);
  if (!m) return null;
  const mes = MESES_ES[m[2].toLowerCase()];
  return mes ? `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Recorta el objeto DATA del HTML equilibrando llaves (hay strings con `{` dentro). */
export function parseDATA(html: string): Record<string, unknown> {
  const marca = "const DATA = ";
  const i = html.indexOf(marca);
  if (i < 0) throw new Error("no se encontró 'const DATA ='");
  let j = i + marca.length;
  if (html[j] !== "{") throw new Error("DATA no empieza por '{'");
  let depth = 0, inStr = false, esc = false;
  for (; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(i + marca.length, j + 1));
    }
  }
  throw new Error("llaves de DATA sin equilibrar");
}

/**
 * Banda mín-máx del impacto acumulado a la empresa ("punto de ruptura"). El origen la da
 * en euros: cota mínima = el colchón de inventario aguanta toda la ventana; cota máxima =
 * se rompe a las tres semanas y el coste diario se dispara.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseHorquilla(D: any, html?: string): Horquilla | null {
  const serie = D?.impacto_plantas?.horquilla?.serie;
  if (!Array.isArray(serie) || !serie.length) return null;
  const puntos: PuntoHorquilla[] = serie
    .filter((s: any) => s && s.dia != null && s.min_acum != null && s.max_acum != null)
    .map((s: any) => ({
      dia: String(s.dia),
      minAcum: Number(s.min_acum),
      maxAcum: Number(s.max_acum),
      minDia: Number(s.min_dia ?? 0),
      maxDia: Number(s.max_dia ?? 0),
      proyeccion: Boolean(s.proyeccion),
    }));
  if (!puntos.length) return null;
  const reales = puntos.filter((p) => !p.proyeccion);
  return {
    serie: puntos,
    hoy: reales[reales.length - 1] ?? null,
    fin: puntos[puntos.length - 1] ?? null,
    analisis: html ? parseAnalisisHorquilla(html) : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
