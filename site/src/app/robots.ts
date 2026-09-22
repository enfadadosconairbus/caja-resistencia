import type { MetadataRoute } from "next";
import { SITE_URL, SITE_INDEXABLE } from "@/lib/site-url";

/**
 * Genera /robots.txt (nativo de Next.js App Router).
 *
 * ⚠️ POR DEFECTO: NOINDEX. Protege las DEMOS ESPECULATIVAS.
 * Publicas demos en <cliente>-demo.vercel.app de negocios que aún no han dicho que sí:
 * no quieres que Google indexe la demo de un negocio ajeno.
 *
 * Para INDEXAR (solo cuando es un cliente REAL en su dominio de producción):
 *   define en Vercel  SITE_INDEXABLE=true   (Settings → Environment Variables)
 *
 * ⚠️ AL PASAR UN CLIENTE A PRODUCCIÓN, ACUÉRDATE DE PONER SITE_INDEXABLE=true,
 *    o su web real no aparecerá en Google. (Está en la checklist de A6 Onboarding.)
 */
export default function robots(): MetadataRoute.Robots {
  if (!SITE_INDEXABLE) {
    // Demo (o producción sin el flag): no indexar nada.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // Cliente real en producción: indexar todo + sitemap.
  //
  // ⚠️ NO añadas aquí `disallow: "/docs/"` para sacar los PDFs del buscador. Sería
  // contraproducente: `Disallow` impide RASTREAR, y un buscador que no rastrea el
  // fichero tampoco llega a leer su cabecera `X-Robots-Tag: noindex` —así que puede
  // acabar listando la URL igualmente (sin contenido) si alguien la enlaza desde fuera,
  // y sin forma de quitarla. Las dos instrucciones se estorban.
  //
  // Los documentos se excluyen del índice con la cabecera `noindex` que sirve
  // `next.config.ts` para `/docs/:path*`, y para que el buscador la lea hay que
  // dejarle rastrear. Está razonado allí.
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
