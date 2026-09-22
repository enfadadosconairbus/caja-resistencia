/**
 * Piezas compartidas del índice de documentos del grupo.
 *
 * Las usan `snapshot-documentos.mjs` (congelar el índice) y `publicar-indice.mjs`
 * (bajar y publicar lo que falte). Una sola implementación de las rutas, el mapa de
 * archivos y las correcciones a mano.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const BASE = dirname(fileURLToPath(import.meta.url));

export const PENDIENTES = join(BASE, "pendientes");
export const PUBLICOS = join(BASE, "..", "public", "docs");
export const DESTINO = join(BASE, "..", "src", "config", "documentos.json");
export const OVERRIDES = join(BASE, "documentos-overrides.json");
export const REPO = join(BASE, "..", "..", "..", "..");
export const SITE = join(BASE, "..");

export const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

const LIMPIADOR = join(BASE, "limpiar_metadatos.py");

function limpiador(args) {
  return spawnSync("python", [LIMPIADOR, ...args], {
    cwd: SITE,
    encoding: "utf8",
    // La consola de Windows es cp1252 y el listado lleva acentos: sin esto el limpiador
    // muere a media limpieza con UnicodeEncodeError.
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
}

/**
 * Borra los metadatos de autoría de `rutas`, in situ, con `limpiar_metadatos.py`.
 *
 * Se limpia el ORIGINAL de `pendientes/` ANTES de copiarlo, y no la copia ya publicada,
 * porque `mapaArchivos` (abajo) une índice y descarga comparando el SHA-256 de los dos
 * ficheros: limpiar solo el lado público rompe esa unión, el documento vuelve a contar como
 * no publicado y al día siguiente la tarea de las 10:30 copia otra vez el original sucio con
 * otro nombre. No es una hipótesis —pasó el 14-ago-2026: 81 documentos republicados con la
 * matrícula de Airbus dentro un día después de la limpieza del 13—. Limpiando el origen, la
 * copia sale idéntica byte a byte y la unión se mantiene.
 *
 * Devuelve las rutas que NO quedaron limpias (cifradas, o con restos tras tres pasadas);
 * lo que no salga limpio de aquí no se publica. Lanza si el limpiador no se puede ni
 * ejecutar: sin él no hay publicación que valga.
 */
export function limpiarMetadatos(rutas) {
  if (!rutas.length) return [];
  const r = limpiador(rutas);
  if (r.error || r.status !== 0) {
    const causa = (r.error?.message ?? r.stderr ?? "").trim() || `salió ${r.status}`;
    throw new Error(`no pude ejecutar limpiar_metadatos.py (${causa})`);
  }
  const dijo = (r.stdout ?? "").trim();
  if (dijo) console.log(dijo.replace(/^/gm, "  "));
  // Se comprueba en vez de suponerlo: el limpiador avisa de lo que no puede tocar (un PDF
  // cifrado se queda como está) y devuelve 0 igualmente.
  if (limpiador(["--check", ...rutas]).status === 0) return [];
  return rutas.filter((f) => limpiador(["--check", f]).status !== 0);
}

export function tamano(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Slug ASCII para nombres de fichero publicables. */
export function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 70);
}

