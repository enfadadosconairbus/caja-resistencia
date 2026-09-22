import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renombra `middleware` → `proxy` (file convention). Redirige rutas sin
 * prefijo de idioma al locale negociado por `Accept-Language`, con `es` por
 * defecto. i18n desde archivos (dictionaries), nunca incrustada en componentes.
 */
const locales = ["es", "en", "fr", "de"] as const;
const defaultLocale = "es";

function getLocale(request: NextRequest): string {
  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());
  return preferred.find((code) => (locales as readonly string[]).includes(code)) ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Excluye internos de Next, las rutas de API y cualquier ruta con extensión
  // (robots.txt, sitemap.xml, og.svg…). `api` es imprescindible: sin ella, el contador
  // de visitas se redirigía a /es/api/visitas y nunca llegaba a contar. `panel` (Tesorería)
  // no está localizado: vive fuera de [lang] y lo protege Cloudflare Access, así que no debe
  // redirigirse a /es/panel (romperia la cobertura de Access y la verificación del JWT).
  matcher: ["/((?!_next|api|panel|.*\\..*).*)"],
};
