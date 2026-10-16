#!/usr/bin/env node
/**
 * Prepara el modelo del huelguista para la web, sin Blender.
 *
 *   node scripts/preparar-huelguista.mjs
 *
 * Entrada: los `.glb` de `../huelguista/meshy/`, tal como salen de Meshy (plan gratis, Meshy 6
 * Lite, rig humanoide con plantilla Mixamo). Todos traen la MISMA malla y esqueleto y una
 * animación distinta cada uno; de la malla se usa la del primero y de las animaciones, las de
 * `ANIMACIONES`. Salida en `public/huelguista/`: un `.gltf` con la malla en `huelguista.bin` y la
 * textura en `huelguista.webp`, SEPARADOS a propósito: dentro de un `.glb`, GLTFLoader lee la
 * textura creando una URL `blob:`, y la CSP de la web (sin `blob:` en `connect-src`) la bloquea
 * en silencio: el modelo sale blanco.
 *
 * Lo que hace, y por qué:
 *  1. Animaciones: se queda solo con las de `ANIMACIONES` (el baile) y solo con los huesos del
 *     cuerpo (sin dedos). El resto del movimiento lo pone `cuerpo.ts` (IK, muelles, vida).
 *  2. Devuelve cada hueso a su pose de REPOSO, calculada con las matrices de bind. El archivo
 *     trae guardado un fotograma de su animación y el retargeting necesita la pose de pesado.
 *  3. Deja 4 influencias por vértice (las de más peso, renormalizadas). Meshy exporta 8 y
 *     three.js solo lee 4: las otras 4 se ignorarían y la malla se rompería en codos y hombros.
 *  4. SOMBRERO con hueso propio: en el modelo va pegado a la cabeza. Sus vértices (los de color
 *     mostaza por encima de la frente) pasan a un hueso nuevo, `Sombrero`, para que la ráfaga
 *     pueda levantarlo.
 *  5. CARA: borra de la textura los ojos y la boca pintados (y una mancha amarilla de la nariz).
 *     En la web los pone `cuerpo.ts` con geometría, que es lo que permite parpadear, mirar y
 *     cambiar de expresión.
 *  6. Simplifica la malla a ~18.000 triángulos: sale con ~79.000 y el presupuesto es de 500 KB.
 *  7. Textura a 1024 px en WebP (2048 en JPEG pesa 1,5 MB y a 200 px de alto no se nota).
 *  8. Cuantiza y comprime con meshopt (three.js lo descomprime con `MeshoptDecoder`).
 *
 * Las coordenadas de la cara y del sombrero están MEDIDAS sobre este modelo (30-sep-2026). Si se
 * regenera el personaje en Meshy, hay que volver a medirlas.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, resample, simplify, weld } from "@gltf-transform/functions";
import { createRequire } from "node:module";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

// Una sola sharp en el proceso: la que ya carga gltf-transform (vía ndarray-pixels). Si además
// se importa la del proyecto (otra versión), las dos libvips chocan y sharp falla con
// "colourspace: parameter space not set".
const sharp = createRequire(createRequire(import.meta.url).resolve("ndarray-pixels"))("sharp");

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA_MESHY = join(SITE, "..", "huelguista", "meshy");
const SALIDA = join(SITE, "public", "huelguista", "huelguista.gltf");
const TRIANGULOS = 12000;

/**
 * Animaciones de Meshy que se conservan → nombre con el que las busca `cuerpo.ts`.
 * `desde`/`hasta` (segundos) recortan el clip: el de asentir dura 13 s de gesticulación
 * seguida, que en una esquina de la web se hace eterno, y arranca y acaba casi parado.
 */
const ANIMACIONES = {
  Boom_Dance: { nombre: "baile" },
  Walking: { nombre: "andar" },
  Agree_Gesture: { nombre: "asentir", desde: 1.1, hasta: 7.4 },
};
/** Huesos que NO se animan: dedos y puntas. A 200 px de alto no se ven y pesan la mitad del clip. */
const SIN_ANIMAR = /Hand(Thumb|Index|Middle|Ring|Pinky)|_End$|headfront/;

/**
 * Cara, medida en la proyección frontal del modelo en reposo (metros).
 *
 * No se borran regiones dibujadas a mano sino TODO LO QUE NO ES PIEL dentro de la ventana de la
 * cara: ojos, boca, la sombra bajo la nariz y cualquier mota. Las elipses se quedaban cortas
 * —la boca sobrevivía— y además obligaban a medir cada rasgo.
 */
