/**
 * Propone HITOS CANDIDATOS para la cronología. No publica ninguno.
 *
 * La cronología (src/config/hitos.json) la escribe una persona: decide qué es un hito, con
 * qué palabras y con qué lectura. Eso no se automatiza. Lo que sí se automatiza es **no
 * perderse nada**: cada mañana, cuando la tarea de las 10:30 lee el índice de documentos,
 * esto mira si ha aparecido algo que probablemente merezca un hito y lo deja anotado.
 *
 * Dos señales, y las dos exigen respaldo:
 *
 *   1. DOCUMENTOS — del índice del grupo, los que encajan con lo que históricamente ha sido
 *      un hito (convocatoria, preacuerdo, comunicado conjunto, referéndum, papeleta…) y que
 *      todavía no están citados en ningún hito.
 *   2. PRENSA — días en los que **tres o más medios distintos** publican sobre lo mismo. Un
 *      medio suelto es ruido; tres coincidiendo el mismo día suele ser un hecho. Así
 *      aparecieron las marchas de Getafe y Sevilla, que no dejaron documento.
 *
 * Lo descartado se recuerda: `hitos-descartados.json` evita que vuelva a proponerse mañana.
 *
 *   node scripts/hitos-candidatos.mjs          # propone y escribe el fichero
 *   node scripts/hitos-candidatos.mjs --mudo   # solo escribe (lo usa la tarea diaria)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "./lib-documentos.mjs";
import { parseDATA } from "../src/lib/dashboard-parse.ts";

const HITOS = join(SITE, "src", "config", "hitos.json");
const DOCUMENTOS = join(SITE, "src", "config", "documentos.json");
const CANDIDATOS = join(SITE, "scripts", "hitos-candidatos.json");
const DESCARTADOS = join(SITE, "scripts", "hitos-descartados.json");
const PANEL = "https://airbus-huelga.github.io/dashboard/";

/** Lo que en este conflicto ha sido un hito, visto en los 22 primeros. */
const PATRON_DOC =
  /convocatoria|preacuerdo|acuerdo|comunicado conjunto|consulta a la plantilla|referend|papeleta|manifiesto|carta abierta|mediaci|sima|plataforma reivindicativa|huelga indefinida/i;

/** Temas que, si coinciden varios medios el mismo día, suelen ser un hecho y no una opinión. */
const TEMAS = [
  { clave: "marcha", re: /march[ae]|manifestaci[óo]n|concentraci[óo]n/i },
  { clave: "referéndum", re: /refer[ée]nd|votaci[óo]n|votan|urnas/i },
  { clave: "acuerdo", re: /preacuerdo|acuerdo/i },
  { clave: "huelga indefinida", re: /huelga indefinida|indefinid[ao]/i },
  { clave: "mediación", re: /sima|mediaci[óo]n/i },
  { clave: "negociación", re: /mesa de negociaci|negociaci[óo]n/i },
  { clave: "inicio o fin de huelga", re: /comienza|arranca|inicia|se levanta|desconvoc|vuelta al trabajo/i },
];
const MEDIOS_MINIMOS = 3;

const leer = (p, x) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : x);

/** Los msgId que el índice ha repartido. Se leen de él, no se adivinan por su pinta. */
let _msgIds;
const msgIdsDelIndice = () =>
  (_msgIds ??= new Set(Object.keys(leer(DOCUMENTOS, { archivos: {} }).archivos ?? {})));

/**
 * La raíz de un PDF: su ruta sin el msgId que el índice le pega al reenviarlo.
 *
 * Un documento reaparece en el índice cada vez que alguien lo vuelve a soltar en el grupo, y
 * se guarda otra vez con el msgId nuevo en el nombre: `preacuerdo-cnc-23072026-firmado-33337`
 * es el reenvío de `preacuerdo-cnc-23072026-firmado`. Mismo papel, otro fichero. Sin esto,
 * cada reenvío se propone —y se publica solo— como si fuera un hito nuevo; así entraron los
 * duplicados que hubo que borrar a mano de la cronología.
 *
 * El sufijo solo se corta si esos dígitos son un msgId de verdad. Recortar «cuatro o más
 * dígitos» a secas era tentador y estaba mal: hay documentos con la fecha al final del nombre
 * —`comunicado-conjunto-sipa-atp-cgt-ugt-y-util-20260715` y el `-20260720`, que son el
 * comunicado del 15 y el del 20 de julio— y los habría fundido en uno, tapando un hito real.
 */
const raizPdf = (pdf) =>
  String(pdf ?? "").replace(/-(\d{4,})(?=\.[a-z0-9]+$)/i, (m, n) => (msgIdsDelIndice().has(n) ? "" : m));

