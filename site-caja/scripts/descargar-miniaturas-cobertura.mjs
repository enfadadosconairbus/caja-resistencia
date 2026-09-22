// Descarga y optimiza las carátulas de los cortes de vídeo de YouTube a webp.
// Uso puntual: node scripts/descargar-miniaturas-cobertura.mjs
// Las miniaturas se AUTO-ALOJAN para no llamar a Google hasta que el usuario pulsa play.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(AQUI, "..", "public", "img", "cobertura");

const VIDEOS = [
  { id: "O6v-hwWUPmM", slug: "rtve" },
  { id: "styBBRy8dXE", slug: "efe" },
  { id: "fgulQyNnsMA", slug: "elmundo" },
  { id: "_16yzjww2Q0", slug: "esradio" },
  { id: "NUonq7SJ1Do", slug: "infodefensa" },
  { id: "bxuqKIGXdXA", slug: "elconfidencial" },
  { id: "72asc1-HKdg", slug: "ondacadiz" },
];

async function bajar(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  // YouTube devuelve un placeholder gris de 120x90 cuando la resolución no existe.
  if (buf.length < 2000) return null;
  return buf;
}

await mkdir(OUT, { recursive: true });
for (const v of VIDEOS) {
  const fuente =
    (await bajar(`https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`)) ??
    (await bajar(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`));
  if (!fuente) {
    console.error(`✗ ${v.slug} (${v.id}): sin carátula`);
    continue;
  }
  const dest = path.join(OUT, `${v.slug}.webp`);
  const info = await sharp(fuente)
    .resize({ width: 640, height: 360, fit: "cover", position: "attention" })
    .webp({ quality: 72 })
    .toBuffer();
  await writeFile(dest, info);
  console.log(`✓ ${v.slug}.webp — ${(info.length / 1024).toFixed(1)} KB`);
}
console.log("Hecho.");
