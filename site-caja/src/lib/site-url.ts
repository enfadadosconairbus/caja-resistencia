/**
 * URL pública del sitio — una sola fuente para canonical, hreflang, Open Graph y sitemap.
 *
 * Antes cada fichero hacía `process.env.SITE_URL ?? "https://EJEMPLO.example"`, y como esa
 * variable no estaba definida en Vercel, producción publicaba el marcador de posición: el
 * sitemap listaba `https://EJEMPLO.example/es` y los canonical apuntaban a un dominio que
 * no existe. Un despliegue no debería depender de que alguien se acuerde de una variable.
 *
 * Orden de resolución, del más específico al más genérico:
 *
 *   1. `SITE_URL` — dominio propio del cliente. Es la única que hay que tocar a mano, y
 *      solo cuando se conecta un dominio de verdad.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — la inyecta Vercel sola. Es el dominio de
 *      PRODUCCIÓN del proyecto y no cambia entre despliegues (a diferencia de VERCEL_URL).
 *      Con esto, una demo recién desplegada ya tiene sus canonical bien sin configurar nada.
 *   3. `VERCEL_URL` — el dominio de ESTE despliegue. Cambia en cada uno, así que solo vale
 *      como último recurso (previews).
 *   4. `http://localhost:3000` — desarrollo.
 *
 * Nunca devuelve un dominio inventado: si algo falla, falla hacia localhost, que es
 * evidente al mirarlo, y no hacia una URL con pinta de real.
 */

function conEsquema(host: string): string {
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

function resolver(): string {
  const candidatos = [
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const c of candidatos) {
    const v = c?.trim();
    if (v) return conEsquema(v).replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolver();

/** true solo cuando la web es de un cliente real en su dominio (ver robots.ts). */
// `String(...)` ensancha el tipo: `wrangler types` tipa la var como su literal actual
// ("false"), y comparar literal con "true" haría saltar a TS (sin cambiar el runtime).
export const SITE_INDEXABLE = String(process.env.SITE_INDEXABLE) === "true";
