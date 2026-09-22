/**
 * Verificación del JWT de Cloudflare Access — la puerta del panel de Tesorería (/panel).
 *
 * Access se sienta DELANTE del Worker: cuando alguien autenticado entra a una ruta cubierta por
 * la aplicación Access (aquí, todo lo que cuelga de `/panel`), Cloudflare inyecta el token en la
 * cabecera `Cf-Access-Jwt-Assertion`. Pero no nos fiamos solo de que la cabecera exista: la
 * verificamos por nuestra cuenta (defensa en profundidad, por si Access quedara mal configurado
 * o alguien intentara llegar por otra ruta). Es FAIL-CLOSED: cualquier duda → sin identidad.
 *
 * Comprobamos, en orden: estructura del token · audiencia (AUD de la app) · emisor (team domain)
 * · vigencia (exp/nbf) · y la FIRMA RS256 contra el JWKS público del team domain.
 *
 * AUD y team domain viven en `wrangler.jsonc` (vars) → `process.env` (nodejs_compat_populate_env).
 * Son identificadores públicos, no secretos.
 */

export type IdentidadAccess = { email: string };

type JWK = { kid?: string; kty?: string; n?: string; e?: string; alg?: string };

function base64urlABytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 ? 4 - (norm.length % 4) : 0;
  const bin = atob(norm + "=".repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64urlAString(s: string): string {
  return new TextDecoder().decode(base64urlABytes(s));
}

// Cache del JWKS en memoria del isolate (las claves rotan poco; 1 h es de sobra para un panel
// de bajo tráfico, y evita ir a por los certs en cada carga).
let jwksCache: { at: number; keys: JWK[] } | null = null;

async function clavesDe(teamDomain: string): Promise<JWK[]> {
  if (jwksCache && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS no disponible (${res.status})`);
  const data = (await res.json()) as { keys?: JWK[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { at: Date.now(), keys };
  return keys;
}

/**
 * Verifica el token de Access. Devuelve la identidad (email) si es válido, o `null` en cualquier
 * otro caso. No lanza hacia fuera: los fallos de red al pedir el JWKS también resuelven a `null`.
 */
export async function verificarAccess(token: string | null | undefined): Promise<IdentidadAccess | null> {
  const teamDomain = process.env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = process.env.ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return null; // sin config → cerrado
  if (!token) return null;

  const partes = token.split(".");
  if (partes.length !== 3) return null;

  let header: { kid?: string; alg?: string };
  let payload: { aud?: unknown; iss?: unknown; exp?: unknown; nbf?: unknown; email?: unknown };
  try {
    header = JSON.parse(base64urlAString(partes[0]));
    payload = JSON.parse(base64urlAString(partes[1]));
  } catch {
    return null;
  }

  if (header.alg !== "RS256") return null;

  const audiencias = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiencias.includes(aud)) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;

  const ahora = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < ahora) return null;
  if (typeof payload.nbf === "number" && payload.nbf > ahora + 60) return null;

  let jwk: JWK | undefined;
  try {
    const keys = await clavesDe(teamDomain);
    jwk = keys.find((k) => k.kid === header.kid);
  } catch {
    return null; // JWKS no disponible → cerrado
  }
  if (!jwk || jwk.kty !== "RSA" || !jwk.n || !jwk.e) return null;

  let firmaValida = false;
  try {
    const clave = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const datos = new TextEncoder().encode(`${partes[0]}.${partes[1]}`);
    firmaValida = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      clave,
      base64urlABytes(partes[2]) as BufferSource,
      datos,
    );
  } catch {
    return null;
  }
  if (!firmaValida) return null;

  const email = typeof payload.email === "string" ? payload.email : "";
  return { email };
}

/** Nombre de la cabecera que inyecta Cloudflare Access. */
export const CABECERA_ACCESS = "cf-access-jwt-assertion";
