#!/usr/bin/env node
/**
 * Enlaza los medios citados en la cronología con el artículo que publicaron.
 *
 * Los hitos citan medios desde el principio («Publicado por: Expansión · El Mundo»), pero solo
 * como nombres. Esto los convierte en enlaces al artículo, sin cambiar a quién se cita.
 *
 * Un enlace fabricado en una cronología documental es peor que no tener enlace, así que cada
 * URL tiene que venir de una de estas **dos procedencias, y de ninguna otra**:
 *
 * 1. **Del snapshot** (`medios`) — el emparejamiento dice hito + medio, y la URL, el titular y
 *    la fecha salen de `src/config/termometro.json`, captura real del panel de terceros. Si no
 *    aparece el artículo, el script falla en vez de inventarlo.
 * 2. **Externa verificada** (`externos`) — el panel trae 76 de 85 artículos como redirección de
 *    Google News, que no se enlazan (ver `REDIRECTOR`), así que los medios que solo están ahí
 *    se buscaron en su propia web. Cada una de esas URL se **abrió y se comprobó** que responde
 *    y que el titular y la fecha son los que dice el JSON; la fecha de esa comprobación queda
 *    escrita en `verificado`. El script revalida lo que puede sin red: que sea `https`, que no
 *    sea un redirector y que el dominio case con el medio.
 *
 * Regla editorial: **por defecto solo se enlazan medios que el hito ya citaba.** Añadir un medio
 * nuevo cambia la cita, y la cronología está validada. Se puede hacer, pero hay que marcarlo
 * entrada por entrada con `anadir: true`, para que sea una decisión y no un descuido.
 *
 *   node scripts/prensa-cronologia.mjs --proponer  # busca candidatos y los lista, sin tocar nada
 *   node scripts/prensa-cronologia.mjs --lista     # qué escribiría con los destinos aprobados
 *   node scripts/prensa-cronologia.mjs             # escribe en hitos.json
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = path.dirname(fileURLToPath(import.meta.url));
const HITOS = path.join(BASE, "..", "src", "config", "hitos.json");
const TERMOMETRO = path.join(BASE, "..", "src", "config", "termometro.json");
const MAPA = path.join(BASE, "prensa-cronologia.json");

const rel = (p) => path.relative(process.cwd(), p);
const modo = process.argv.includes("--proponer")
  ? "proponer"
  : process.argv.includes("--lista")
    ? "lista"
    : "escribir";

/** Días de margen entre la fecha del hito y la del artículo. La prensa publica el mismo día o
 *  al siguiente; más allá ya no está cubriendo ese hecho, está cubriendo otro. */
const MARGEN_DIAS = 2;

/** El artículo tiene que hablar del conflicto. El panel es un agregador de «Airbus»: el mismo
 *  día que se pide la mediación del SIMA publica entregas de helicópteros e incendios. */
const DEL_CONFLICTO =
  /huelga|preacuerdo|sindicat|convenio|mediaci|SIMA|plantilla|paro|salarial|negociaci|trabajadores|strike/i;

/**
 * Redirectores. **Solo se enlaza al medio, nunca a través de un intermediario**, y de los 85
 * artículos del snapshot 76 llegan como enlace de Google News. Se descartan por dos razones,
 * y cualquiera de las dos bastaría:
 *
 * 1. **Privacidad.** Esta web presume de no cargar recursos de terceros sin consentimiento;
 *    mandar al lector a través del redirector de Google es un salto de seguimiento que
 *    contradice esa promesa, y encima sin que él lo vea venir: el enlace no enseña su destino.
 * 2. **Duran poco.** Las URL de artículo de Google News caducan. Una cronología documental que
 *    dentro de un año enlace a 404 no documenta nada.
 *
 * El medio cuyo artículo solo existe así se queda como nombre suelto, que es la verdad: sabemos
 * que lo publicó y no tenemos un enlace decente al que mandar.
 */
const REDIRECTOR = /(^|\.)(news\.google\.com|google\.[a-z.]+|t\.co|bit\.ly|feedproxy\.google\.com)$/i;
const esRedirector = (url) => {
  try {
    return REDIRECTOR.test(new URL(url).hostname);
  } catch {
    return true; // una URL que ni se puede parsear tampoco se enlaza
  }
};

