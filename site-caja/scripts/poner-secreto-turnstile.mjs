#!/usr/bin/env node
/**
 * Pone la clave SECRETA de Turnstile (buzón de sugerencias) como secret del Worker, sin que el
 * valor se imprima en ningún sitio: se lee del widget con wrangler y se le pasa a
 * `wrangler secret put` por la entrada estándar.
 *
 *   npm run buzon:secreto
 *
 * Sin este secreto el buzón funciona igual, pero el servidor no comprueba el token de Turnstile
 * (solo el campo trampa, el tiempo mínimo y el límite por ritmo). Ver `app/api/sugerencia`.
 *
 * Ojo: `secret put` publica al momento una versión nueva del Worker con el MISMO código que esté
 * en producción y el secreto añadido. No cambia nada de la web; solo activa la comprobación.
 */
import { spawnSync } from "node:child_process";

const CLAVE_SITIO = "0x4AAAAAAFK-g025cLSTqar6"; // pública: la misma que `TURNSTILE_SITE_KEY` en wrangler.jsonc
const WORKER = "caja-resistencia-huelga-airbus-2026";

const leer = spawnSync("npx", ["wrangler", "turnstile", "widget", "get", CLAVE_SITIO, "--json"], {
  shell: true,
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0" },
});
let secreto = "";
try {
  const salida = leer.stdout ?? "";
  const w = JSON.parse(salida.slice(salida.indexOf("{")));
  secreto = (w.result ?? w).secret ?? "";
} catch {
  // se informa abajo
}
if (leer.status !== 0 || !secreto) {
  console.error("✖ No se pudo leer el secreto del widget. ¿Has iniciado sesión? `npx wrangler whoami`");
  process.exit(1);
}

const poner = spawnSync("npx", ["wrangler", "secret", "put", "TURNSTILE_SECRET", "--name", WORKER], {
  shell: true,
  input: secreto,
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0" },
});
// La salida de wrangler no contiene el valor, pero por si acaso se filtra antes de mostrarla.
const mostrar = (t) => (t ?? "").split(secreto).join("•••");
process.stdout.write(mostrar(poner.stdout));
process.stderr.write(mostrar(poner.stderr));
if (poner.status !== 0) {
  console.error("✖ wrangler secret put falló.");
  process.exit(1);
}
console.log("\n✔ TURNSTILE_SECRET puesto. El buzón ya comprueba Turnstile en el servidor.");
