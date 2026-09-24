/**
 * Publica en la web TODO lo que cataloga el índice de documentos del grupo.
 *
 * Lee el índice de telegra.ph, y para cada documento que aún no esté publicado:
 *   1. lo busca en `scripts/pendientes/` por el id de mensaje que lleva en el nombre;
 *   2. si no está, lo baja de Telegram (`bajar-mensajes.py`, requiere la sesión local);
 *   3. le borra los metadatos de autoría y lo copia a `public/docs/` con un nombre legible;
 *   4. rehace el snapshot, que es lo que convierte la entrada en descarga.
 *
 * ⚠️ CAMBIO DE POLÍTICA (09-ago-2026, decisión de la coordinación): hasta hoy ningún PDF se
 * publicaba sin revisión humana en el Excel (política de PILOT-001, nacida del volcado de
 * 43 documentos internos del 18-jul). Ahora **el filtro es el índice del grupo**: lo que el
 * Grupo Documentación cataloga, se publica. La red de seguridad es
 * `documentos-overrides.json` → `excluir`, que este script respeta y nunca descarga.
 *
 *   node scripts/publicar-indice.mjs              # baja, publica y rehace el snapshot
 *   node scripts/publicar-indice.mjs --sin-bajar  # solo publica lo que ya está en local
 *   node scripts/publicar-indice.mjs --commit     # además commitea, hace push y despliega
 *   node scripts/publicar-indice.mjs --dry-run    # dice qué haría, sin tocar nada
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { cargarIndice } from "../src/lib/indice-parse.ts";
import {
  detectarCandidatos, guardarCandidatos, resumir, publicarAutomaticos, resumirPublicados,
} from "./hitos-candidatos.mjs";
import {
  fetcher, construirSnapshot, guardarSnapshot, mapaPendientes, mapaPendientesPorNombre,
  mapaArchivos, ficheroDe, leerOverrides, limpiarMetadatos, slug, sha,
  PENDIENTES, PUBLICOS, REPO, SITE,
} from "./lib-documentos.mjs";

const argv = new Set(process.argv.slice(2));
const DRY = argv.has("--dry-run");
const SIN_BAJAR = argv.has("--sin-bajar");
const COMMIT = argv.has("--commit");
const REINTENTAR = argv.has("--reintentar");

// Documentos que el índice cataloga pero cuyo mensaje ya no está en Telegram (borrado).
// Se anotan para no volver a pedirlos cada día; `--reintentar` limpia la lista.
const IRRECUPERABLES = join(SITE, "scripts", "indice-irrecuperables.json");
const leerIrrecuperables = () => {
  if (REINTENTAR || !existsSync(IRRECUPERABLES)) return {};
  try { return JSON.parse(readFileSync(IRRECUPERABLES, "utf8")); } catch { return {}; }
};

/** Nombre publicable, derivado del fichero original; el id desempata si ya existe otro. */
function nombreDestino(doc, origen) {
  // La extensión buena es la del fichero real, no la del nombre del índice (hay .docx
  // que en realidad son PDF). En minúsculas: las URL distinguen mayúsculas en producción.
  const ext = (extname(origen) || ".pdf").toLowerCase();
  const base = slug(doc.fichero.replace(/\.[a-z0-9]+$/i, "")) || `documento-${doc.msgId}`;
  let nombre = `${base}${ext}`;
  if (existsSync(join(PUBLICOS, nombre))) {
    const mismo = sha(join(PUBLICOS, nombre)) === sha(join(PENDIENTES, origen));
    if (mismo) return nombre; // ya está publicado con este nombre
    nombre = `${base}-${doc.msgId}${ext}`;
  }
  return nombre;
}