export async function detectarCandidatos() {
  const cronologia = leer(HITOS, { hitos: [], eje: {} });
  const hitos = cronologia.hitos;
  // No se filtra por el eje: lo anterior al 1 de julio también cuenta (el acta del SIMA y
  // la convocatoria son el origen del conflicto). Si un hito cae fuera, el eje se estira.
  const descartados = new Set(Object.keys(leer(DESCARTADOS, {})));

  // Un documento ya está contado si algún hito lo enlaza; una fecha, si ya tiene hito.
  const pdfUsados = new Set(hitos.flatMap((h) => (h.docs ?? []).map((d) => d.pdf)));
  const fechasConHito = new Set(hitos.map((h) => h.fecha));

  // ── 1. Documentos del índice ────────────────────────────────────────────────
  // Dos filtros contra el mismo papel repetido: el PDF exacto —varios msgId del índice
  // apuntan al mismo fichero guardado— y su raíz, que además pilla los reenvíos. Lo
  // apartado se cuenta y sale en el log: si esto empieza a tapar algo, que se note.
  const doc = leer(DOCUMENTOS, { categorias: [], archivos: {} });
  const porDocumento = [];
  const pdfVistos = new Set();
  const raicesVistas = new Set([...pdfUsados, ...descartados].map(raizPdf));
  let repetidos = 0;
  for (const c of doc.categorias) {
    for (const d of c.documentos) {
      const archivo = doc.archivos[String(d.msgId)];
      if (!archivo || pdfUsados.has(archivo.pdf)) continue;
      if (!PATRON_DOC.test(`${d.titulo} ${d.fichero}`)) continue;
      if (descartados.has(archivo.pdf)) continue;
      if (pdfVistos.has(archivo.pdf)) { repetidos++; continue; }
      pdfVistos.add(archivo.pdf);
      const raiz = raizPdf(archivo.pdf);
      if (raicesVistas.has(raiz)) { repetidos++; continue; }
      raicesVistas.add(raiz);
      porDocumento.push({
        senal: "documento",
        fecha: d.fecha,
        titulo: d.titulo,
        categoria: c.nombre,
        pdf: archivo.pdf,
        resumen: d.resumen,
        yaHayHitoEseDia: fechasConHito.has(d.fecha),
      });
    }
  }

  // ── 2. Coincidencia de prensa ───────────────────────────────────────────────
  const porPrensa = [];
  try {
    const D = parseDATA(await (await fetch(PANEL)).text());
    const porDiaTema = new Map();
    for (const n of D.feed ?? []) {
      const dia = String(n.fecha_iso ?? "").slice(0, 10);
      if (!dia || fechasConHito.has(dia)) continue;
      for (const t of TEMAS) {
        if (!t.re.test(n.titulo ?? "")) continue;
        const k = `${dia}|${t.clave}`;
        if (!porDiaTema.has(k)) porDiaTema.set(k, new Set());
        porDiaTema.get(k).add(n.medio);
      }
    }
    for (const [k, medios] of porDiaTema) {
      if (medios.size < MEDIOS_MINIMOS || descartados.has(k)) continue;
      const [fecha, tema] = k.split("|");
      porPrensa.push({ senal: "prensa", fecha, tema, medios: [...medios].slice(0, 6), clave: k });
    }
  } catch (e) {
    console.error(`  aviso: no pude leer el panel para la señal de prensa (${e.message})`);
  }

  const candidatos = [...porDocumento, ...porPrensa].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { candidatos, porDocumento: porDocumento.length, porPrensa: porPrensa.length, repetidos };
}

export function guardarCandidatos(res) {
  writeFileSync(
    CANDIDATOS,
    JSON.stringify(
      {
        nota:
          "Candidatos a hito de la cronología. NADA de esto está publicado: los hitos se escriben a mano en src/config/hitos.json, con su texto y su lectura. Esto solo evita que se pase algo por alto. Para que un candidato deje de proponerse sin subirlo, añade su 'pdf' (documentos) o su 'clave' (prensa) a scripts/hitos-descartados.json con el motivo.",
        generado: new Date().toISOString(),
        ...res,
      },
      null,
      2,
    ) + "\n",
  );
  return CANDIDATOS;
}

/** Un resumen del índice que no dice nada: no sirve para redactar un hito. */
const SIN_TEXTO = /sin texto extra[íi]ble|escaneado o de imagen/i;

/** Título legible a partir del nombre del documento. */
const tituloDe = (c) => String(c.titulo ?? "").replace(/\.[a-z0-9]+$/i, "").trim();

/**
 * Convierte un candidato en hito. Devuelve null si no da la talla.
 *
 * ⚠️ Estos hitos son FACTUALES: no llevan la lectura del movimiento que sí tienen los
 * escritos a mano, porque una valoración no se automatiza. Van marcados `auto: true` para
 * poder reescribirlos después sin tener que buscarlos uno a uno.
 *
 * El texto de los de documento sale del resumen que el propio Grupo Documentación publica
 * en su índice —aquí no se inventa nada—, y por eso se exige que ese resumen diga algo: un
 * «documento sin texto extraíble» no da para un hito.
 */
