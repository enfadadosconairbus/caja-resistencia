import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";
import { SAME_SKY } from "@/config/informes";

/**
 * /sitemap.xml con las rutas por idioma + alternates hreflang.
 * (Solo se sirve como Allow cuando SITE_INDEXABLE=true — ver robots.ts.
 * En demo/pilotaje la web es NOINDEX.)
 */
const locales = ["es", "en", "fr", "de"];

/** Las tres páginas de cada idioma: portada, La caja y Tienda. */
const RUTAS = [
  { path: "", prioridad: 1 },
  { path: "/la-caja", prioridad: 0.9 },
  { path: "/documentacion", prioridad: 0.8 },
  { path: "/tienda", prioridad: 0.6 },
];

/**
 * El informe «Same Sky, Different Pay» es un HTML servido desde `public/`, no una ruta de
 * la app: Next no lo descubre solo. Va aquí porque es contenido de verdad en cuatro
 * idiomas —y está escrito para cruzar fronteras—, así que sus alternates hreflang valen
 * tanto como los de las páginas. `changeFrequency: yearly`: se publica por versiones.
 */
function informe(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    SAME_SKY.idiomas.map((i) => [i.lang, `${SITE_URL}${i.href}`]),
  );
  return SAME_SKY.idiomas.map((i) => ({
    url: `${SITE_URL}${i.href}`,
    lastModified: new Date(SAME_SKY.fecha),
    changeFrequency: "yearly" as const,
    priority: i.lang === "es" ? 0.7 : 0.6,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const paginas = RUTAS.flatMap((r) => {
    const languages = Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${r.path}`]));
    return locales.map((l) => ({
      url: `${SITE_URL}/${l}${r.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: l === "es" ? r.prioridad : r.prioridad * 0.8,
      alternates: { languages },
    }));
  });
  return [...paginas, ...informe()];
}
