#!/usr/bin/env node
/**
 * Publica las fotos aprobadas para la cronología: las pasa a WebP y las cuelga de su hito.
 *
 * Hermano de `bajar-fotos.py`, que solo las trae del canal a `scripts/fotos-revision/`. Aquél
 * baja, éste publica: son dos pasos a propósito, porque en medio hay una decisión humana.
 *
 * ⚠️ Este script NO decide qué se publica. Convierte lo que ya está en `fotos-elegidas/`,
 * carpeta que se rellena a mano después de mirar las fotos una a una. El criterio acordado con
 * Carlos (10-ago-2026) es publicar solo planos donde no se reconozca a nadie —son trabajadores
 * identificables en un conflicto laboral abierto—, con la única excepción registrada en
 * `CLIENTE.md` §7. Tampoco decide DÓNDE va cada una: eso está en `fotos-cronologia.json`,
 * validado por Carlos, y aquí solo se ejecuta.
 *
 * El ancho de salida (1400 px) es el que necesita la ficha abierta del sendero —384 px— servida
 * a 3× en pantallas densas, con margen para el raíl de móvil a pantalla completa. Más allá solo
 * se engorda la descarga.
 *
 *   node scripts/fotos-cronologia.mjs --lista   # qué haría, sin tocar nada
 *   node scripts/fotos-cronologia.mjs           # convierte y escribe en hitos.json
 *   node scripts/fotos-cronologia.mjs --check   # ¿falta en public/img alguna foto citada?
 */