const CARA = {
  // Ventana frontal: media anchura en x, alto, y z mínima (descarta lo que se ve de perfil).
  ventana: { x: 0.076, y0: 1.353, y1: 1.505, zMin: 0.085 },
  // De dónde se toma el color de la piel: las mejillas.
  piel: [
    [-0.08, -0.045, 1.4, 1.44],
    [0.045, 0.08, 1.4, 1.44],
  ],
  /** Distancia de color (suma de |Δ| en RGB) a partir de la cual un téxel se considera pintado. */
  umbral: 36,
};
/** Sombrero: todo lo mostaza por encima de esta altura. El hueso pivota en la base de la copa. */
const SOMBRERO = { yMin: 1.47, pivote: [0, 1.5, -0.03] };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
// Solo entran los .glb cuya animación usamos: un fichero suelto en la carpeta (una animación
// que todavía no se ha dado de alta en ANIMACIONES) se ignora del todo. Si no, bastaría con que
// se ordenase antes para que la malla saliera de él y el resultado cambiase sin que nadie lo pida.
const docs = [];
for (const f of readdirSync(CARPETA_MESHY).filter((f) => f.endsWith(".glb")).sort()) {
  const d = await io.read(join(CARPETA_MESHY, f));
  if (d.getRoot().listAnimations().some((a) => ANIMACIONES[a.getName()])) docs.push([f, d]);
  else console.log(`· ignorado (su animación no está en ANIMACIONES): ${f}`);
}
if (!docs.length) throw new Error("Ningún .glb de huelguista/meshy/ trae una animación de ANIMACIONES.");
// De qué fichero sale la MALLA. Todos traen la misma, pero no con los mismos índices ni el mismo
// orden de vértices, y meshopt comprime MUY distinto según cuál: medido con los tres clips
// puestos, el modelo sale en 466 KB con el de andar, 573 con el del baile y 681 con el de
// asentir. Se fija a mano; dejarlo al orden alfabético hacía que el peso cambiara solo con
// añadir un fichero. Para volver a medir: HUELGUISTA_MALLA=<fichero> node scripts/preparar-huelguista.mjs
const MALLA_DE = process.env.HUELGUISTA_MALLA ?? "Meshy_AI_Sunny_Explorer_Walking.glb";
const iBase = Math.max(0, docs.findIndex(([f]) => f === MALLA_DE));
if (iBase > 0) docs.unshift(...docs.splice(iBase, 1));
const [nombreBase, doc] = docs[0];
const root = doc.getRoot();
console.log(`· malla de: ${nombreBase} (${(statSync(join(CARPETA_MESHY, nombreBase)).size / 1e6).toFixed(2)} MB)`);

// Todos los .glb de Meshy traen la MISMA malla y el mismo esqueleto; solo cambia la animación.
// La malla se toma del primero por orden alfabético, así que si algún día no coinciden hay que
// enterarse aquí y no al ver un personaje raro en la web.
{
  const huella = (d) => {
    const p = d.getRoot().listMeshes()[0].listPrimitives()[0];
    return `${p.getAttribute("POSITION").getCount()}v/${p.getIndices().getCount() / 3}t/${d.getRoot().listSkins()[0].listJoints().length}j`;
  };
  const base = huella(doc);
  for (const [f, d] of docs.slice(1)) {
    if (huella(d) !== base) {
      throw new Error(`${f} no comparte malla con ${nombreBase} (${huella(d)} vs ${base}). ` + "Los .glb de la carpeta deben ser el mismo personaje con animaciones distintas.");
    }
  }
}

// ── 1. Animaciones: a datos planos, y fuera de los documentos ─────────────────────────────
const clips = [];
for (const [f, d] of docs) {
  for (const a of d.getRoot().listAnimations()) {
    const cfg = ANIMACIONES[a.getName()];
    if (!cfg) continue;
    const { nombre, desde = 0, hasta = Infinity } = cfg;
    const canales = [];
    for (const c of a.listChannels()) {
      const hueso = c.getTargetNode().getName();
      const ruta = c.getTargetPath();
      if (SIN_ANIMAR.test(hueso)) continue;
      // La traslación solo importa en la cadera: en los demás huesos es la longitud del hueso.
      if (ruta === "translation" && !hueso.endsWith("Hips")) continue;
      if (ruta === "scale") continue;
      const s = c.getSampler();
      const t = s.getInput().getArray();
      const v = s.getOutput().getArray();
      const paso = v.length / t.length; // 4 en rotación, 3 en traslación
      const dentro = [];
      for (let i = 0; i < t.length; i++) if (t[i] >= desde && t[i] <= hasta) dentro.push(i);
      canales.push({
        hueso,
        ruta,
        tiempos: Float32Array.from(dentro, (i) => t[i] - t[dentro[0]]),
        valores: Float32Array.from({ length: dentro.length * paso }, (_, k) => v[dentro[Math.floor(k / paso)] * paso + (k % paso)]),
        tipo: s.getOutput().getType(),
      });
    }
    const dur = canales[0].tiempos[canales[0].tiempos.length - 1];
    clips.push({ nombre, canales });
    console.log(`· animación: ${a.getName()} (${f}) → "${nombre}", ${canales.length} canales, ${dur.toFixed(2)}s`);
  }
}
for (const a of root.listAnimations()) a.dispose();

