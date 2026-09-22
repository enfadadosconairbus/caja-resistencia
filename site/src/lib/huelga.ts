/**
 * Calendario del conflicto — una sola definición, usada por la web y por los scripts de
 * snapshot. Si cambian las fechas, se cambian AQUÍ.
 *
 * El conflicto va por fases (acuerdo de la asamblea del 22-jul-2026, ratificado en las
 * papeletas de finales de julio):
 *   1ª fase  ·  1 → 23 jul 2026     · huelga con fecha de fin anunciada
 *   tregua   ·  24 jul → 23 ago     · referéndum, vacaciones, preparación de la papeleta
 *   2ª fase  ·  desde el 24 ago     · huelga INDEFINIDA, sin fecha de fin
 */

export const FASE_1_INICIO = Date.UTC(2026, 6, 1); // 1 jul 2026
export const FASE_1_FIN = Date.UTC(2026, 6, 23); // 23 jul 2026
export const FASE_2_INICIO = Date.UTC(2026, 7, 24); // 24 ago 2026

const DIA_MS = 86400000;

export type EstadoHuelga =
  /** Dentro de la primera convocatoria, que tenía fecha de fin. */
  | { fase: "primera"; dia: number; total: number }
  /** Entre convocatorias: la huelga está parada y hay fecha de reanudación. */
  | { fase: "tregua"; dias: number }
  /** Huelga indefinida en curso: se cuentan días, no queda un total al que llegar. */
  | { fase: "indefinida"; dia: number };

/** En qué punto del conflicto estamos en la fecha dada (ISO o ms). */
export function estadoHuelga(ref: string | number | null): EstadoHuelga | null {
  const t = typeof ref === "number" ? ref : Date.parse(ref ?? "");
  if (Number.isNaN(t)) return null;
  if (t < FASE_1_INICIO) return { fase: "tregua", dias: Math.ceil((FASE_1_INICIO - t) / DIA_MS) };
  if (t <= FASE_1_FIN) {
    return {
      fase: "primera",
      dia: Math.floor((t - FASE_1_INICIO) / DIA_MS) + 1,
      total: Math.floor((FASE_1_FIN - FASE_1_INICIO) / DIA_MS) + 1,
    };
  }
  if (t < FASE_2_INICIO) return { fase: "tregua", dias: Math.ceil((FASE_2_INICIO - t) / DIA_MS) };
  return { fase: "indefinida", dia: Math.floor((t - FASE_2_INICIO) / DIA_MS) + 1 };
}
