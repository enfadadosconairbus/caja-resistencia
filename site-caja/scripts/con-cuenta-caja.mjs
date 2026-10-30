#!/usr/bin/env node
/**
 * Lanza un comando con la cuenta de Cloudflare de la caja (ver `cuenta-cloudflare.mjs`).
 *
 *   npm run wrangler:caja -- whoami
 *   npm run wrangler:caja -- secret put RESEND_API_KEY --name caja-resistencia-huelga-airbus-2026
 *   npm run wrangler:caja -- triggers deploy --config dist/server/wrangler.json
 *   node scripts/con-cuenta-caja.mjs vinext-cloudflare deploy --config dist/server/wrangler.json
 *
 * El primer argumento es el programa (wrangler, vinext-cloudflare…); se lanza con npx.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { comprobarCuenta, entornoCaja } from "./cuenta-cloudflare.mjs";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const [programa, ...args] = process.argv.slice(2);
if (!programa) {
  console.error("Uso: node scripts/con-cuenta-caja.mjs <wrangler|vinext-cloudflare> [argumentos…]");
  process.exit(2);
}

// `whoami` no necesita la comprobación (es justo lo que la hace); el resto, sí.
if (!(programa === "wrangler" && args[0] === "whoami")) {
  const problema = comprobarCuenta(SITE);
  if (problema) {
    console.error(`\n✖ ${problema}\n`);
    process.exit(1);
  }
}

// `shell: true` no entrecomilla: un argumento con espacios se partiría en dos.
const entrecomillar = (a) => (/^[\w@%.:/\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

// stdio heredado: los comandos interactivos (`secret put` pide el valor) funcionan igual.
const r = spawnSync("npx", [programa, ...args].map(entrecomillar), { cwd: SITE, shell: true, stdio: "inherit", env: entornoCaja().env });
process.exit(r.status ?? 1);
