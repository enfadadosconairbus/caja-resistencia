/**
 * Buzón de sugerencias: lo que comparten el formulario (`components/buzon.tsx`) y el servidor
 * (`app/api/sugerencia/route.ts`). Que los límites vivan en un sitio evita que el navegador deje
 * escribir algo que el servidor luego rechaza.
 */
export const BUZON = {
  /** Adonde llega. El binding `BUZON` de wrangler.jsonc solo puede enviar aquí. */
  destino: "enfadadosconairbus.contacto@gmail.com",
  /** Remitente: cualquier dirección del dominio con Email Routing activado. */
  remitente: { email: "buzon@cajaderesistencia-asi-no.org", name: "Buzón de la caja" },
  minTexto: 10,
  maxTexto: 3000,
  maxContacto: 200,
  /**
   * Segundos mínimos entre abrir el buzón y enviar. Una persona tarda más; un bot que rellena
   * el formulario de golpe, no. Si llega antes, se le dice que sí y no se envía nada.
   */
  minSegundos: 3,
} as const;

/**
 * Clave de sitio de PRUEBA de Turnstile publicada por Cloudflare (siempre aprueba). La usa el
 * formulario en localhost, donde la clave real no está autorizada; el servidor, sin secreto
 * configurado en local, acepta igualmente.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_PRUEBA = { sitio: "1x00000000000000000000AA" } as const;

export type ErrorBuzon = "corto" | "largo" | "verificacion" | "ritmo" | "envio";
