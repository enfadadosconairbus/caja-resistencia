import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";
import { SAME_SKY } from "@/config/informes";

/**
 * /sitemap.xml con las rutas por idioma + alternates hreflang.
 * (Solo se sirve como Allow cuando SITE_INDEXABLE=true — ver robots.ts.
 * En demo/pilotaje la web es NOINDEX.)
 *
 * ── FASE 3 (29-sep-2026): ESTE SITEMAP ANUNCIA REDIRECCIONES, Y ESO ESTÁ BIEN ──
 *
 * Desde hoy esta web es un redirector 301 a la caja de resistencia: ninguna de estas URLs
 * devuelve ya una página. Parece raro seguir publicándolas, pero es justo lo que hay que
 * hacer en una mudanza: el sitemap es la lista por la que el buscador vuelve a pedir las
 * URLs antiguas, y al pedirlas se encuentra el 301 y traspasa el posicionamiento. Si se
 * vacía el sitemap el día del cambio, el buscador se queda sin saber qué tiene que volver
 * a mirar y la transferencia se alarga meses.
 *
 * Se retira cuando el buscador haya asimilado el cambio (Search Console deja de listar las
 * URLs antiguas como indexadas), no antes.
 *
 * Por eso aquí se AÑADEN rutas en vez de quitarlas: `referendum` y `sobre-el-proyecto`
 * existían y redirigen, pero nunca estuvieron en esta lista, así que el buscador no tenía
 * motivo para volver a pedirlas. `la-caja` y `tienda` llevaban semanas dando 404 —se
 * fueron a la Web B en el split de agosto y nadie tocó esta lista—; ahora redirigen bien.
 */
const locales = ["es", "en", "fr", "de"];

/** Todas las rutas que esta web llegó a servir. Hoy, todas redirigen. */
const RUTAS = [
  { path: "", prioridad: 1 },
  { path: "/la-caja", prioridad: 0.9 },
  { path: "/documentacion", prioridad: 0.8 },
  { path: "/referendum", prioridad: 0.8 },
  { path: "/sobre-el-proyecto", prioridad: 0.7 },
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
