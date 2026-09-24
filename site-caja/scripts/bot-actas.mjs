/**
 * Bot de actas — LO NUEVO (de aquí en adelante).
 *
 * Sondea la Bot API (getUpdates) y AÑADE a src/config/actas.json (sin duplicar) el
 * contenido NUEVO del canal:
 *   · TEXTO  → clasifica en "acta" (asamblea de un centro) o "grupo" (Resumen Grupo
 *              Enfadados con Airbus) y lo publica automáticamente.
 *   · PDF    → se clasifica por su nombre:
 *              - ACTA / MINUTA (asamblea) → se EXTRAE el texto (pdf-parse) y se publica
 *                como texto, igual que las minutas de Getafe convertidas a mano.
 *              - COMUNICADO / OTROS → se descarga a public/docs/, se le borran los
 *                metadatos de autoría y se publica como tarjeta de descarga.
 *              ⚠️ AUTOMÁTICO por decisión expresa de la coordinación: cualquier PDF del canal
 *              aparece en la web sin revisión previa. Necesita la dependencia `pdf-parse`
 *              (devDependency); si falta, las actas-PDF caen a descarga en vez de romperse.
 *
 * ⚠️ Un bot NO puede leer el historial: solo mensajes publicados DESPUÉS de añadirlo
 *    como administrador del canal. El histórico lo trajo el userbot (backfill).
 *
 * ⚠️ El token del bot es un secreto. Se lee de la variable de entorno TG_BOT_TOKEN.
 *    NO lo pongas en el repo. En GitHub Actions va como Secret (ver ACTAS-README.md).
 *
 * USO:
 *    set TG_BOT_TOKEN=123456:ABC...   (cmd)   ·   $env:TG_BOT_TOKEN=...   (PowerShell)
 *    node scripts/bot-actas.mjs
 *
 * Detección idéntica a src/lib/actas-source.ts (mantener en sync si cambia una).
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { limpiarMetadatos } from "./lib-documentos.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(DIR, "..", "src", "config", "actas.json");
const DOCS = join(DIR, "..", "public", "docs"); // aquí se guardan los PDF descargados
const OFFSET_FILE = join(DIR, "actas-offset.json"); // gitignored: estado de getUpdates

const SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"];
const ALIAS = { "Puerto Real": "Cádiz" };
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const primera = (t) => t.split(/\r?\n/)[0] ?? "";
// El marcador debe ir AL PRINCIPIO de la primera línea (no en mitad de una frase) y el
// mensaje ha de ser largo: así se descartan los mensajes de chat que solo PIDEN el acta
// ("¿podéis poner el resumen?"), que reventaban el detector antiguo.
// ACTA/RESUMEN/MINUTAS [de [la]] ASAMBLEA — cubre "ACTA ASAMBLEA", "RESUMEN DE LA
// ASAMBLEA", "RESUMEN ASAMBLEA", "Resumen asamblea", "Minutas Asamblea"…
const INICIO_ACTA = /^[\W_]*(ACTA|RESUMEN|MINUTAS)\s+(?:DE\s+(?:LA\s+)?)?ASAMBLEA/;
const INICIO_GRUPO = /^[\W_]*RESUMEN\s+GRUPO\s+ENFADADOS\s+CON\s+AIRBUS/;
const esActa = (t) => INICIO_ACTA.test(norm(primera(t))) && t.trim().length >= 300;
const esGrupo = (t) => INICIO_GRUPO.test(norm(primera(t))) && t.trim().length >= 300;
/** "grupo" | "acta" | null — el grupo se comprueba primero (es más específico). */
function clasificar(texto) {
  if (esGrupo(texto)) return "grupo";
  if (esActa(texto)) return "acta";
  return null;
}
function sede(texto) {
  const t = norm(primera(texto)); // el centro va en el título, no en el cuerpo
  for (const s of SITES) if (t.includes(norm(s))) return s;
  for (const [a, s] of Object.entries(ALIAS)) if (t.includes(norm(a))) return s;
  return null;
}
function fecha(texto, fallbackUnix) {
  const dmy = texto.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const t = texto.match(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b/i);
  if (t) { const m = MESES[t[2].toLowerCase()]; if (m) return `${t[3]}-${String(m).padStart(2, "0")}-${t[1].padStart(2, "0")}`; }
  return fallbackUnix ? new Date(fallbackUnix * 1000).toISOString().slice(0, 10) : null;
}
function parseItem(texto, tipo, unix) {
  const limpio = texto.trim();
  const titulo = (limpio.split(/\r?\n/)[0] ?? limpio).trim().replace(/^\*+|\*+$/g, "").slice(0, 160);
  const cuerpo = limpio.slice(limpio.indexOf("\n") + 1).trim() || limpio;
  return { tipo, site: tipo === "acta" ? sede(limpio) : null, fecha: fecha(limpio, unix), titulo, cuerpo };
}

