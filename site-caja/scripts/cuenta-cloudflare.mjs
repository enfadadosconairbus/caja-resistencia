/**
 * La cuenta de Cloudflare de la caja, para todo lo que lanza wrangler desde este sitio.
 *
 * En este PC conviven dos cuentas de Cloudflare: la de la caja y la de las tiendas de mrs2002.
 * El inicio de sesión de wrangler (`wrangler login`) es UNO para todo el ordenador, así que
 * cuando otra sesión trabaja con mrs2002, la caja se queda sin poder publicar (pasó el 9 y el
 * 20-oct-2026). Con un token propio, los comandos de la caja no dependen de esa sesión.
 *
 * El token NUNCA va en el repo. Vive en la variable de entorno de usuario de Windows
 * `CAJA_CLOUDFLARE_API_TOKEN`; se guarda con `npm run cloudflare:token`, que lo pide sin
 * mostrarlo. Se pasa como `CLOUDFLARE_API_TOKEN` SOLO a los procesos que lanza este sitio, de
 * modo que el resto de proyectos siguen usando su propio inicio de sesión.
 *
 * Sin token, se usa el inicio de sesión de wrangler, pero antes se comprueba que es la cuenta
 * de la caja: publicar no puede depender de qué sesión haya quedado abierta.
 */
import { spawnSync } from "node:child_process";

/** Cuenta «Enfadadosconairbus.contacto@gmail.com's Account». Un identificador, no un secreto. */
export const CUENTA_CAJA = "bda7ebe8ceabda92326ff551d5560d93";
const VARIABLE = "CAJA_CLOUDFLARE_API_TOKEN";

/**
 * El token: primero del entorno del proceso y, en Windows, si no está, del registro del
 * usuario. Así sirve nada más guardarlo, sin reiniciar la terminal ni la app (una variable
 * puesta con `SetEnvironmentVariable` solo la ven los procesos que arrancan después).
 */
export function tokenCaja() {
  const directo = process.env[VARIABLE]?.trim();
  if (directo) return directo;
  if (process.platform !== "win32") return null;
  const r = spawnSync("reg", ["query", "HKCU\\Environment", "/v", VARIABLE], { encoding: "utf8" });
  const m = r.status === 0 ? r.stdout.match(new RegExp(`${VARIABLE}\\s+REG_\\w+\\s+(\\S+)`)) : null;
  return m ? m[1].trim() : null;
}

/** El entorno con el que se lanza wrangler para la caja. */
export function entornoCaja(base = process.env) {
  const token = tokenCaja();
  const env = { ...base, CLOUDFLARE_ACCOUNT_ID: CUENTA_CAJA, FORCE_COLOR: "0" };
  if (token) env.CLOUDFLARE_API_TOKEN = token;
  return { env, conToken: Boolean(token) };
}

/**
 * Se asegura de que wrangler va a hablar con la cuenta de la caja. Con token basta con que
 * el token tenga acceso a esa cuenta; sin token, el inicio de sesión tiene que ser el de la
 * caja. Devuelve un texto con el problema, o null si todo está bien.
 */
export function comprobarCuenta(cwd) {
  const { env, conToken } = entornoCaja();
  const r = spawnSync("npx", ["wrangler", "whoami"], { cwd, shell: true, encoding: "utf8", env });
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (salida.includes(CUENTA_CAJA)) return null;
  if (conToken) {
    return (
      `El token de ${VARIABLE} no tiene acceso a la cuenta de la caja (${CUENTA_CAJA}).\n` +
      "  Créalo de nuevo desde la cuenta de la caja y guárdalo con `npm run cloudflare:token`."
    );
  }
  const quien = salida.match(/associated with the email (\S+?)\.?\s/)?.[1];
  return (
    (quien
      ? `wrangler tiene abierta la sesión de ${quien}, que no es la de la caja.`
      : "wrangler no tiene ninguna sesión abierta.") +
    "\n  Solución permanente: guarda el token propio de la caja con `npm run cloudflare:token`" +
    "\n  (instrucciones en DEPLOY-CLOUDFLARE.md). Para salir del paso: `npx wrangler login` con la cuenta de la caja."
  );
}
