/**
 * Parser del ÍNDICE DE DOCUMENTOS que el grupo publica a diario en telegra.ph
 * (pestaña «3: Grupo Documentación» → enlace al índice).
 *
 * Una sola implementación, usada por dos sitios:
 *   · src/lib/documentos-source.ts  → la web, en vivo (revalidado 1 h, con fallback)
 *   · scripts/snapshot-documentos.mjs → congela el snapshot versionado del repo
 *
 * ⚠️ PRIVACIDAD (decisión de la coordinación, 09-ago-2026): el índice trae, por documento, el nick
 * de quien lo subió, sus reacciones y una puntuación de utilidad. NADA de eso sale de
 * aquí: son personas identificables dentro de un conflicto laboral abierto. Este parser
 * se queda solo con título, fecha, resumen y el id del mensaje (para el enlace al grupo).
 */

export type DocumentoIndice = {
  /** Título legible. Si el fichero tiene nombre opaco (cc5a6620.pdf), sale del resumen. */
  titulo: string;
  /** Nombre original del fichero: quien lo busque en el grupo lo encuentra por él. */
  fichero: string;
  /** PDF · DOCX · XLSX… derivado de la extensión. */
  formato: string;
  fecha: string | null;
  resumen: string;
  /** Id del mensaje en el grupo; es la clave que casa con el fichero ya publicado. */
  msgId: number | null;
  grupoUrl: string | null;
  /** Nº de versiones anteriores que el índice cataloga del mismo documento. */
  versiones: number;
};

export type CategoriaIndice = {
  slug: string;
  nombre: string;
  /** Cuántos dice el índice que hay (puede diferir de documentos.length si falla una página). */
  n: number;
  url: string;
  documentos: DocumentoIndice[];
};

export type Indice = {
  fuente: string;
  /** Marca de actualización que imprime el propio índice ("09/08/2026 10:00"). */
  actualizado: string | null;
  total: number | null;
  categorias: CategoriaIndice[];
};

export const INDICE_URL =
  "https://telegra.ph/Indice-de-documentos---EnfadadosconAirbus-07-14";

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", laquo: "«", raquo: "»", hellip: "…",
};

function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

