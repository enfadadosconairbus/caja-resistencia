import fallback from "@/config/documentos.json";
import { cargarIndice, type CategoriaIndice, type DocumentoIndice } from "@/lib/indice-parse";

/**
 * Índice de documentos del movimiento, para la sección Documentación.
 *
 * El grupo publica a diario un índice en telegra.ph (pestaña «3: Grupo Documentación»).
 * Mismo patrón que el termómetro: lo baja el SERVIDOR (revalidado 1 h) y el navegador del
 * visitante nunca contacta con telegra.ph. Si la descarga o el parseo fallan, se sirve el
 * último snapshot bueno del repo — la página no se rompe por una fuente ajena.
 *
 * Dos cosas que solo puede aportar el snapshot y por eso viajan en él:
 *   · `archivos`  — msgId → PDF ya publicado en /docs. El enlace del índice apunta al
 *     mensaje del grupo (privado); sin este mapa no habría descarga real.
 *   · `excluidos` / `titulos` — correcciones a mano (documentación interna que no se
 *     lista, títulos ilegibles). Se aplican TAMBIÉN al índice en vivo.
 *   · `anadidos` — documentos que el grupo ya ha publicado en el canal pero **todavía no ha
 *     catalogado** en su índice. Normalmente se espera: el índice manda, y la tarea diaria los
 *     recoge solos. Esto es la excepción, para cuando hace falta adelantar uno.
 *
 * Se regenera con:  node scripts/snapshot-documentos.mjs
 */

const REVALIDAR_S = 3600;

export type DocumentoPublicado = DocumentoIndice & {
  /** Ruta del PDF en /public si el documento ya está publicado; si no, null. */
  pdf: string | null;
  /** Etiqueta del archivo, p. ej. "PDF · 516 KB". */
  meta: string | null;
};

export type CategoriaPublicada = Omit<CategoriaIndice, "documentos"> & {
  documentos: DocumentoPublicado[];
  /** Cuántos de esta categoría se pueden descargar desde la web. */
  descargables: number;
};

type Archivos = Record<string, { pdf: string; meta: string }>;

const ARCHIVOS = (fallback as { archivos?: Archivos }).archivos ?? {};
const EXCLUIDOS = new Set((fallback as { excluidos?: string[] }).excluidos ?? []);
const TITULOS = (fallback as { titulos?: Record<string, string> }).titulos ?? {};
/**
 * Un adelantado puede traer su propia descarga (`pdf` + `meta`).
 *
 * Los que publica la revisión de las 20:00 la traen SIEMPRE, y no se apoyan en `ARCHIVOS`:
 * ese mapa une índice y fichero por SHA-256, y el hash es frágil —volver a limpiarle los
 * metadatos a un PDF le regenera el `/ID` y rompe la unión sin tocar el contenido (pasó el
 * 20-ago-2026 con 125 ficheros de `pendientes/`)—. Cuando somos nosotros quienes copiamos
 * el fichero, sabemos su nombre: se anota y no hay nada que adivinar.
 */
type Anadido = DocumentoIndice & { categoria: string; pdf?: string; meta?: string };
const ANADIDOS = (fallback as { anadidos?: Anadido[] }).anadidos ?? [];

/** Clave de identidad de un documento, para no listarlo dos veces. */
const clave = (d: { msgId: number | null; fichero: string }) =>
  d.msgId != null ? `m:${d.msgId}` : `f:${d.fichero.toLowerCase()}`;

/** Cruza el índice con lo que hay publicado en /docs y aplica las correcciones a mano. */
function resolver(categorias: CategoriaIndice[]): CategoriaPublicada[] {
  /**
   * Lo que el índice ya cataloga. Un adelantado que coincida se descarta: el índice manda.
   *
   * Cubre los dos casos en que saldría duplicado. El previsto —el grupo acaba catalogando
   * lo que adelantamos, y hasta ahora había que acordarse de retirar la entrada a mano—, y
   * uno que no lo estaba: el snapshot del repo YA lleva los adelantados dentro de sus
   * categorías, así que al servirlo como fallback se volvían a añadir aquí.
   */
  const catalogados = new Set(categorias.flatMap((c) => c.documentos).map(clave));
  return categorias
    .map((c) => {
      const documentos = [
        // Los adelantados van primero: se adelantan por ser lo más reciente, y las categorías
        // del índice ya llegan ordenadas por fecha descendente.
        ...ANADIDOS.filter((a) => a.categoria === c.slug && !catalogados.has(clave(a))),
        ...c.documentos,
      ]
        .filter((d) => !(d.msgId != null && EXCLUIDOS.has(String(d.msgId))))
        .map((d) => {
          const propio = (d as Anadido).pdf;
          const f = propio
            ? { pdf: propio, meta: (d as Anadido).meta ?? "" }
            : d.msgId != null
              ? ARCHIVOS[String(d.msgId)]
              : undefined;
          return {
            ...d,
            titulo: (d.msgId != null ? TITULOS[String(d.msgId)] : undefined) ?? d.titulo,
            pdf: f?.pdf ?? null,
            meta: f?.meta ?? null,
          };
        });
      return { ...c, documentos, descargables: documentos.filter((d) => d.pdf).length };
    })
    .filter((c) => c.documentos.length);
}

export type IndiceDocumentos = {
  categorias: CategoriaPublicada[];
  total: number;
  descargables: number;
  actualizado: string | null;
  fuente: string;
  enVivo: boolean;
};

function armar(
  categorias: CategoriaIndice[],
  actualizado: string | null,
  fuente: string,
  enVivo: boolean,
): IndiceDocumentos {
  const cats = resolver(categorias);
  return {
    categorias: cats,
    total: cats.reduce((a, c) => a + c.documentos.length, 0),
    descargables: cats.reduce((a, c) => a + c.descargables, 0),
    actualizado,
    fuente,
    enVivo,
  };
}

export async function getDocumentos(): Promise<IndiceDocumentos> {
  try {
    const indice = await cargarIndice(async (url) => {
      const res = await fetch(url, { next: { revalidate: REVALIDAR_S } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
    return armar(indice.categorias, indice.actualizado, indice.fuente, true);
  } catch {
    const f = fallback as unknown as {
      categorias: CategoriaIndice[];
      actualizado: string | null;
      fuente: string;
    };
    return armar(f.categorias, f.actualizado, f.fuente, false);
  }
}
