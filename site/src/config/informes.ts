/**
 * Informes propios del movimiento — los que NO vienen del índice de telegra.ph.
 *
 * El índice de Documentación es un volcado automático (85 documentos y subiendo) y ahí
 * dentro un informe editorial se pierde. Estos se declaran a mano y se destacan.
 *
 * Por qué HTML y no PDF: «Same Sky, Different Pay» es una página web autocontenida
 * —gráficos de barras en CSS, tablas comparativas, navegación por anclas— y aplanarla
 * a PDF le quitaría justo lo que la hace legible en móvil. Se sirve desde `public/docs/`
 * y se ABRE (`target="_blank"`), no se descarga: `download` en un .html deja al visitante
 * con un fichero suelto en Descargas que fuera de su carpeta ni siquiera abre bien.
 *
 * Lo que hay dentro es autocontenido: estilos y el único script van inline, sin CDN ni
 * fuentes remotas, así que pasa la CSP de `next.config.ts` sin abrirle la mano a nadie.
 * Los enlaces salientes del informe apuntan a las fuentes que cita (F1-F29).
 *
 * ⚠️ Al reemplazar una versión: sustituye los cuatro idiomas a la vez y actualiza
 * `fecha` y `pesoKB`. Un informe con los idiomas descuadrados es peor que uno viejo.
 */

export type IdiomaInforme = {
  /** Código de locale del sitio. */
  lang: "es" | "en" | "fr" | "de";
  /** Nombre del idioma EN ESE idioma (así se reconoce sin saber el del sitio). */
  label: string;
  href: string;
};

export type Informe = {
  id: string;
  /** Se pinta tal cual: es el nombre del informe, no se traduce. */
  titulo: string;
  fecha: string;
  idiomas: IdiomaInforme[];
};

export const SAME_SKY: Informe = {
  id: "same-sky-different-pay",
  titulo: "Same Sky, Different Pay",
  fecha: "2026-08-12",
  idiomas: [
    { lang: "es", label: "Español", href: "/docs/same-sky-different-pay-es.html" },
    { lang: "en", label: "English", href: "/docs/same-sky-different-pay-en.html" },
    { lang: "fr", label: "Français", href: "/docs/same-sky-different-pay-fr.html" },
    { lang: "de", label: "Deutsch", href: "/docs/same-sky-different-pay-de.html" },
  ],
};

/**
 * El idioma en el que se está leyendo la web, primero. El resto conserva su orden.
 *
 * No es cosmético: quien entra en /de y ve «Español · English · Français · Deutsch»
 * tiene que leer los cuatro para encontrar el suyo, y el primero de la fila es el que
 * más se pulsa. Si el locale no tiene versión del informe, no se inventa: manda el orden
 * declarado.
 */
export function idiomasOrdenados(informe: Informe, lang: string): IdiomaInforme[] {
  const propio = informe.idiomas.filter((i) => i.lang === lang);
  return [...propio, ...informe.idiomas.filter((i) => i.lang !== lang)];
}