/** Quita etiquetas y normaliza espacios. */
function texto(html: string): string {
  return decodificar(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function articulo(html: string): string {
  const i = html.indexOf("<article");
  const j = html.indexOf("</article>");
  return i < 0 || j < 0 ? html : html.slice(i, j);
}

function fechaIso(dmy: string | undefined): string | null {
  if (!dmy) return null;
  const m = dmy.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

const EXTENSIONES = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|csv|rtf|txt|zip)$/i;

function formatoDe(fichero: string): string {
  const m = fichero.match(EXTENSIONES);
  return m ? m[1].toUpperCase() : "DOC";
}

/**
 * Los títulos del índice son nombres de fichero tal cual salieron del móvil de alguien:
 * «CONSULTA A LA PLANTILLA.docx (1) (2).pdf», «cc5a6620.pdf». Se limpian los sufijos de
 * copia y las extensiones intermedias; los que quedan ilegibles se marcan como opacos.
 */
export function limpiarTitulo(fichero: string): { titulo: string; opaco: boolean } {
  const base = fichero
    .replace(EXTENSIONES, "")
    .replace(/\.(docx?|xlsx?|pptx?|pdf)\b/gi, " ")
    .replace(/\s*\(\d+\)\s*/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const letras = (base.match(/[a-záéíóúüñ]/gi) ?? []).length;
  const digitos = (base.match(/\d/g) ?? []).length;
  const opaco =
    base.length < 4 ||
    /^[a-f0-9]{6,}$/i.test(base) ||
    !/[a-záéíóúüñ]{4,}/i.test(base) ||
    digitos > letras;
  return { titulo: base.charAt(0).toUpperCase() + base.slice(1), opaco };
}

/** Primera frase del resumen, para titular los documentos de nombre opaco. */
function tituloDeResumen(resumen: string): string {
  const frase = resumen.split(/(?<=[.:;])\s/)[0] ?? resumen;
  return frase.length > 90 ? frase.slice(0, 87).trimEnd() + "…" : frase;
}

/** Extrae los documentos de la página HTML de UNA categoría. */
export function parseCategoria(html: string): DocumentoIndice[] {
  const cuerpo = articulo(html);
  const out: DocumentoIndice[] = [];
  for (const bloque of cuerpo.split("<li>").slice(1)) {
    const li = bloque.split("</li>")[0] ?? "";

    const mTitulo = li.match(/<strong>([\s\S]*?)<\/strong>/);
    if (!mTitulo) continue;
    const fichero = texto(mTitulo[1]).replace(/^[^\w(]*\s*/, "").trim();
    if (!fichero) continue;

    // Cabecera (fecha · autor · reacciones · puntuación) → SOLO se conserva la fecha.
    const trasTitulo = li.slice(li.indexOf("</strong>") + 9);
    const fecha = fechaIso(trasTitulo.split("<br>")[0]);

    // Resumen: entre el primer <br> y el enlace al grupo.
    const partes = trasTitulo.split("<br>");
    const resumen = texto((partes[1] ?? "").split("<a ")[0]);

    const enlaces = [...li.matchAll(/href="(https:\/\/t\.me\/c\/\d+\/(\d+))"/g)];
    const msgId = enlaces.length ? Number(enlaces[0][2]) : null;

    const { titulo, opaco } = limpiarTitulo(fichero);
    out.push({
      titulo: opaco && resumen ? tituloDeResumen(resumen) : titulo,
      fichero,
      formato: formatoDe(fichero),
      fecha,
      resumen,
      msgId,
      grupoUrl: enlaces.length ? enlaces[0][1] : null,
      versiones: Math.max(0, enlaces.length - 1),
    });
  }
  return out;
}

/** Categorías (nombre, nº y URL) de la página «Documentos» del índice. */
export function parseCategorias(html: string): Omit<CategoriaIndice, "documentos">[] {
  const cuerpo = articulo(html);
  const out: Omit<CategoriaIndice, "documentos">[] = [];
  for (const m of cuerpo.matchAll(
    /href="(\/Documentos--[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*([^<]*)/g,
  )) {
    const nombreCrudo = texto(m[2] + " " + (m[3] ?? ""));
    const n = Number((nombreCrudo.match(/\((\d+)\)\s*$/) ?? [])[1] ?? 0);
    const nombre = nombreCrudo.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!nombre) continue;
    out.push({
      slug: nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      nombre,
      n,
      url: "https://telegra.ph" + m[1],
    });
  }
  return out;
}

/** Enlace a la página «Documentos» y marca de actualización, desde el índice raíz. */
export function parseRaiz(html: string): { documentosUrl: string | null; actualizado: string | null; total: number | null } {
  const cuerpo = articulo(html);
  const m = cuerpo.match(/href="(\/Documentos---[^"]+)"/);
  const act = texto(cuerpo).match(/actualizado\s+([\d/]+\s+[\d:]+)/);
  const tot = texto(cuerpo).match(/📄?\s*Documentos\s*\((\d+)\)/);
  return {
    documentosUrl: m ? "https://telegra.ph" + m[1] : null,
    actualizado: act ? act[1] : null,
    total: tot ? Number(tot[1]) : null,
  };
}

type Fetcher = (url: string) => Promise<string>;

/** Descarga y arma el índice completo. `fetcher` la pone quien llama (con o sin caché). */
export async function cargarIndice(fetcher: Fetcher): Promise<Indice> {
  const raiz = parseRaiz(await fetcher(INDICE_URL));
  if (!raiz.documentosUrl) throw new Error("el índice no enlaza a la página de Documentos");

  const cats = parseCategorias(await fetcher(raiz.documentosUrl));
  if (!cats.length) throw new Error("no se encontró ninguna categoría");

  const categorias = await Promise.all(
    cats.map(async (c) => ({ ...c, documentos: parseCategoria(await fetcher(c.url)) })),
  );
  const conDocs = categorias.filter((c) => c.documentos.length);
  if (!conDocs.length) throw new Error("ninguna categoría trajo documentos");

  return {
    fuente: INDICE_URL,
    actualizado: raiz.actualizado,
    total: raiz.total ?? conDocs.reduce((a, c) => a + c.documentos.length, 0),
    categorias: conDocs,
  };
}