export async function fetcher(url) {
  const res = await fetch(url, { headers: { "User-Agent": "caja-resistencia-snapshot" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

/** Ficheros de un directorio, indexados por SHA-256. */
function porHash(dir) {
  const m = new Map();
  if (!existsSync(dir)) return m;
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isFile()) m.set(sha(full), f);
  }
  return m;
}

/** Slug sin recortar, solo para COMPARAR nombres (el de publicar sí se recorta). */
const slugCmp = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();

/** msgId → nombre de fichero en `pendientes/` (el id viaja en el nombre). */
export function mapaPendientes() {
  const out = {};
  if (!existsSync(PENDIENTES)) return out;
  for (const f of readdirSync(PENDIENTES)) {
    const full = join(PENDIENTES, f);
    if (!statSync(full).isFile()) continue;
    const id = (f.match(/^\d{4}-\d{2}-\d{2}_(\d+)_/) ?? [])[1];
    if (id && !out[id]) out[id] = f;
  }
  return out;
}

/**
 * Nombre de documento → fichero en `pendientes/`.
 *
 * Red de rescate para cuando el índice apunta a un REPOST que ya no existe en Telegram
 * mientras el mismo documento sí está bajado con otro id (pasa: el mismo PDF se reenvía
 * varias veces y el índice cataloga una de las copias). El nombre ya viene slugificado por
 * `descargar-docs.py`, así que basta comparar slugs completos.
 */
export function mapaPendientesPorNombre() {
  const out = new Map();
  if (!existsSync(PENDIENTES)) return out;
  for (const f of readdirSync(PENDIENTES)) {
    if (!statSync(join(PENDIENTES, f)).isFile()) continue;
    const m = f.match(/^\d{4}-\d{2}-\d{2}_\d+_(.+)\.[a-z0-9]+$/i);
    if (m && !out.has(slugCmp(m[1]))) out.set(slugCmp(m[1]), f);
  }
  return out;
}

/** Fichero local de un documento del índice: primero por id, y si no, por nombre. */
export function ficheroDe(doc, porId, porNombre) {
  return porId[String(doc.msgId)]
    ?? porNombre.get(slugCmp(doc.fichero.replace(/\.[a-z0-9]+$/i, "")))
    ?? null;
}

/**
 * msgId → { pdf, meta } de lo YA publicado en /public/docs.
 *
 * La unión se hace por **SHA-256**: `pendientes/<fecha>_<msgId>_<slug>.<ext>` guarda el id
 * del mensaje en el nombre y su contenido es byte a byte el del fichero publicado. Nombres
 * distintos, mismo hash → misma pieza, sin adivinar. Como `pendientes/` es local, este mapa
 * solo puede calcularse aquí: es lo que convierte una entrada del índice en una descarga.
 */
export function mapaArchivos(indice) {
  const publicos = porHash(PUBLICOS);
  const entrada = (f) => {
    const nombre = publicos.get(sha(join(PENDIENTES, f)));
    return nombre
      ? {
          pdf: `/docs/${nombre}`,
          meta: `${extname(nombre).slice(1).toUpperCase()} · ${tamano(statSync(join(PUBLICOS, nombre)).size)}`,
        }
      : null;
  };

  const archivos = {};
  for (const [id, f] of Object.entries(mapaPendientes())) {
    const e = entrada(f);
    if (e) archivos[id] = e;
  }

  // Segunda pasada por NOMBRE, para los que el índice referencia por un repost borrado.
  if (indice) {
    const porNombre = mapaPendientesPorNombre();
    for (const d of indice.categorias.flatMap((c) => c.documentos)) {
      const id = String(d.msgId);
      if (!d.msgId || archivos[id]) continue;
      const f = ficheroDe(d, {}, porNombre);
      const e = f ? entrada(f) : null;
      if (e) archivos[id] = e;
    }
  }
  return archivos;
}

/** Clave de identidad de un documento, para no listarlo dos veces. */
export const claveDoc = (d) => (d.msgId != null ? `m:${d.msgId}` : `f:${String(d.fichero).toLowerCase()}`);

/**
 * Correcciones a mano: qué no se lista, qué títulos se reescriben y qué se adelanta.
 *
 * Las entradas de `anadir` se indexan por id de mensaje, que es lo que las casa con el
 * índice y con `archivos`. Se admite además una clave NO numérica (`sin-msg-<slug>`) para
 * lo que se publicó antes de que el id viajara en el nombre del fichero: ahí no hay
 * mensaje al que apuntar, así que `msgId` y `grupoUrl` quedan a null y la descarga sale
 * del `pdf` que la propia entrada trae.
 */
export function leerOverrides() {
  const ov = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
  return {
    excluir: new Set(Object.keys(ov.excluir ?? {}).filter((k) => /^\d+$/.test(k))),
    titulos: Object.fromEntries(Object.entries(ov.titulos ?? {}).filter(([k]) => /^\d+$/.test(k))),
    anadir: Object.entries(ov.anadir ?? {}).map(([k, d]) => ({
      ...d,
      msgId: /^\d+$/.test(k) ? Number(k) : null,
    })),
  };
}

/**
 * Aplica overrides + mapa de archivos y devuelve el snapshot listo para escribir.
 * `excluidos`, `titulos` y `anadidos` viajan dentro porque la web lee el índice EN VIVO:
 * sin ellos, un documento oculto reaparecería —y uno adelantado desaparecería— en cuanto
 * telegra.ph respondiese.
 */
export function construirSnapshot(indice) {
  const archivos = mapaArchivos(indice);
  const { excluir, titulos, anadir } = leerOverrides();

  // Lo que el índice ya cataloga gana: si el grupo acabó catalogando un adelantado, la
  // entrada de `anadir` se ignora sola en vez de esperar a que alguien la retire a mano
  // (que es lo que avisa `avisoAnadir`, y lo que la revisión de las 20:00 haría inviable:
  // deja una entrada por documento publicado fuera del índice).
  const catalogados = new Set(indice.categorias.flatMap((c) => c.documentos).map(claveDoc));

  let ocultos = 0;
  const categorias = indice.categorias
    .map((c) => ({
      ...c,
      documentos: [
        // Adelantados: van primero porque se adelantan justamente por ser lo más reciente,
        // y las categorías del índice ya vienen ordenadas por fecha descendente.
        ...anadir.filter((a) => a.categoria === c.slug && !catalogados.has(claveDoc(a))),
        ...c.documentos,
      ]
        .filter((d) => {
          const fuera = d.msgId != null && excluir.has(String(d.msgId));
          if (fuera) ocultos++;
          return !fuera;
        })
        .map((d) => ({ ...d, titulo: titulos[String(d.msgId)] ?? d.titulo })),
    }))
    .filter((c) => c.documentos.length);

  const docs = categorias.reduce((a, c) => a + c.documentos.length, 0);
  const conFichero = categorias
    .flatMap((c) => c.documentos)
    .filter((d) => d.pdf || (d.msgId && archivos[String(d.msgId)])).length;

  return {
    snapshot: {
      ...indice,
      categorias,
      total: docs,
      capturado: new Date().toISOString(),
      archivos,
      excluidos: [...excluir],
      titulos,
      anadidos: anadir,
    },
    stats: { docs, conFichero, ocultos, categorias: categorias.length },
  };
}

/**
 * Escribe el snapshot solo si cambió algo de verdad.
 *
 * `capturado` cambia en cada pasada, así que sin esta comprobación la tarea diaria
 * dejaría el repo sucio todos los días aunque no hubiera nada nuevo — y esa suciedad se
 * cruza con el `git pull --rebase --autostash` de la tarea de las 20:00.
 *
 * Devuelve true si escribió.
 */
export function guardarSnapshot(snapshot) {
  const nuevo = JSON.stringify(snapshot, null, 2) + "\n";
  // Se compara sin el sello de tiempo y con finales de línea normalizados: git deja el
  // fichero en CRLF (autocrlf) y Node lo escribe en LF, así que comparar en crudo nunca
  // casaría y volveríamos a escribir cada día.
  const comparable = (s) => s.replace(/\r\n/g, "\n").replace(/^\s*"capturado":.*$/m, "");
  if (existsSync(DESTINO) && comparable(readFileSync(DESTINO, "utf8")) === comparable(nuevo)) {
    return false;
  }
  writeFileSync(DESTINO, nuevo);
  return true;
}