function git(...args) {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${(r.stderr || r.stdout).trim()}`);
  return (r.stdout || "").trim();
}

/** Traer antes lo que haya subido el bot de la nube, para no chocar en el push. */
function sincronizar() {
  try {
    git("pull", "--rebase", "--autostash", "origin", git("rev-parse", "--abbrev-ref", "HEAD"));
  } catch (e) {
    console.log(`  aviso: no pude sincronizar con git (sigo igualmente): ${e.message}`);
  }
}

function desplegar(n, hitos = 0) {
  git("add", "clientes/caja-resistencia/site/public/docs",
      "clientes/caja-resistencia/site/src/config/documentos.json",
      "clientes/caja-resistencia/site/src/config/hitos.json",
      "clientes/caja-resistencia/site/scripts/hitos-candidatos.json");
  if (!git("diff", "--staged", "--name-only")) return "sin cambios que commitear";
  const que = [n ? `${n} documento(s)` : null, hitos ? `${hitos} hito(s)` : null]
    .filter(Boolean).join(" y ");
  git("commit", "-m",
      `docs: publicar ${que} del índice del grupo\n\n` +
      "Catalogados por el Grupo Documentación en Telegram y publicados por\n" +
      "scripts/publicar-indice.mjs. Los hitos automáticos van marcados `auto`:\n" +
      "son factuales, sin la lectura del movimiento.\n\n" +
      "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>");
  git("push", "origin", `HEAD:${git("rev-parse", "--abbrev-ref", "HEAD")}`);
  for (const cmd of ["vercel --prod --yes", "npx --yes vercel --prod --yes"]) {
    const r = spawnSync(cmd, { cwd: SITE, shell: true, encoding: "utf8" });
    if (r.status === 0) return "desplegado en Vercel";
  }
  return "commit y push hechos; el despliegue de Vercel falló (lánzalo a mano: vercel --prod)";
}

if (COMMIT && !DRY) sincronizar();

const indice = await cargarIndice(fetcher);
const { excluir } = leerOverrides();
const publicados = mapaArchivos(indice);

const pendientes = indice.categorias
  .flatMap((c) => c.documentos)
  .filter((d) => d.msgId != null)
  .filter((d) => !excluir.has(String(d.msgId)))
  .filter((d) => !publicados[String(d.msgId)]);

// Dedup: el índice cataloga el mismo id en más de una categoría de vez en cuando.
const porId = new Map(pendientes.map((d) => [String(d.msgId), d]));
console.log(`· índice: ${indice.categorias.reduce((a, c) => a + c.documentos.length, 0)} documentos · ` +
            `${Object.keys(publicados).length} ya publicados · ${porId.size} por publicar`);

let enLocal = mapaPendientes();
let porNombre = mapaPendientesPorNombre();
const local = (id) => ficheroDe(porId.get(id), enLocal, porNombre);
const irrecuperables = leerIrrecuperables();
const faltan = [...porId.keys()].filter((id) => !local(id) && !irrecuperables[id]);
const yaDescartados = [...porId.keys()].filter((id) => !local(id) && irrecuperables[id]).length;
if (yaDescartados) console.log(`· ${yaDescartados} documento(s) descartados antes (ver indice-irrecuperables.json)`);

if (faltan.length && !SIN_BAJAR && !DRY) {
  console.log(`· bajando de Telegram ${faltan.length} documento(s) que no están en local…`);
  const r = spawnSync("python", [join(SITE, "scripts", "bajar-mensajes.py"), ...faltan],
                      { cwd: SITE, encoding: "utf8" });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) console.log("  aviso: la descarga falló; sigo con lo que haya en local.");
  enLocal = mapaPendientes();
  porNombre = mapaPendientesPorNombre();
  // Lo que sigue sin aparecer es que ya no está en Telegram: se anota y no se vuelve a pedir.
  const hoy = new Date().toISOString().slice(0, 10);
  let anotados = 0;
  for (const id of faltan) {
    if (local(id)) continue;
    irrecuperables[id] = `${porId.get(id).fichero} — el mensaje ya no está en Telegram (${hoy})`;
    anotados++;
  }
  if (anotados) writeFileSync(IRRECUPERABLES, JSON.stringify(irrecuperables, null, 2) + "\n");
} else if (faltan.length) {
  console.log(`· ${faltan.length} documento(s) no están en local y no se bajan (${DRY ? "--dry-run" : "--sin-bajar"})`);
}

let publicadosAhora = 0;
const sinFichero = [];
const retenidos = [];
const aPublicar = [];
for (const [id, doc] of porId) {
  const origen = local(id);
  if (!origen) { sinFichero.push(`${id} · ${doc.fichero}`); continue; }
  if (DRY) {
    console.log(`  [dry] ${origen} → /docs/${nombreDestino(doc, origen)}`);
    publicadosAhora++;
    continue;
  }
  aPublicar.push({ id, doc, origen });
}

// Los metadatos de autoría se borran ANTES de copiar, sobre el original de `pendientes/`.
// Lo que entra en `public/docs` sale a producción tal cual, y un PDF enseña su campo Autor a
// dos clics desde el navegador: por aquí pasaron matrículas de Airbus (kosita2, C90170,
// C01037), que dentro de la empresa señalan por dónde salió el documento. Este era el agujero
// —`revisar-y-publicar.py` sí limpiaba, esta vía no— y por él se colaron 81 documentos.
// Va aquí, en el único punto por el que pasan todos, para que no dependa de que nadie se
// acuerde. Si el limpiador no está, no se publica: un día sin documentos nuevos se arregla,
// un PDF con la matrícula de quien lo sacó ya no.
if (aPublicar.length) {
  const ruta = (p) => join(PENDIENTES, p.origen);
  let sucios;
  try {
    sucios = new Set(limpiarMetadatos(aPublicar.map(ruta)));
  } catch (e) {
    console.log(`✗ ${e.message}`);
    console.log("  no publico nada esta vuelta: sin limpiar metadatos no se sube un documento.");
    sucios = new Set(aPublicar.map(ruta));
  }
  for (const p of aPublicar) {
    if (sucios.has(ruta(p))) { retenidos.push(`${p.id} · ${p.doc.fichero}`); continue; }
    copyFileSync(ruta(p), join(PUBLICOS, nombreDestino(p.doc, p.origen)));
    publicadosAhora++;
  }
}

if (!DRY) {
  const { snapshot, stats } = construirSnapshot(indice);
  const escrito = guardarSnapshot(snapshot);
  console.log(`✓ ${publicadosAhora} documento(s) publicado(s) en public/docs`);
  console.log(`${escrito ? "✓" : "·"} snapshot${escrito ? "" : " sin cambios"}: ${stats.docs} catalogados · ${stats.conFichero} descargables · ` +
              `${stats.docs - stats.conFichero} solo en el grupo` +
              (stats.ocultos ? ` · ${stats.ocultos} ocultos por overrides` : ""));
} else {
  console.log(`✓ [dry-run] se publicarían ${publicadosAhora} documento(s)`);
}

// Cronología: detecta lo que merece un hito y lo PUBLICA, sin que nadie tenga que entrar a
// aprobarlo. Los automáticos son factuales —el texto sale del resumen que el propio Grupo
// Documentación publica en su índice— y van marcados `auto` para reescribirlos luego con la
// voz del movimiento. Lo que no da la talla se queda en hitos-candidatos.json.
let hitosNuevos = 0;
if (!DRY) {
  try {
    const cand = await detectarCandidatos();
    guardarCandidatos(cand);
    console.log(resumir(cand));
    const res = publicarAutomaticos(cand.candidatos);
    hitosNuevos = res.publicados.length;
    console.log(resumirPublicados(res));
  } catch (e) {
    console.log(`· aviso: no pude actualizar la cronología (${e.message})`);
  }
}

if (sinFichero.length) {
  console.log(`· ${sinFichero.length} sin fichero (quedan enlazando al grupo):`);
  sinFichero.forEach((s) => console.log(`    ${s}`));
}

if (retenidos.length) {
  console.log(`⚠ ${retenidos.length} documento(s) NO publicado(s): conservan metadatos ` +
              "identificativos tras limpiarlos. Míralos a mano antes de subirlos:");
  retenidos.forEach((s) => console.log(`    ${s}`));
}

// Se despliega si cambió CUALQUIERA de las dos cosas: un hito de prensa no publica ningún
// documento, y aun así tiene que llegar a la web.
if (COMMIT && !DRY && (publicadosAhora > 0 || hitosNuevos > 0)) {
  console.log(`✓ ${desplegar(publicadosAhora, hitosNuevos)}`);
}