// ── 2. Pose de reposo desde las matrices de bind ──────────────────────────────────────────
// Álgebra mínima de matrices 4×4 en orden de columnas (el de glTF).
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const inv = (m) => {
  // Afín (sin proyección): inversa de la 3×3 y de la traslación.
  const [a, b, c, , d, e, f, , g, h, i, , x, y, z] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const r = [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det, 0,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det, 0,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det, 0,
  ];
  return [...r, -(r[0] * x + r[4] * y + r[8] * z), -(r[1] * x + r[5] * y + r[9] * z), -(r[2] * x + r[6] * y + r[10] * z), 1];
};
const aTRS = (m) => {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const [m00, m10, m20] = [m[0] / sx, m[1] / sx, m[2] / sx];
  const [m01, m11, m21] = [m[4] / sy, m[5] / sy, m[6] / sy];
  const [m02, m12, m22] = [m[8] / sz, m[9] / sz, m[10] / sz];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return { t: [m[12], m[13], m[14]], q, s: [sx, sy, sz] };
};
const traslacion = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const skin = root.listSkins()[0];
const joints = skin.listJoints();
const ibm = skin.getInverseBindMatrices().getArray();
const mundo = new Map(joints.map((j, k) => [j, inv(Array.from(ibm.slice(k * 16, k * 16 + 16)))]));
const padreDe = new Map();
for (const n of root.listNodes()) for (const c of n.listChildren()) padreDe.set(c, n);
for (const j of joints) {
  const p = padreDe.get(j);
  const local = mundo.has(p) ? mul(inv(mundo.get(p)), mundo.get(j)) : mundo.get(j);
  const { t, q, s } = aTRS(local);
  j.setTranslation(t).setRotation(q).setScale(s);
}

// ── 3. Cuatro influencias por vértice ─────────────────────────────────────────────────────
const prim = root.listMeshes()[0].listPrimitives()[0];
{
  const J0 = prim.getAttribute("JOINTS_0"), J1 = prim.getAttribute("JOINTS_1");
  const W0 = prim.getAttribute("WEIGHTS_0"), W1 = prim.getAttribute("WEIGHTS_1");
  const n = J0.getCount();
  const jo = new Uint16Array(n * 4), we = new Float32Array(n * 4);
  const a = [], b = [0, 0, 0, 0], c = [], d = [0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    J0.getElement(v, a); W0.getElement(v, c);
    if (J1 && W1) { J1.getElement(v, b); W1.getElement(v, d); }
    const pares = [...a.map((j, k) => [j, c[k]]), ...b.map((j, k) => [j, d[k]])].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const suma = pares.reduce((s, [, w]) => s + w, 0) || 1;
    pares.forEach(([j, w], k) => {
      jo[v * 4 + k] = j;
      we[v * 4 + k] = w / suma;
    });
  }
  J0.setArray(jo);
  W0.setArray(we);
  if (J1 && W1) {
    prim.setAttribute("JOINTS_1", null).setAttribute("WEIGHTS_1", null);
    J1.dispose();
    W1.dispose();
  }
}

// ── Textura en crudo: la usan el sombrero (clasificar por color) y la cara (borrar) ───────
const textura = root.listTextures()[0];
const cruda = await sharp(Buffer.from(textura.getImage())).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
const TW = cruda.info.width, TH = cruda.info.height, px = cruda.data;
const POS = prim.getAttribute("POSITION").getArray();
const UV = prim.getAttribute("TEXCOORD_0").getArray();
const IDX = prim.getIndices().getArray();
const texel = (u, v) => (Math.min(TH - 1, Math.max(0, Math.round(v * TH))) * TW + Math.min(TW - 1, Math.max(0, Math.round(u * TW)))) * 3;
const esMostaza = (r, g, b) => r > 150 && g > 105 && b < 95 && r - b > 90 && r > g;

