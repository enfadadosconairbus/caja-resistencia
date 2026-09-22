/**
 * Contador de visitas — propio, en el servidor, sin rastrear a nadie.
 *
 * Cada carga de la portada llama a la Durable Object `VISITAS` (ver `worker/index.ts` y
 * `src/server/visitas-counter.ts`), que incrementa un único número de forma ATÓMICA. No se
 * guarda IP, ni user-agent, ni cookie, ni identificador de sesión: solo un número que sube.
 * Por eso no hace falta consentimiento y no contradice la política de cookies.
 *
 * Se cambió de Redis/Upstash (REST) a Durable Object al migrar a Cloudflare: KV no tiene
 * incremento atómico y tope 1.000 escrituras/día en el plan gratuito; la DO no tiene ninguna
 * de las dos pegas.
 *
 * ⚠️ Si la DO no está disponible (entorno sin bindings), `contarVisita()` devuelve null y el
 * contador NO se pinta. Nunca un número inventado ni de arranque (D-10/D-11).
 */
import { env } from "cloudflare:workers";

/** Un único contador global para ESTA web. La Web A usa su propio Worker y su propia DO. */
const NOMBRE = "caja-portada";

/** El binding `VISITAS` se declara en wrangler.jsonc; en el Worker siempre está presente. */
export const contadorConfigurado = true;

/** Suma una visita y devuelve el total. null = la DO no está disponible. */
export async function contarVisita(): Promise<number | null> {
  try {
    const ns = env.VISITAS;
    const stub = ns.get(ns.idFromName(NOMBRE));
    const total = await stub.incrementar();
    return typeof total === "number" ? total : null;
  } catch {
    // El contador nunca puede tumbar la página: si la DO falla, no se pinta y ya.
    return null;
  }
}
