#!/usr/bin/env node
/**
 * Despliegue en Cloudflare SIN tocar los dominios: `wrangler versions upload` + `versions deploy`.
 *
 *   npm run deploy:vinext            (después de `npm run build:vinext`)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  POR QUÉ NO `wrangler deploy`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `wrangler deploy` sube la versión y, en el mismo paso, VUELVE A APLICAR los triggers: los dos
 * dominios propios (`cajaderesistencia-asi-no.org` y `www.`) y workers.dev. Esta vía cambia de
 * versión y deja los dominios como estaban ("No non-versioned settings to sync"), y solo necesita
 * el permiso Workers Scripts:Edit, el mismo que ya tiene el token de la acción de GitHub.
 *
 * OJO — NO elimina los 503 del cambio de versión. Sonda cada 0,3 s, 30-sep-2026:
 *
 *   wrangler deploy (mismo build)      → 2 × 503 en el dominio propio, 0 en workers.dev
 *   versions (mismo build)             → 0 × 503
 *   versions (modelo del huelguista)   → 10 × 503 en ~11 s, dominio propio, solo sin caché
 *
 * Patrón con los tres: solo por el dominio propio, al entrar la versión nueva, sobre todo en
 * peticiones que no están en caché, entre 0,5 y 11 s. Causa abierta (sospecha: la caché de Workers,
 * `"cache": { "enabled": true }`). Se mantiene esta vía porque no toca los dominios, no porque arregle
 * el corte.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  CUÁNDO HACE FALTA EL DESPLIEGUE COMPLETO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Si cambian en `wrangler.jsonc` las `routes` (dominios), `workers_dev`, o se añade una
 * migración de Durable Objects, esta vía NO lo aplica (o wrangler se niega). Entonces, una vez:
 *
 *   npm run deploy:vinext:completo   (acepta el parpadeo de 503 de unos segundos)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  LO QUE NO HACE: CONSTRUIR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sube lo que haya en `dist/`. Por eso se niega si algo de `src/`, `public/` o la config es más
 * nuevo que el build: desplegar un `dist/` viejo "funciona" en silencio y la web se queda como
 * estaba (el fallo que ya documenta `publicar-indice.mjs`).
 */
import { spawnSync } from "node:child_process";
import { setTimeout as dormir } from "node:timers/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(SITE, "dist", "server", "wrangler.json");

const salir = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!existsSync(CONFIG)) salir("No hay build: falta dist/server/wrangler.json. Ejecuta antes `npm run build:vinext`.");

// ¿El build es posterior a todo lo que lo alimenta?
const hechoEn = statSync(CONFIG).mtimeMs;
const masNuevo = (ruta) => {
  if (!existsSync(ruta)) return null;
  const st = statSync(ruta);
  if (st.isFile()) return st.mtimeMs > hechoEn ? ruta : null;
  for (const e of readdirSync(ruta, { withFileTypes: true })) {
    const r = masNuevo(join(ruta, e.name));
    if (r) return r;
  }
  return null;
};
const viejo = ["src", "public", "worker", "wrangler.jsonc", "vite.config.ts", "package.json"]
  .map((p) => masNuevo(join(SITE, p)))
  .find(Boolean);
if (viejo) salir(`El build es anterior a ${viejo.slice(SITE.length + 1)}. Ejecuta antes \`npm run build:vinext\`.`);