// ── 4. Sombrero con hueso propio ──────────────────────────────────────────────────────────
{
  const cabeza = joints.find((j) => j.getName().endsWith("Head"));
  const local = mul(inv(mundo.get(cabeza)), traslacion(...SOMBRERO.pivote));
  const { t, q, s } = aTRS(local);
  const hueso = doc.createNode("Sombrero").setTranslation(t).setRotation(q).setScale(s);
  cabeza.addChild(hueso);
  skin.addJoint(hueso);
  const nuevas = new Float32Array(ibm.length + 16);
  nuevas.set(ibm);
  nuevas.set(traslacion(...SOMBRERO.pivote.map((v) => -v)), ibm.length);
  skin.getInverseBindMatrices().setArray(nuevas);
  const indice = joints.length; // el último
  const J = prim.getAttribute("JOINTS_0"), W = prim.getAttribute("WEIGHTS_0");
  const jo = J.getArray(), we = W.getArray();
  let n = 0;
  for (let v = 0; v < POS.length / 3; v++) {
    if (POS[v * 3 + 1] < SOMBRERO.yMin) continue;
    const o = texel(UV[v * 2], UV[v * 2 + 1]);
    if (!esMostaza(px[o], px[o + 1], px[o + 2])) continue;
    jo.set([indice, 0, 0, 0], v * 4);
    we.set([1, 0, 0, 0], v * 4);
    n++;
  }
  J.setArray(jo);
  W.setArray(we);
  console.log(`· sombrero: ${n} vértices pasan al hueso "Sombrero"`);
}

// ── 5. Cara: fuera los ojos y la boca pintados ────────────────────────────────────────────
{
  // Proyección frontal de la cabeza: para cada píxel, qué texel de la textura se ve ahí.
  const X0 = -0.11, X1 = 0.11, Y0 = 1.35, Y1 = 1.51, ESC = 8000;
  const W = Math.round((X1 - X0) * ESC), H = Math.round((Y1 - Y0) * ESC);
  const zb = new Float32Array(W * H).fill(-1e9);
  const tu = new Float32Array(W * H), tv = new Float32Array(W * H);
  for (let t = 0; t < IDX.length; t += 3) {
    const [a, b, c] = [IDX[t], IDX[t + 1], IDX[t + 2]];
    const ys = [POS[a * 3 + 1], POS[b * 3 + 1], POS[c * 3 + 1]];
    if (Math.max(...ys) < Y0 || Math.min(...ys) > Y1) continue;
    const p = [a, b, c].map((i) => [(POS[i * 3] - X0) * ESC, (Y1 - POS[i * 3 + 1]) * ESC, POS[i * 3 + 2], UV[i * 2], UV[i * 2 + 1]]);
    const det = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
    if (Math.abs(det) < 1e-9) continue;
    const xs = p.map((q) => q[0]), yy = p.map((q) => q[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...yy))); y <= Math.min(H - 1, Math.ceil(Math.max(...yy))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
        const l1 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / det;
        const l2 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -0.001 || l2 < -0.001 || l3 < -0.001) continue;
        const z = l1 * p[0][2] + l2 * p[1][2] + l3 * p[2][2];
        const k = y * W + x;
        if (z <= zb[k]) continue;
        zb[k] = z;
        tu[k] = l1 * p[0][3] + l2 * p[1][3] + l3 * p[2][3];
        tv[k] = l1 * p[0][4] + l2 * p[1][4] + l3 * p[2][4];
      }
    }
  }
  const aPx = (x, y) => [Math.round((x - X0) * ESC), Math.round((Y1 - y) * ESC)];
  // Color de la piel: mediana de las mejillas.
  const muestras = [[], [], []];
  for (const [xa, xb, ya, yb] of CARA.piel) {
    const [x0, y1] = aPx(xa, ya), [x1, y0] = aPx(xb, yb);
    for (let y = y0; y <= y1; y += 3) for (let x = x0; x <= x1; x += 3) {
      const k = y * W + x;
      if (zb[k] < -1e8) continue;
      const o = texel(tu[k], tv[k]);
      for (let ch = 0; ch < 3; ch++) muestras[ch].push(px[o + ch]);
    }
  }
  const piel = muestras.map((m) => m.sort((a, b) => a - b)[m.length >> 1]);
  const pielHex = "#" + piel.map((v) => v.toString(16).padStart(2, "0")).join("");
  // Barrido de la ventana de la cara: lo que se aparta del tono de piel, se repinta de piel.
  // Pincel de 2 téxeles (5×5): tapa los huecos del muestreo sin invadir las islas vecinas.
  const { ventana } = CARA;
  const [vx0, vy0] = aPx(-ventana.x, ventana.y1), [vx1, vy1] = aPx(ventana.x, ventana.y0);
  const tocado = new Uint8Array(TW * TH);
  let pintados = 0;
  for (let y = Math.max(0, vy0); y <= Math.min(H - 1, vy1); y++) {
    for (let x = Math.max(0, vx0); x <= Math.min(W - 1, vx1); x++) {
      const k = y * W + x;
      if (zb[k] < ventana.zMin) continue; // nada delante, o se ve de perfil
      const o0 = texel(tu[k], tv[k]);
      if (esMostaza(px[o0], px[o0 + 1], px[o0 + 2])) continue; // el ala del sombrero
      const d = Math.abs(px[o0] - piel[0]) + Math.abs(px[o0 + 1] - piel[1]) + Math.abs(px[o0 + 2] - piel[2]);
      if (d < CARA.umbral) continue;
      const u = Math.round(tu[k] * TW), v = Math.round(tv[k] * TH);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = u + dx, yy = v + dy;
        if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue;
        const o = (yy * TW + xx) * 3;
        if (tocado[yy * TW + xx]) continue;
        if (esMostaza(px[o], px[o + 1], px[o + 2])) continue;
        tocado[yy * TW + xx] = 1;
        px[o] = piel[0]; px[o + 1] = piel[1]; px[o + 2] = piel[2];
        pintados++;
      }
    }
  }
  root.getDefaultScene()?.setExtras({ piel: pielHex });
  console.log(`· cara: ${pintados} téxeles repintados de piel ${pielHex}`);
}