const hitos = JSON.parse(await readFile(HITOS, "utf8"));
const termo = JSON.parse(await readFile(TERMOMETRO, "utf8"));

/** Artículos únicos del snapshot, de las dos listas que lo traen. */
const articulos = [];
const vistos = new Set();
for (const n of [...(termo.impacto ?? []), ...(termo.cronologico ?? [])]) {
  if (n?.url && !vistos.has(n.url)) {
    vistos.add(n.url);
    articulos.push(n);
  }
}

const dia = (iso) => (iso ? Date.parse(String(iso).slice(0, 10)) : NaN);
const distancia = (a, b) => Math.abs(dia(a) - dia(b)) / 86400000;
const nombreMedio = (p) => (typeof p === "string" ? p : p.medio);

/** Normaliza el nombre del medio: el panel mezcla «Cinco Días» con «cincodias.elpais.com». */
const normaliza = (m) =>
  m
    .toLowerCase()
    .replace(/\.(com|es|net|org|info)$/, "")
    .replace(/[^a-z0-9]/g, "");

function candidatos(hito, medio) {
  return articulos
    .filter(
      (a) =>
        normaliza(a.medio) === normaliza(medio) &&
        !esRedirector(a.url) &&
        distancia(a.fecha, hito.fecha) <= MARGEN_DIAS &&
        DEL_CONFLICTO.test(a.titulo),
    )
    .sort((a, b) => distancia(a.fecha, hito.fecha) - distancia(b.fecha, hito.fecha));
}

/**
 * Resuelve el artículo aprobado para un medio.
 *
 * Con `url` la elección es de quien edita: se acepta si esa URL está en el snapshot, es de ese
 * medio y no es un redirector. Sirve para desempatar cuando un medio publicó varias veces el
 * mismo día, y para citas legítimas fuera del margen de fechas —un artículo del 7 que anuncia
 * lo que pasa el 11—.
 *
 * Sin `url` se exige **un solo** candidato. Si hay varios no se elige «el más cercano»: se
 * falla. Desempatar por orden de array es elegir a ciegas, y con Demócrata publicando el mismo
 * día en tres idiomas eso acaba citando la versión francesa sin que nadie lo haya decidido.
 */
function resolver(hito, medio, url) {
  if (url) {
    const a = articulos.find((x) => x.url === url);
    if (!a) return { error: `la URL fijada no está en el snapshot del termómetro` };
    if (normaliza(a.medio) !== normaliza(medio)) return { error: `la URL fijada es de «${a.medio}», no de «${medio}»` };
    if (esRedirector(a.url)) return { error: `la URL fijada es un redirector` };
    return { articulo: a };
  }
  const cs = candidatos(hito, medio);
  if (!cs.length) return { error: `sin artículo enlazable en el snapshot` };
  if (cs.length > 1) {
    return {
      error:
        `${cs.length} candidatos; fija uno con "url" en el JSON:\n` +
        cs.map((c) => `           ${(c.fecha || "").slice(0, 10)}  ${c.titulo.slice(0, 70)}\n           ${c.url}`).join("\n"),
    };
  }
  return { articulo: cs[0] };
}

// ── --proponer: qué se podría enlazar, para revisarlo a mano ──────────────────
if (modo === "proponer") {
  let conArticulo = 0;
  let sin = 0;
  for (const h of hitos.hitos) {
    if (!h.prensa?.length) continue;
    console.log(`\n${h.fecha} · ${h.titulo.es}`);
    for (const p of h.prensa) {
      const medio = nombreMedio(p);
      const cs = candidatos(h, medio);
      if (!cs.length) {
        console.log(`  —  ${medio}  (sin artículo en el snapshot)`);
        sin++;
        continue;
      }
      conArticulo++;
      cs.forEach((c, i) =>
        console.log(`  ${i === 0 ? "✓" : " "}  ${medio}  ${(c.fecha || "").slice(0, 10)}  ${c.titulo.slice(0, 88)}`),
      );
    }
  }
  console.log(
    `\n${conArticulo} cita(s) con artículo localizable · ${sin} sin él.\n` +
      `Los ✓ son el más cercano en fecha. Nada de esto se escribe: pásalo a ${rel(MAPA)}.`,
  );
  process.exit(0);
}

// ── --lista y escribir: aplicar los destinos aprobados ────────────────────────
const { enlaces } = JSON.parse(await readFile(MAPA, "utf8"));
let puestos = 0;
const problemas = [];

