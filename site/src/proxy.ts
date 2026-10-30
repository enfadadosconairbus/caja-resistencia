import { NextResponse, type NextRequest } from "next/server";

/**
 * REDIRECTOR 301 → Web B (fase 3, 29-sep-2026).
 *
 * Esta web ya no sirve contenido. Todo lo que tenía vive en la caja de resistencia:
 * la cronología, la documentación, la guía del referéndum, la cobertura de prensa y las
 * reivindicaciones del manifiesto se mudaron en la fase 2 a páginas hijas de la campaña
 * `huelga-2026`. Lo que queda aquí es la puerta: cada URL antigua manda a su equivalente
 * para que lo impreso y lo que circula por Telegram siga funcionando, y para que el
 * posicionamiento se traspase en vez de perderse.
 *
 * Antes este fichero solo negociaba el idioma de las rutas sin prefijo. Se le añade el
 * mapa y deja de haber sitio a donde llegar.
 *
 * ── POR QUÉ AQUÍ Y NO EN `redirects()` DE next.config ──
 * El proxy corre ANTES que `redirects()`. Si el mapa viviera en la config, una visita a
 * `/` daría dos saltos: 307 del proxy a `/es` y luego 301 a la Web B. Haciéndolo aquí es
 * un salto para todo, incluidas las rutas sin idioma.
 *
 * ── 301 Y NO 308 ──
 * `NextResponse.redirect` sin más da 307, y `permanent: true` en la config da 308. Los dos
 * traspasan autoridad, pero 301 es el que entiende todo —incluidos rastreadores viejos,
 * verificadores de enlaces y lo que haya leído un QR impreso—, y aquí el objetivo es
 * justamente que nadie se quede fuera. Se pide explícito.
 *
 * ── LO QUE ESTO NO PUEDE ARREGLAR ──
 * Las anclas no viajan: el navegador nunca manda el `#` al servidor. Un enlace a
 * `/es#cronologia` acabará en la portada de la Web B, no en la cronología. No hay forma
 * de resolverlo en el servidor; haría falta una página puente con JavaScript, y no
 * compensa montarla para unos pocos enlaces internos que además ya no existen.
 */
const WEB_B = "https://cajaderesistencia-asi-no.org";

/** La campaña que absorbió el contenido de esta web. */
const CAMPANA = "huelga-2026";

const locales = ["es", "en", "fr", "de"] as const;
const defaultLocale = "es";

/**
 * A dónde va cada ruta de esta web, sin el prefijo de idioma.
 *
 * Las claves son lo que servía la Web A; los valores, la ruta equivalente en la Web B.
 * `la-caja` y `tienda` están aquí aunque esta web ya NO las sirva: se fueron a la Web B
 * en el split de agosto y el sitemap siguió anunciándolas, así que llevan semanas dando
 * 404 a quien las siguiera. Redirigirlas arregla de paso ese agujero.
 */
const MAPA: Record<string, string> = {
  "": "",
  documentacion: `campanas/${CAMPANA}/documentacion`,
  referendum: `campanas/${CAMPANA}/referendum`,
  // «Sobre este proyecto» —naturaleza, criterio editorial, minimización de datos y
  // contacto para correcciones o retirada— es ya la página de gobernanza de la Web B:
  // usa el mismo diccionario (`d.sobre`), así que no es un equivalente aproximado.
  "sobre-el-proyecto": "gobernanza",
  "la-caja": "la-caja",
  // La sección de la Web B pasó de /tienda a /material el 5-oct-2026; se apunta directo
  // para no encadenar dos saltos (aquel 308 lo da el Worker de la Web B).
  tienda: "material",
};

function negociarIdioma(request: NextRequest): string {
  const header = request.headers.get("accept-language") ?? "";
  const preferido = header
    .split(",")
    .map((parte) => parte.split(";")[0].trim().slice(0, 2).toLowerCase());
  return preferido.find((codigo) => (locales as readonly string[]).includes(codigo)) ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Los documentos conservan su ruta: la Web B sirve los mismos 200 ficheros en /docs.
  // Es lo que hace que un enlace de un panfleto o de un mensaje de Telegram siga bajando
  // el PDF correcto. Allí salen con `X-Robots-Tag: noindex, noarchive`, igual que aquí.
  if (pathname.startsWith("/docs/")) {
    return NextResponse.redirect(`${WEB_B}${pathname}${search}`, 301);
  }

  const partes = pathname.split("/").filter(Boolean);
  const conIdioma = (locales as readonly string[]).includes(partes[0] ?? "");
  const lang = conIdioma ? partes[0] : negociarIdioma(request);
  const resto = (conIdioma ? partes.slice(1) : partes).join("/");

  // Una ruta que no está en el mapa cae en la portada de su idioma en vez de en un 404:
  // quien llega desde un enlace viejo acaba en algún sitio con sentido, no en un muro.
  const destino = MAPA[resto] ?? "";
  const ruta = destino ? `/${lang}/${destino}` : `/${lang}`;

  return NextResponse.redirect(`${WEB_B}${ruta}${search}`, 301);
}

export const config = {
  /*
   * Se redirige TODO menos cuatro cosas, y cada exclusión tiene su motivo:
   *
   * - `_next`  — los internos del build. La web ya no pinta nada, pero romperlos llenaría
   *              los registros de ruido sin arreglar nada.
   * - `api`    — el contador de visitas de esta web. Muere solo cuando nadie la visite.
   * - `robots.txt` y `sitemap.xml` — TIENEN que seguir sirviéndose. El sitemap es lo que
   *   hace que el buscador vuelva a pedir las URLs antiguas y se encuentre los 301; si se
   *   redirige también el sitemap, el buscador se queda sin la lista de lo que tiene que
   *   volver a mirar y el traspaso de posicionamiento se alarga meses. Se retiran cuando
   *   el buscador haya asimilado el cambio, no antes.
   *
   * Nota: el matcher de antes excluía cualquier ruta con extensión (`.*\\..*`), y por eso
   * `/docs/*.pdf` no pasaba por aquí. Ahora sí tiene que pasar.
   */
  matcher: ["/((?!_next|api|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)"],
};