// ── 6–8. Animaciones de vuelta, simplificar, textura, comprimir ───────────────────────────
const nodoPorNombre = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buffer = root.listBuffers()[0];
for (const clip of clips) {
  const anim = doc.createAnimation(clip.nombre);
  for (const c of clip.canales) {
    const nodo = nodoPorNombre.get(c.hueso);
    if (!nodo) continue;
    const entrada = doc.createAccessor().setArray(c.tiempos).setType("SCALAR").setBuffer(buffer);
    const salida = doc.createAccessor().setArray(c.valores).setType(c.tipo).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(entrada).setOutput(salida).setInterpolation("LINEAR");
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodo).setTargetPath(c.ruta).setSampler(sampler));
  }
}

const trisAntes = prim.getIndices().getCount() / 3;
doc.createExtension(EXTTextureWebP).setRequired(true);
const webp = await sharp(px, { raw: { width: TW, height: TH, channels: 3 } }).resize(1024, 1024).webp({ quality: 82 }).toBuffer();
textura.setImage(new Uint8Array(webp)).setMimeType("image/webp").setURI("huelguista.webp");
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGULOS / trisAntes, error: 0.01 }),
  resample({ tolerance: 1e-3 }),
  prune(),
  dedup(),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
const trisDespues = root.listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;

for (const b of root.listBuffers()) b.setURI("huelguista.bin");
await io.write(SALIDA, doc);
const kb = ["huelguista.gltf", "huelguista.bin", "huelguista.webp"]
  .map((f) => statSync(join(dirname(SALIDA), f)).size)
  .reduce((a, b) => a + b, 0) / 1024;
console.log(`· triángulos: ${trisAntes} → ${trisDespues}`);
console.log(`· salida: public/huelguista/huelguista.{gltf,bin,webp} (${kb.toFixed(0)} KB en total)`);

// ── Medidas del esqueleto en reposo (referencia; `cuerpo.ts` las calcula al cargar) ───────
const pos = (nombre) => {
  const j = joints.find((x) => x.getName() === `mixamorig:${nombre}`);
  const m = mundo.get(j);
  return [m[12], m[13], m[14]].map((v) => +v.toFixed(4));
};
const nombres = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "HeadTop_End", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandMiddle1", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot"];
writeFileSync(join(CARPETA_MESHY, "medidas-reposo.json"), JSON.stringify(Object.fromEntries(nombres.map((n) => [n, pos(n)])), null, 1) + "\n");
console.log("· medidas en reposo → huelguista/meshy/medidas-reposo.json");