for (const e of enlaces) {
  const hito = hitos.hitos.find(
    (h) => h.fecha === e.fecha && h.titulo.es.toLowerCase().includes(e.titulo.toLowerCase()),
  );
  if (!hito) {
    problemas.push(`no hay un hito único {${e.fecha} · "${e.titulo}"}`);
    continue;
  }
  if (!hito.prensa?.length) {
    problemas.push(`${e.fecha} · ${e.titulo}: el hito no cita prensa`);
    continue;
  }

  // ── Artículos externos: los que el panel solo trae vía redirector ──────────
  for (const x of e.externos ?? []) {
    const fallo = (() => {
      let u;
      try {
        u = new URL(x.url);
      } catch {
        return "la URL no es válida";
      }
      if (u.protocol !== "https:") return "la URL no es https";
      if (esRedirector(x.url)) return "la URL es un redirector, no del medio";
      // El dominio tiene que parecerse al medio: evita pegar por error el enlace de otro sitio.
      const dom = normaliza(u.hostname.replace(/^www\./, "").split(".")[0]);
      if (!dom.includes(normaliza(x.medio)) && !normaliza(x.medio).includes(dom)) {
        return `el dominio (${u.hostname}) no case con el medio «${x.medio}»`;
      }
      if (!x.titulo || !x.fecha || !x.verificado) return "falta titulo, fecha o verificado";
      return null;
    })();
    if (fallo) {
      problemas.push(`${e.fecha} · ${e.titulo} · ${x.medio}: ${fallo}`);
      continue;
    }

    const i = hito.prensa.findIndex((p) => normaliza(nombreMedio(p)) === normaliza(x.medio));
    if (i === -1 && !x.anadir) {
      problemas.push(
        `${e.fecha} · ${e.titulo}: «${x.medio}» no estaba citado; si de verdad se añade, ponle "anadir": true`,
      );
      continue;
    }
    if (modo === "escribir") {
      const entrada = { medio: x.medio, titulo: x.titulo, url: x.url, fecha: x.fecha };
      if (i === -1) hito.prensa.push(entrada);
      else hito.prensa[i] = entrada;
    }
    console.log(`${hito.fecha} · ${x.medio}${i === -1 ? "  (medio AÑADIDO)" : ""}\n    ${x.titulo.slice(0, 95)}\n    ${new URL(x.url).hostname}`);
    puestos++;
  }

  for (const ref of e.medios ?? []) {
    const medio = typeof ref === "string" ? ref : ref.medio;
    const i = hito.prensa.findIndex((p) => normaliza(nombreMedio(p)) === normaliza(medio));
    if (i === -1) {
      // La regla editorial, aplicada por el código y no por la buena fe de quien edita.
      problemas.push(`${e.fecha} · ${e.titulo}: «${medio}» no estaba citado; añadirlo cambia la cita`);
      continue;
    }
    const { articulo: a, error } = resolver(hito, medio, typeof ref === "string" ? null : ref.url);
    if (error) {
      problemas.push(`${e.fecha} · ${e.titulo} · ${medio}: ${error}`);
      continue;
    }
    if (modo === "escribir") {
      hito.prensa[i] = { medio: nombreMedio(hito.prensa[i]), titulo: a.titulo, url: a.url, fecha: a.fecha };
    }
    console.log(`${hito.fecha} · ${medio}\n    ${a.titulo.slice(0, 95)}\n    ${new URL(a.url).hostname}`);
    puestos++;
  }
}

if (problemas.length) {
  console.error(`\n✗ ${problemas.length} problema(s); no se escribe nada:`);
  for (const p of problemas) console.error(`    ${p}`);
  process.exit(1);
}

if (modo === "escribir") {
  await writeFile(HITOS, JSON.stringify(hitos, null, 2) + "\n", "utf8");
  console.log(`\n✓ ${puestos} cita(s) enlazadas en ${rel(HITOS)}.`);
} else {
  console.log(`\n${puestos} cita(s) se enlazarían. Ejecuta sin --lista para escribirlas.`);
}

const totalCitas = hitos.hitos.flatMap((h) => h.prensa ?? []).length;
console.log(`Quedan ${totalCitas - puestos} cita(s) como nombre suelto, sin artículo localizado.`);