import { readdir, mkdir, stat, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BASE = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(BASE, "fotos-elegidas");
const DESTINO = path.join(BASE, "..", "public", "img");
const HITOS = path.join(BASE, "..", "src", "config", "hitos.json");
const MAPA = path.join(BASE, "fotos-cronologia.json");
const ANCHO_MAX = 1400;
const CALIDAD = 78;

const rel = (p) => path.relative(process.cwd(), p);
const modo = process.argv.includes("--check") ? "check" : process.argv.includes("--lista") ? "lista" : "publicar";

/**
 * Nombre de fichero → clave del mapa, y de paso nombre del WebP publicado.
 *
 * Las fotos llegan del móvil o del grupo con el nombre que traigan —«Asamblea Getafe.jpeg»,
 * con mayúsculas, espacios y a veces acentos—, y nadie tiene por qué acordarse de renombrarlas
 * a mano. Aquí se normaliza: minúsculas, sin acentos y con guiones. Además el resultado es el
 * nombre del fichero servido, y un espacio en una URL es un `%20` que no quiere nadie.
 */
const clavear = (nombre) =>
  path
    .parse(nombre)
    .name.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const { fotos } = JSON.parse(await readFile(MAPA, "utf8"));
const hitos = JSON.parse(await readFile(HITOS, "utf8"));

/**
 * Localiza el hito destino. Se busca por fecha **y** por título porque hay seis fechas
 * repetidas en la cronología: con la fecha sola, una foto de la marcha de Getafe podía acabar
 * colgada de «CCOO anuncia un acuerdo propio», que es del mismo día y cuenta lo contrario.
 */
function buscarHito(dest) {
  const cand = hitos.hitos.filter(
    (h) => h.fecha === dest.fecha && h.titulo.es.toLowerCase().includes(dest.titulo.toLowerCase()),
  );
  if (cand.length !== 1) {
    throw new Error(
      `el destino {${dest.fecha} · "${dest.titulo}"} casa con ${cand.length} hitos; ` +
        `debe casar con exactamente uno (revisa scripts/fotos-cronologia.json)`,
    );
  }
  return cand[0];
}

// ── --check: ¿está publicado todo lo que hitos.json cita? ─────────────────────
if (modo === "check") {
  const citadas = hitos.hitos.filter((h) => h.imagen).map((h) => h.imagen.src);
  const faltan = citadas.filter((src) => !existsSync(path.join(DESTINO, "..", src.replace(/^\//, ""))));
  for (const src of citadas) console.log(`${faltan.includes(src) ? "✗ FALTA" : "✓"}  ${src}`);
  if (faltan.length) {
    console.error(`\n${faltan.length} foto(s) citada(s) en hitos.json que no están en public/img.`);
    console.error("La web las pediría y daría 404. Deja los originales en");
    console.error(`${rel(ORIGEN)} y vuelve a ejecutar sin --check.`);
    process.exit(1);
  }
  console.log(`\n✓ Las ${citadas.length} foto(s) de la cronología están publicadas.`);
  process.exit(0);
}

// ── --lista y publicar ────────────────────────────────────────────────────────
if (!existsSync(ORIGEN)) {
  console.error(`No existe ${rel(ORIGEN)}.`);
  console.error("Créala y deja dentro las fotos aprobadas, nombradas como las claves de");
  console.error(`${rel(MAPA)}:  ${Object.keys(fotos).join(", ")}`);
  process.exit(1);
}

await mkdir(DESTINO, { recursive: true });

const fuentes = (await readdir(ORIGEN)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
if (!fuentes.length) {
  console.error(`No hay imágenes en ${rel(ORIGEN)}.`);
  process.exit(1);
}

let colocadas = 0;
const sinDestino = [];

for (const nombre of fuentes) {
  const clave = clavear(nombre);
  const dest = fotos[clave];
  const entrada = path.join(ORIGEN, nombre);
  const salidaRel = `/img/${clave}.webp`;
  const meta = await sharp(entrada).metadata();

  if (!dest) {
    // No se aborta: puede haber originales sueltos en la carpeta. Pero se dice, porque una
    // foto convertida y no colocada no aparece en ninguna parte de la web.
    sinDestino.push(nombre);
  }

  if (modo === "lista") {
    const d = dest ? `${dest.hito.fecha} · ${dest.hito.titulo}` : "SIN DESTINO en fotos-cronologia.json";
    console.log(`${nombre}  ${meta.width}×${meta.height}  →  ${salidaRel}\n    ${d}`);
    continue;
  }

  // Las medidas se toman de lo que ESCRIBE sharp, no de la entrada: entre medias hay un
  // `rotate()` que puede intercambiar alto y ancho, y un `resize()` que los baja. Son las que
  // van a `hitos.json` para que la ficha reserve el hueco exacto y no dé un salto al cargar.
  const salida = await sharp(entrada)
    .rotate() // respeta el EXIF antes de tirarlo: si no, las verticales salen tumbadas
    // `withoutEnlargement`: una foto que ya venga pequeña no se estira para llegar a 1400,
    // solo se convierte. Estirarla no añade detalle, añade peso.
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .webp({ quality: CALIDAD })
    .toFile(path.join(DESTINO, `${clave}.webp`));

  const { size } = await stat(path.join(DESTINO, `${clave}.webp`));
  const orientacion = salida.height > salida.width ? "vertical" : "apaisada";
  console.log(
    `✓ ${salidaRel}  ${salida.width}×${salida.height} ${orientacion}  ${Math.round(size / 1024)} kB` +
      (meta.width && meta.width > ANCHO_MAX ? `  (de ${meta.width}×${meta.height})` : ""),
  );

  if (dest) {
    const hito = buscarHito(dest.hito);
    hito.imagen = {
      src: salidaRel,
      w: salida.width,
      h: salida.height,
      alt: dest.alt,
      ...(dest.pie ? { pie: dest.pie } : {}),
    };
    console.log(`    → ${hito.fecha} · ${hito.titulo.es}`);
    colocadas++;
  }
}

if (modo === "publicar" && colocadas) {
  await writeFile(HITOS, JSON.stringify(hitos, null, 2) + "\n", "utf8");
  console.log(`\n✓ ${colocadas} foto(s) colgadas de su hito en ${rel(HITOS)}.`);
}

// Una foto convertida y no colocada no sale en ninguna parte de la web. Antes esto era un
// aviso con salida 0 y se colaba entre el ruido del terminal: cuatro fotos convertidas, cero
// publicadas, y el script diciendo que todo bien. Ahora falla.
if (sinDestino.length) {
  console.error(`\n✗ Sin destino en ${rel(MAPA)}, así que NO aparecen en la web:`);
  for (const n of sinDestino) console.error(`    ${n}  (clave buscada: "${clavear(n)}")`);
  console.error(`\n  Claves disponibles: ${Object.keys(fotos).join(", ")}`);
  process.exit(1);
}