// `shell: true` NO entrecomilla los argumentos, y cmd.exe se atraganta con los parentesis y los
// espacios: el mensaje "deploy:vinext (reparto)" tumbaba el reparto de trafico sin decir por que.
const entrecomillar = (a) => (/^[\w@%.:/\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

const wrangler = (args, callado = false) => {
  const r = spawnSync("npx", ["wrangler", ...args, "--config", CONFIG].map(entrecomillar), {
    cwd: SITE,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (!callado) process.stdout.write(salida);
  return { ok: r.status === 0, salida };
};

console.log("· Subiendo la versión (sin activarla todavía)…");
const subida = wrangler(["versions", "upload", "--message", "deploy:vinext"]);
const id = subida.salida.match(/Worker Version ID:\s*([0-9a-f-]{36})/i)?.[1];
if (!subida.ok || !id) {
  salir(
    "La subida falló. Si el cambio toca rutas, dominios, workers_dev o una migración de Durable " +
      "Objects, esta vía no sirve: usa `npm run deploy:vinext:completo`.",
  );
}

// ── Activación en dos tiempos ───────────────────────────────────────────────────
//
// Primero un porcentaje pequeño y, tras unos segundos, el 100 %. Dos motivos:
//
//  1. LOS 503 AL PUBLICAR. Al entrar una versión nueva, el borde de Cloudflare devuelve 503
//     vacíos durante unos segundos, y lo hace ANTES de invocar el Worker (capturado con
//     `wrangler tail`: 39 × 503 y cero errores en el registro).
//     ⚠ NO está demostrado que esto lo arregle: dos despliegues así dieron 1 y 189 × 503, y los
//     directos 39 y 41. Lo único firme es que desplegar sí los provoca (la sonda sola, sin
//     desplegar: 0 de 1.744). Ver DEPLOY-CLOUDFLARE.md.
//  2. De regalo, un canario: si la versión nueva estuviera rota, solo la ve ese porcentaje
//     durante la espera.
//
// `DESPLIEGUE_DIRECTO=1` salta el primer tramo; `DESPLIEGUE_RAMPA` y `DESPLIEGUE_ESPERA` lo afinan.
const RAMPA = Number(process.env.DESPLIEGUE_RAMPA ?? 10);
const ESPERA = Number(process.env.DESPLIEGUE_ESPERA ?? 12);

/** La versión que sirve el 100 % del tráfico ahora mismo, si es una sola. */
const versionActual = () => {
  const { salida } = wrangler(["deployments", "status"], true);
  const al100 = [...salida.matchAll(/\((\d+)%\)\s*([0-9a-f-]{36})/g)].filter((m) => m[1] === "100");
  return al100.length === 1 ? al100[0][2] : null;
};

const activarAl100 = () => wrangler(["versions", "deploy", `${id}@100%`, "--yes", "--message", "deploy:vinext"]);

const anterior = process.env.DESPLIEGUE_DIRECTO === "1" ? null : versionActual();
let enDosTiempos = false;
if (anterior && anterior !== id) {
  console.log(`· Primer tramo: ${RAMPA} % a la versión nueva, ${100 - RAMPA} % a la de antes…`);
  const reparto = wrangler([
    "versions",
    "deploy",
    `${id}@${RAMPA}%`,
    `${anterior}@${100 - RAMPA}%`,
    "--yes",
    "--message",
    "deploy:vinext (reparto)",
  ]);
  if (reparto.ok) {
    enDosTiempos = true;
    console.log(`· Esperando ${ESPERA} s a que la versión se propague…`);
    await dormir(ESPERA * 1000);
  } else {
    console.log("  (el reparto no se pudo hacer; se activa del tirón)");
  }
}

console.log(`· Activando la versión ${id} al 100 % (los dominios no se tocan)…`);
if (!activarAl100().ok) {
  salir(
    enDosTiempos
      ? `La versión ${id} se quedó al ${RAMPA} % y NO se pudo llevar al 100 %: la web está sirviendo ` +
          `las dos a la vez. Termínalo a mano:\n\n  npx wrangler versions deploy ${id}@100% --yes --config "${CONFIG}"`
      : `La versión ${id} se subió pero no se pudo activar. La web sigue con la anterior.`,
  );
}

console.log(`\n✔ Desplegado${enDosTiempos ? " en dos tiempos" : ""}: versión ${id} sirviendo el 100 % del tráfico.`);
