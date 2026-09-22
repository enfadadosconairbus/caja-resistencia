import fallback from "@/config/actas.json";

/**
 * Actas de asamblea para la sección Actualizaciones.
 *
 * ESTADO DE LA FUENTE (17-jul-2026): el canal que dio Carlos (t.me/+MnuqJDCAAgYyMGQ0)
 * es un canal PRIVADO (enlace de invitación), y Telegram NO expone los canales privados
 * por web. Por eso `CANAL` está a null y de momento se sirven actas de EJEMPLO.
 *
 * Cuando exista una fuente pública (ver README de la sección), basta con poner el
 * @usuario del canal público en `CANAL`: este módulo lee `t.me/s/<canal>` desde el
 * SERVIDOR (revalidado 1 h, sin llamar a terceros en el navegador — igual que el
 * termómetro), detecta los mensajes de acta y los ordena por fecha. El navegador nunca
 * contacta con Telegram.
 */

const CANAL: string | null = null; // @usuario de un canal PÚBLICO de actas (sin @)
const REVALIDAR_S = 3600;

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

export type Acta = {
  site: string | null;
  fecha: string | null;
  titulo: string;
  cuerpo: string;
  /**
   * "acta" = acta de asamblea (por centro) · "grupo" = Resumen Grupo Enfadados con Airbus ·
   * "comunicado" = comunicado sindical (descarga) · "soporte" = documentación de respaldo
   * que sustenta las reivindicaciones (dossiers, informes, tablas) · "otros" = suelto.
   */
  tipo?: "acta" | "grupo" | "comunicado" | "soporte" | "otros";
  /** Si está, la tarjeta es una DESCARGA (no se despliega): URL del PDF en /public. */
  pdf?: string;
  /** Etiqueta del archivo, p. ej. "PDF · 132 KB". */
  meta?: string;
  /** Ocultar temporalmente (limpieza en curso). */
  oculto?: boolean;
  /**
   * Traducciones opcionales del título y el cuerpo (auditoría 2026-08). El userbot escribe
   * siempre el español en `titulo`/`cuerpo`; si falta la entrada de un idioma, se cae al
   * español. El cuerpo admite el mismo markdown ligero que el español (negritas y enlaces).
   */
  i18n?: Partial<Record<"en" | "fr" | "de", { titulo: string; cuerpo: string }>>;
};

/** Centros de Airbus España que agrupamos, en el orden en que se muestran los filtros. */
export const SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"] as const;
export type Site = (typeof SITES)[number];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const primera = (t: string) => t.split(/\r?\n/)[0] ?? "";
// El marcador va AL PRINCIPIO de la primera línea + mensaje largo: descarta los mensajes
// de chat que solo PIDEN el acta ("¿podéis poner el resumen?").
const INICIO_ACTA = /^[\W_]*(ACTA|RESUMEN|MINUTAS)\s+(?:DE\s+(?:LA\s+)?)?ASAMBLEA/;

/** ¿Este mensaje es un acta de asamblea (cabecera de acta + cuerpo con contenido)? */
export function esActa(texto: string): boolean {
  return INICIO_ACTA.test(norm(primera(texto))) && texto.trim().length >= 300;
}

/**
 * Etiqueta el acta por centro. Además de los 6 nombres canónicos, reconoce alias
 * habituales (Puerto Real → Cádiz; Sevilla suele ser San Pablo o Tablada, que se
 * nombran aparte). Devuelve siempre uno de SITES o null.
 */
const ALIAS: Record<string, Site> = { "Puerto Real": "Cádiz" };

function detectarSede(texto: string): Site | null {
  const t = norm(primera(texto)); // el centro va en el título, no en el cuerpo
  for (const s of SITES) if (t.includes(norm(s))) return s;
  for (const [ali, site] of Object.entries(ALIAS)) if (t.includes(norm(ali))) return site;
  return null;
}

function detectarFecha(texto: string): string | null {
  const dmy = texto.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // "15 de julio de 2026", "15 julio 2026", "15 julio de 2026" — «de» opcional a ambos lados
  const txt = texto.match(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b/i);
  if (txt) {
    const mes = MESES[txt[2].toLowerCase()];
    if (mes) return `${txt[3]}-${String(mes).padStart(2, "0")}-${txt[1].padStart(2, "0")}`;
  }
  return null;
}

/** Convierte un mensaje suelto en un acta estructurada. */
export function parseActa(texto: string): Acta {
  const limpio = texto.trim();
  const titulo = (limpio.split(/\r?\n/)[0] ?? limpio).trim().slice(0, 140);
  const cuerpo = limpio.slice(titulo.length).trim() || titulo;
  return { site: detectarSede(limpio), fecha: detectarFecha(limpio), titulo, cuerpo };
}

/** Extrae los mensajes de la vista pública t.me/s/<canal> (texto + fecha del <time>). */
function mensajesDeTme(html: string): { texto: string; fecha: string | null }[] {
  const out: { texto: string; fecha: string | null }[] = [];
  const bloques = html.split('class="tgme_widget_message_text');
  for (let i = 1; i < bloques.length; i++) {
    const b = bloques[i];
    const cierre = b.indexOf("</div>");
    if (cierre < 0) continue;
    const bruto = b.slice(b.indexOf(">") + 1, cierre);
    const texto = bruto
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim();
    const t = b.match(/datetime="([^"]+)"/);
    if (texto) out.push({ texto, fecha: t ? t[1] : null });
  }
  return out;
}

/** Actas: en vivo del servidor si hay canal público; si no, las de ejemplo del repo. */
export async function getActas(): Promise<{ actas: Acta[]; ejemplo: boolean }> {
  if (CANAL) {
    try {
      const res = await fetch(`https://t.me/s/${CANAL}`, { next: { revalidate: REVALIDAR_S } });
      if (res.ok) {
        const msgs = mensajesDeTme(await res.text());
        const actas = msgs
          .filter((m) => esActa(m.texto))
          .map((m) => {
            const a = parseActa(m.texto);
            return { ...a, fecha: a.fecha ?? (m.fecha ? m.fecha.slice(0, 10) : null) };
          })
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        if (actas.length) return { actas, ejemplo: false };
      }
    } catch {
      /* cae al ejemplo */
    }
  }
  const actas = ([...fallback.actas] as Acta[])
    .filter((a) => !a.oculto)
    .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
  return { actas, ejemplo: fallback.ejemplo };
}
