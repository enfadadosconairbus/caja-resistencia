import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * /sitemap.xml con las rutas por idioma + alternates hreflang.
 * (Solo se sirve como Allow cuando SITE_INDEXABLE=true — ver robots.ts.
 * Mientras la web esté en preparación es NOINDEX.)
 */
const locales = ["es", "en", "fr", "de"];

/** Páginas de la web de la caja (Web B), por idioma. */
const RUTAS = [
  { path: "", prioridad: 1 },
  { path: "/la-caja", prioridad: 0.9 },
  { path: "/gobernanza", prioridad: 0.7 },
  { path: "/tienda", prioridad: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return RUTAS.flatMap((r) => {
    const languages = Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${r.path}`]));
    return locales.map((l) => ({
      url: `${SITE_URL}/${l}${r.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: l === "es" ? r.prioridad : r.prioridad * 0.8,
      alternates: { languages },
    }));
  });
}
