import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { BUZON, type ErrorBuzon } from "@/config/buzon";

/**
 * Buzón de sugerencias: recibe el texto del formulario y lo manda por correo a la coordinación.
 *
 * Privacidad, por diseño: la sugerencia NO se guarda en ninguna base de datos (el correo es el
 * único registro), y el correo no lleva ni la IP ni el navegador de quien escribe. La IP solo se
 * usa como llave del limitador de ritmo, que es un contador efímero de Cloudflare.
 *
 * Defensa contra el spam, por capas, de la más barata a la más cara:
 *   1. Campo trampa (`web`): invisible para personas; los bots lo rellenan.
 *   2. Tiempo mínimo entre abrir y enviar (`BUZON.minSegundos`).
 *      En estos dos casos se responde "ok" sin enviar nada: al bot no se le da pista.
 *   3. Limitador de ritmo (`LIMITE_BUZON`, 3 por minuto y conexión).
 *   4. Turnstile, si está configurado el secreto `TURNSTILE_SECRET`.
 * Y aun si todo fallara, el binding `BUZON` solo puede escribir a nuestra propia dirección.
 */
export const dynamic = "force-dynamic";

const LOCALES = ["es", "en", "fr", "de"] as const;

const falla = (error: ErrorBuzon, status: number) => NextResponse.json({ ok: false, error }, { status });

/** Quita caracteres de control (salvo saltos de línea y tabuladores) y recorta. */
const limpiar = (s: unknown, max: number) =>
  typeof s === "string"
    ? s
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, max + 1)
    : "";

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

/**
 * Comprueba el token de Turnstile. Sin el secreto `TURNSTILE_SECRET` se omite, y lo dice el
 * registro: es lo que pasa en local y en producción mientras nadie lo haya configurado.
 */
async function turnstileValido(token: unknown): Promise<boolean> {
  const secreto = (env as unknown as { TURNSTILE_SECRET?: string }).TURNSTILE_SECRET;
  if (!secreto) {
    console.warn("buzon: sin TURNSTILE_SECRET, se acepta sin verificar el token");
    return true;
  }
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", secreto);
  form.append("response", token);
  // Sin `remoteip` a propósito: no hace falta para validar y así la IP no viaja a ningún sitio.
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch (e) {
    console.error("buzon: siteverify no responde", e);
    return false;
  }
}

const fechaMadrid = () =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date());

export async function POST(request: Request) {
  let body: { texto?: unknown; contacto?: unknown; web?: unknown; segundos?: unknown; token?: unknown; lang?: unknown; pagina?: unknown };
  try {
    body = await request.json();
  } catch {
    return falla("corto", 400);
  }

  // 1 y 2: trampa y prisa. Se contesta como si hubiera ido bien.
  const segundos = typeof body.segundos === "number" ? body.segundos : 0;
  if ((typeof body.web === "string" && body.web.trim() !== "") || segundos < BUZON.minSegundos) {
    return NextResponse.json({ ok: true });
  }

  const texto = limpiar(body.texto, BUZON.maxTexto);
  if (texto.length < BUZON.minTexto) return falla("corto", 400);
  if (texto.length > BUZON.maxTexto) return falla("largo", 400);
  const contacto = limpiar(body.contacto, BUZON.maxContacto).replace(/\n/g, " ").slice(0, BUZON.maxContacto);
  const lang = LOCALES.includes(body.lang as (typeof LOCALES)[number]) ? (body.lang as string) : "es";
  const pagina = typeof body.pagina === "string" && body.pagina.startsWith("/") ? body.pagina.slice(0, 200) : "";

  // 3: ritmo. La IP es solo la llave del contador; no se guarda.
  const llave = request.headers.get("cf-connecting-ip") ?? "anonimo";
  try {
    const { success } = await env.LIMITE_BUZON.limit({ key: llave });
    if (!success) return falla("ritmo", 429);
  } catch (e) {
    // Si el limitador fallara, el buzón no se cae por eso: quedan Turnstile y el binding.
    console.error("buzon: limitador no disponible", e);
  }

  // 4: Turnstile.
  if (!(await turnstileValido(body.token))) return falla("verificacion", 403);

  const resumen = texto.replace(/\s+/g, " ").slice(0, 60);
  const lineas = [
    "Nueva sugerencia desde el buzón de la web.",
    "",
    "────────────────────────────",
    texto,
    "────────────────────────────",
    "",
    `Contacto para responder: ${contacto || "no ha dejado ninguno (anónima)"}`,
    `Idioma de la página: ${lang}`,
    pagina ? `Página: ${pagina}` : "",
    `Enviada: ${fechaMadrid()}`,
    "",
    "Este correo lo envía la web automáticamente. No incluye la IP ni ningún otro dato de quien escribe.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");

  try {
    await env.BUZON.send({
      from: BUZON.remitente,
      to: BUZON.destino,
      subject: `Sugerencia: ${resumen}${texto.length > 60 ? "…" : ""}`,
      // Si dejó un correo, "Responder" en Gmail le contesta directamente.
      ...(EMAIL.test(contacto) ? { replyTo: contacto } : {}),
      text: lineas.join("\n"),
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    console.error("buzon: no se pudo enviar", code ?? "", e);
    return falla("envio", 503);
  }
  return NextResponse.json({ ok: true });
}
