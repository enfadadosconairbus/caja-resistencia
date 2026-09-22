/**
 * Contador de visitas — propio, en el servidor, sin rastrear a nadie.
 *
 * Cómo funciona: cada carga de la portada incrementa un contador en un Redis (el que
 * Vercel provisiona desde Storage → Upstash). No se guarda IP, ni user-agent, ni cookie,
 * ni identificador de sesión: solo un número que sube. Por eso no hace falta consentimiento
 * y por eso no contradice lo que la web promete en su política de cookies.
 *
 * ⚠️ Si no hay almacén configurado, `getVisitas()` devuelve null y el contador NO se pinta.
 * Nunca un número inventado ni un valor de arranque: un contador que miente vale menos que
 * no tener contador (D-10/D-11).
 *
 * Variables de entorno (las pone solas la integración de Vercel):
 *   KV_REST_API_URL   / KV_REST_API_TOKEN        ← Vercel KV
 *   UPSTASH_REDIS_REST_URL / …_REST_TOKEN        ← Upstash directo
 */

const URL_BASE = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const CLAVE = "visitas:portada";

export const contadorConfigurado = Boolean(URL_BASE && TOKEN);

async function comando(...partes: string[]): Promise<number | null> {
  if (!contadorConfigurado) return null;
  try {
    const res = await fetch(`${URL_BASE}/${partes.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    const n = Number(json.result);
    return Number.isFinite(n) ? n : null;
  } catch {
    // El contador nunca puede tumbar la página: si el almacén falla, no se pinta y ya.
    return null;
  }
}

/** Suma una visita y devuelve el total. null = no hay contador que enseñar. */
export function contarVisita(): Promise<number | null> {
  return comando("INCR", CLAVE);
}

/** Total actual, sin sumar. */
export function leerVisitas(): Promise<number | null> {
  return comando("GET", CLAVE);
}