export function redactarHito(c) {
  if (c.senal === "documento") {
    const resumen = String(c.resumen ?? "").trim();
    if (resumen.length < 80 || SIN_TEXTO.test(resumen)) return null;
    const titulo = tituloDe(c);
    if (titulo.length < 4) return null;
    return {
      fecha: c.fecha,
      tipo: /convocatoria|huelga indefinida|papeleta/i.test(titulo) ? "huelga"
        : /preacuerdo|acuerdo|mediaci|sima|negociaci/i.test(titulo) ? "negociacion"
        : /referend|consulta|votaci/i.test(titulo) ? "votacion"
        : "documento",
      titulo: { es: titulo },
      texto: { es: resumen },
      docs: [{ pdf: c.pdf, titulo: { es: titulo } }],
      auto: true,
    };
  }
  if (c.senal === "prensa" && (c.medios?.length ?? 0) >= MEDIOS_MINIMOS) {
    return {
      fecha: c.fecha,
      tipo: /marcha/.test(c.tema) ? "movilizacion"
        : /refer/.test(c.tema) ? "votacion"
        : /huelga/.test(c.tema) ? "huelga"
        : "negociacion",
      titulo: { es: c.tema.charAt(0).toUpperCase() + c.tema.slice(1) },
      texto: {
        es: `Varios medios informan el mismo día sobre ${c.tema} en el conflicto de Airbus España. Publicado por ${c.medios.join(", ")}.`,
      },
      prensa: c.medios,
      auto: true,
    };
  }
  return null;
}

/**
 * Publica los candidatos que dan la talla y estira el eje si hace falta, para que ningún
 * hito quede fuera de la línea. Devuelve lo publicado y lo que no se pudo redactar.
 */
export function publicarAutomaticos(candidatos) {
  const cronologia = leer(HITOS, { hitos: [], eje: {} });
  const yaHay = new Set(cronologia.hitos.flatMap((h) => (h.docs ?? []).map((d) => d.pdf)));
  // También por raíz: aquí la comprobación era por ruta exacta, y por eso un reenvío se
  // publicaba solo aunque el mismo documento ya colgara de un hito.
  const raices = new Set([...yaHay].map(raizPdf));
  const publicados = [];
  const sinRedactar = [];

  for (const c of candidatos) {
    const h = redactarHito(c);
    if (!h) { sinRedactar.push(c); continue; }
    if (h.docs?.some((d) => yaHay.has(d.pdf) || raices.has(raizPdf(d.pdf)))) continue;
    publicados.push(h);
    h.docs?.forEach((d) => { yaHay.add(d.pdf); raices.add(raizPdf(d.pdf)); });
  }
  if (!publicados.length) return { publicados, sinRedactar };

  cronologia.hitos = [...cronologia.hitos, ...publicados].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechas = cronologia.hitos.map((h) => h.fecha);
  cronologia.eje.desde = fechas.reduce((a, b) => (a < b ? a : b), cronologia.eje.desde);
  cronologia.eje.hasta = fechas.reduce((a, b) => (a > b ? a : b), cronologia.eje.hasta);
  writeFileSync(HITOS, JSON.stringify(cronologia, null, 2) + "\n");
  return { publicados, sinRedactar };
}

/** Resumen legible para el log de la tarea diaria. */
export function resumir({ candidatos, porDocumento, porPrensa, repetidos = 0 }) {
  const nota = repetidos ? ` (${repetidos} reenvío(s) del mismo documento, apartados)` : "";
  if (!candidatos.length) return `· sin candidatos nuevos para la cronología${nota}`;
  const lineas = candidatos.slice(0, 8).map((c) =>
    c.senal === "documento"
      ? `    ${c.fecha} · doc · ${String(c.titulo).slice(0, 58)}`
      : `    ${c.fecha} · prensa · ${c.tema} (${c.medios.length} medios)`,
  );
  return (
    `· ${candidatos.length} candidato(s) a hito (${porDocumento} por documento, ${porPrensa} por prensa)${nota}:\n` +
    lineas.join("\n") +
    (candidatos.length > 8 ? `\n    …y ${candidatos.length - 8} más en hitos-candidatos.json` : "")
  );
}

/** Resumen de lo que se ha publicado solo, para el log de la tarea diaria. */
export function resumirPublicados({ publicados, sinRedactar }) {
  if (!publicados.length && !sinRedactar.length) return "· cronología al día: ningún hito nuevo";
  const l = [];
  if (publicados.length) {
    l.push(`✓ ${publicados.length} hito(s) publicado(s) solos en la cronología:`);
    publicados.forEach((h) => l.push(`    ${h.fecha} · ${h.titulo.es.slice(0, 62)}`));
    l.push("  (son factuales, sin la lectura del movimiento: van marcados auto y se pueden reescribir)");
  }
  if (sinRedactar.length) {
    l.push(`· ${sinRedactar.length} candidato(s) sin publicar por no tener con qué redactarse ` +
           "(resumen vacío o documento escaneado); están en hitos-candidatos.json");
  }
  return l.join("\n");
}

// ¿Se está ejecutando este fichero directamente? `argv[1]` no existe al importarlo desde
// `node -e` o desde otro script, así que se comprueba antes de tocarlo.
const ejecutadoDirectamente =
  process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;

if (ejecutadoDirectamente) {
  const res = await detectarCandidatos();
  guardarCandidatos(res);
  if (!process.argv.includes("--mudo")) console.log(resumir(res));
  if (!process.argv.includes("--solo-proponer")) {
    console.log(resumirPublicados(publicarAutomaticos(res.candidatos)));
  }
}