// ── PDF ────────────────────────────────────────────────────────────────────────
/** Tipo de un PDF por su nombre/pie: comunicado · acta · otros. */
function clasificarPdf(nombre, caption) {
  const t = norm(`${nombre} ${caption || ""}`);
  if (/COMUNICADO/.test(t)) return "comunicado";
  if (/\b(ACTA|MINUTA|MINUTAS|ASAMBLEA)\b/.test(t)) return "acta";
  return "otros";
}
/** Título legible: el pie si lo hay; si no, el nombre del archivo formateado. */
function tituloPdf(nombre, caption) {
  if (caption && caption.trim()) return caption.trim().split(/\r?\n/)[0].slice(0, 160);
  return nombre
    .replace(/\.pdf$/i, "")
    .replace(/(\d{1,2})[_-](\d{1,2})[_-](\d{4})/, "$1/$2/$3")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
/** Nombre de archivo seguro para la URL (sin acentos ni espacios). */
function limpiarNombre(nombre) {
  const base = nombre.replace(/\.pdf$/i, "");
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${slug || "documento"}.pdf`;
}
/** Descarga el fichero del bot (getFile + descarga binaria). */
async function descargarPdf(fileId) {
  const gf = await (await fetch(`${API}/getFile?file_id=${fileId}`)).json();
  if (!gf.ok) throw new Error(gf.description || "getFile falló");
  const bin = await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer();
  return Buffer.from(bin);
}

/**
 * Limpia el texto extraído de un PDF de acta (mismo criterio que la conversión a mano de
 * las minutas de Getafe): quita la cabecera, rejunta las líneas partidas, pasa las
 * viñetas "-" a "•" y separa las secciones numeradas.
 */
function limpiarPdf(raw) {
  raw = raw.replace(/^\s*(minutas|acta|resumen)\b[\s\S]*?\d{1,2}[/_-]\d{1,2}[/_-]\d{4}/i, "");
  raw = raw.replace(/-{2,}\s*\d+\s+of\s+\d+\s*-{2,}/gi, "\n"); // separadores de página de pdf-parse
  const out = [];
  for (const ln of raw.split(/\r?\n/)) {
    const s = ln.replace(/[ \t]+/g, " ").trim();
    if (!s) continue;
    const nueva = /^([-•*]|\d+\.|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \d]{6,}:?$)/.test(s);
    if (nueva || out.length === 0) out.push(s);
    else out[out.length - 1] += " " + s;
  }
  let txt = out.join("\n");
  txt = txt.replace(/:\s+-\s+/g, ":\n• ").replace(/^\s*-\s+/gm, "• ").replace(/^(\d+\.\s+)/gm, "\n$1").replace(/\s+([.,;:])/g, "$1");
  return txt.replace(/\n{3,}/g, "\n\n").trim();
}

/** Extrae y limpia el texto de un PDF. Import dinámico: si falta pdf-parse, el llamante
 *  cae a publicar el PDF como descarga en vez de romperse. */
async function pdfATexto(buf) {
  const { PDFParse } = await import("pdf-parse");
  const r = await new PDFParse({ data: new Uint8Array(buf) }).getText();
  return limpiarPdf(r.text || "");
}

const token = process.env.TG_BOT_TOKEN;
if (!token) { console.error("Falta TG_BOT_TOKEN (secreto del bot)."); process.exit(1); }
const API = `https://api.telegram.org/bot${token}`;

const leerOffset = () => { try { return JSON.parse(readFileSync(OFFSET_FILE, "utf8")).offset ?? 0; } catch { return 0; } };
const guardarOffset = (o) => writeFileSync(OFFSET_FILE, JSON.stringify({ offset: o }) + "\n");

try {
  const offset = leerOffset();
  const res = await fetch(`${API}/getUpdates?timeout=0&offset=${offset}&allowed_updates=["channel_post","message"]`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram: ${data.description}`);

  const doc = existsSync(DESTINO) ? JSON.parse(readFileSync(DESTINO, "utf8")) : { ejemplo: false, canal: null, actas: [] };
  if (doc.ejemplo) doc.ejemplo = false; // en cuanto entra una real, deja de ser ejemplo
  // Dedupe por CONTENIDO (los resúmenes tienen títulos genéricos y se reenvían).
  const clave = (a) => (a.cuerpo || a.pdf || a.titulo || "").trim();
  const vistas = new Set(doc.actas.map(clave));

  let ultimo = offset, nuevasTexto = 0, nuevasPdf = 0;
  const pdfsErr = [];
  for (const upd of data.result ?? []) {
    ultimo = Math.max(ultimo, upd.update_id + 1);
    const post = upd.channel_post ?? upd.message;
    if (!post) continue;

    // PDF.
    const docmt = post.document;
    if (docmt && (/pdf/i.test(docmt.mime_type || "") || /\.pdf$/i.test(docmt.file_name || ""))) {
      const nombre = docmt.file_name || `documento-${docmt.file_unique_id}.pdf`;
      const tipo = clasificarPdf(nombre, post.caption);
      const fechaPdf = fecha(`${post.caption || ""} ${nombre.replace(/_/g, "/")}`, post.date);
      let buf;
      try {
        buf = await descargarPdf(docmt.file_id);
      } catch (e) {
        pdfsErr.push(`${nombre}: ${e.message}`);
        continue;
      }

      // Acta en PDF → se CONVIERTE A TEXTO (como las minutas de Getafe a mano).
      if (tipo === "acta") {
        try {
          const cuerpo = await pdfATexto(buf);
          if (cuerpo && cuerpo.length >= 200) {
            const item = { tipo: "acta", site: sede(`${nombre} ${post.caption || ""}`), fecha: fechaPdf, titulo: tituloPdf(nombre, post.caption), cuerpo };
            if (!vistas.has(clave(item))) {
              vistas.add(clave(item));
              doc.actas.push(item);
              nuevasTexto++;
            }
            continue;
          }
        } catch (e) {
          pdfsErr.push(`${nombre} (extracción, se publica como descarga): ${e.message}`);
        }
        // si la extracción falla o sale vacía, cae a descarga (abajo).
      }

      // Comunicado / otros (o acta cuya extracción falló) → tarjeta de descarga.
      const archivo = limpiarNombre(nombre);
      const pdfUrl = `/docs/${archivo}`;
      if (vistas.has(pdfUrl)) continue;
      writeFileSync(join(DOCS, archivo), buf);
      // Este PDF no pasa por `pendientes/`: llega del canal y se escribe ya en público, así
      // que se limpia in situ. Un PDF interno lleva en el campo Autor la matrícula de quien
      // lo generó, y eso dentro de Airbus señala por dónde salió. Lo que no quede limpio no
      // se publica: se borra el fichero y se cuenta en el resumen.
      try {
        if (limpiarMetadatos([join(DOCS, archivo)]).length) {
          rmSync(join(DOCS, archivo), { force: true });
          pdfsErr.push(`${nombre}: conserva metadatos identificativos, no lo publico`);
          continue;
        }
      } catch (e) {
        rmSync(join(DOCS, archivo), { force: true });
        pdfsErr.push(`${nombre}: ${e.message}; no lo publico`);
        continue;
      }
      const item = {
        tipo,
        site: tipo === "acta" ? sede(`${nombre} ${post.caption || ""}`) : null,
        fecha: fechaPdf,
        titulo: tituloPdf(nombre, post.caption),
        cuerpo: "",
        pdf: pdfUrl,
        meta: `PDF · ${Math.round((docmt.file_size || 0) / 1024) || "?"} KB`,
      };
      vistas.add(pdfUrl);
      doc.actas.push(item);
      nuevasPdf++;
      continue;
    }

    const texto = post.text ?? post.caption ?? "";
    if (!texto) continue;
    const tipo = clasificar(texto);
    if (!tipo) continue;
    const item = parseItem(texto, tipo, post.date);
    if (vistas.has(clave(item))) continue;
    vistas.add(clave(item));
    doc.actas.push(item);
    nuevasTexto++;
  }

  if (nuevasTexto + nuevasPdf > 0) {
    doc.actas.sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
    writeFileSync(DESTINO, JSON.stringify(doc, null, 2) + "\n");
  }
  guardarOffset(ultimo);
  console.log(
    `✓ ${nuevasTexto} texto + ${nuevasPdf} PDF nuevos. Total: ${doc.actas.length}. Offset: ${ultimo}.`,
  );
  if (nuevasTexto + nuevasPdf > 0) console.log("  Recuerda: commit + redeploy (o el workflow lo hace).");
  if (pdfsErr.length) {
    console.log(`\n⚠️  ${pdfsErr.length} PDF con error al descargar:`);
    for (const e of pdfsErr) console.log(`     · ${e}`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
