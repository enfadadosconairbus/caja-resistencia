#!/usr/bin/env node
/**
 * Guardia del redirector: que cada URL vieja lleve a una página que EXISTE.
 *
 * Esta web es un redirector 301 a la caja de resistencia desde el 29-sep-2026. El mapa
 * vive en `src/proxy.ts` y apunta a rutas de OTRA web, así que puede pudrirse sin que
 * nada avise: el día que la Web B mueva `/campanas/huelga-2026/documentacion` —y lo hará,
 * en cuanto haya una segunda campaña— este redirector seguirá contestando 301 tan feliz,
 * mandando a un 404. Lo único que lo detecta es pedir el destino.
 *
 * Por eso esto no comprueba solo que redirija: comprueba a dónde, de un solo salto, y que
 * el destino conteste 200 en producción.
 *
 * Comprueba además lo que NO se redirige a propósito —robots.txt y sitemap.xml— porque es
 * la parte que parece un error y no lo es: el sitemap es la lista por la que el buscador
 * vuelve a pedir las URLs antiguas y se encuentra los 301. Redirigirlo alarga meses el
 * traspaso de posicionamiento.
 *
 *   npm run build && npx next start -p 3009      # en otra terminal
 *   node scripts/check-redirector.mjs
 *
 *   BASE=https://enfadadosconairbus.vercel.app node scripts/check-redirector.mjs
 */
const A = process.env.BASE || "http://127.0.0.1:3009";
const B = "https://cajaderesistencia-asi-no.org";
const ok = (b) => (b ? "OK   " : "FALLA");
let fallos = 0;

/** Un solo salto: se pide sin seguir la redirección y se mira el Location. */
async function salto(ruta, cabeceras = {}) {
  const r = await fetch(A + ruta, { redirect: "manual", headers: cabeceras });
  return { st: r.status, a: r.headers.get("location") };
}

function comprobar(ruta, esperado, cabeceras) {
  return salto(ruta, cabeceras).then(({ st, a }) => {
    const bien = st === 301 && a === esperado;
    if (!bien) fallos++;
    console.log(`  ${ok(bien)} ${st}  ${ruta.padEnd(34)} → ${a ?? "(sin Location)"}`);
    if (!bien) console.log(`         esperaba: ${esperado}`);
  });
}

console.log("=== las rutas con idioma ===");
for (const l of ["es", "en", "fr", "de"]) {
  await comprobar(`/${l}`, `${B}/${l}`);
}
console.log();
for (const [de, a] of [
  ["documentacion", `campanas/huelga-2026/documentacion`],
  ["referendum", `campanas/huelga-2026/referendum`],
  ["sobre-el-proyecto", "gobernanza"],
  ["la-caja", "la-caja"],
  ["tienda", "material"],
]) {
  await comprobar(`/es/${de}`, `${B}/es/${a}`);
}

console.log("\n=== el mismo mapa en los otros idiomas ===");
for (const l of ["en", "fr", "de"]) {
  await comprobar(`/${l}/documentacion`, `${B}/${l}/campanas/huelga-2026/documentacion`);
}

console.log("\n=== rutas sin prefijo de idioma: un solo salto, no dos ===");
await comprobar("/", `${B}/es`);
await comprobar("/", `${B}/fr`, { "accept-language": "fr-FR,fr;q=0.9" });
await comprobar("/", `${B}/de`, { "accept-language": "de-DE,de;q=0.9,en;q=0.8" });
await comprobar("/documentacion", `${B}/es/campanas/huelga-2026/documentacion`);
await comprobar("/documentacion", `${B}/en/campanas/huelga-2026/documentacion`, {
  "accept-language": "en-GB,en;q=0.9",
});

console.log("\n=== los documentos conservan su ruta ===");
for (const d of [
  "/docs/manifiesto-enfadados-airbus.pdf",
  "/docs/spigaou-cgt-marignane-05-2026.pdf",
  "/docs/same-sky-different-pay-es.html",
  "/docs/pliego-garantias-espacio.pdf",
]) await comprobar(d, `${B}${d}`);

console.log("\n=== rutas que no existían: a la portada, no a un 404 ===");
await comprobar("/es/una-ruta-que-nunca-existio", `${B}/es`);
await comprobar("/inventada", `${B}/es`);

console.log("\n=== la query se conserva (campañas, UTM de un QR…) ===");
await comprobar("/es/documentacion?utm_source=panfleto", `${B}/es/campanas/huelga-2026/documentacion?utm_source=panfleto`);

console.log("\n=== lo que NO se redirige, y por qué ===");
for (const [ruta, motivo] of [
  ["/robots.txt", "el buscador tiene que poder leerlo"],
  ["/sitemap.xml", "es la lista por la que vuelve a pedir las URLs viejas"],
]) {
  const r = await fetch(A + ruta, { redirect: "manual" });
  const bien = r.status === 200;
  if (!bien) fallos++;
  console.log(`  ${ok(bien)} ${r.status}  ${ruta.padEnd(34)} ${motivo}`);
}

console.log("\n=== el sitemap anuncia las rutas que redirigen ===");
const xml = await (await fetch(`${A}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const rutas = [...new Set(locs.map((u) => new URL(u).pathname.replace(/^\/(es|en|fr|de)/, "/{lang}")))];
console.log(`  ${locs.length} URLs · ${rutas.length} rutas distintas:`);
for (const r of rutas.sort()) console.log(`    ${r}`);
for (const necesaria of ["/{lang}", "/{lang}/documentacion", "/{lang}/referendum", "/{lang}/sobre-el-proyecto"]) {
  const bien = rutas.includes(necesaria);
  if (!bien) fallos++;
  console.log(`  ${ok(bien)} anuncia ${necesaria}`);
}

console.log("\n=== y que el destino EXISTE de verdad en la Web B ===");
const destinos = [...new Set([
  `${B}/es`, `${B}/es/campanas/huelga-2026/documentacion`, `${B}/es/campanas/huelga-2026/referendum`,
  `${B}/es/gobernanza`, `${B}/es/la-caja`, `${B}/es/material`,
  `${B}/docs/manifiesto-enfadados-airbus.pdf`,
])];
for (const d of destinos) {
  const r = await fetch(d, { method: "HEAD" });
  if (!r.ok) fallos++;
  console.log(`  ${ok(r.ok)} ${r.status}  ${d.replace(B, "")}`);
}

console.log(
  fallos
    ? `\n⚠  ${fallos} comprobaciones fallaron`
    : "\nRedirector: todas las URLs viejas llevan a una página que existe.",
);
process.exit(fallos ? 1 : 0);
