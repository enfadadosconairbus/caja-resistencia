import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad — se aplican a TODA ruta (AUD-016).
 *
 * Ninguna web del estudio tenía cabeceras de seguridad. Estas son el mínimo de
 * higiene para una web de negocio en producción (Vercel las sirve tal cual).
 *
 * Sobre la CSP (Content-Security-Policy):
 * - Las fuentes se AUTO-ALOJAN (next/font/google las sirve desde tu dominio), así
 *   que la CSP NO necesita abrir dominios de Google. En runtime no hay peticiones
 *   a fonts.gstatic.com.
 * - `img-src` es permisivo (https:) a propósito: cada cliente añade sus propias
 *   fotos desde hosts que la plantilla no puede conocer.
 * - `script-src`/`style-src` llevan 'unsafe-inline' porque Next.js (App Router)
 *   inyecta scripts y estilos inline para hidratar. Esto hace que la CSP
 *   RESTRINJA ORÍGENES pero NO sea un escudo anti-XSS completo. Endurecerla con
 *   nonces exige middleware y es frágil; queda como mejora futura, no aquí.
 * - 'unsafe-eval' SOLO en desarrollo: React lo usa en dev mode para depurar
 *   (nunca en producción). Sin él, la consola de dev se llena de errores de
 *   eval() y el QA visual de A4 no puede fiarse de "consola = 0 errores".
 *   En producción NO se incluye: se mantiene estricta.
 */
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      // Reproductores de vídeo embebidos (cobertura mediática). Solo el dominio
      // sin cookies de YouTube: el facade no carga nada de Google hasta que el
      // usuario pulsa play, y entonces lo hace en modo privacy-enhanced.
      "frame-src 'self' https://www.youtube-nocookie.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; "),
  },
  // Fuerza HTTPS durante 1 año. Sin `preload` a propósito: preload es un
  // compromiso difícil de revertir para el dominio de un cliente.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs del navegador que una web de negocio local no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

/**
 * Los documentos NO se indexan, aunque la web sí (decisión de Carlos, 13-ago-2026).
 *
 * La web quiere alcance: que quien busque el conflicto la encuentre. Los PDFs de
 * `public/docs/` son otra cosa — hay material interno de Airbus (tablas salariales,
 * política de trabajo a distancia), y Google indexa PDFs extrayendo su texto, incluso
 * pasando OCR a los escaneados. Indexarlos convertiría «documentos que circulan en un
 * grupo privado» en «documentos buscables por una frase exacta», y eso multiplica la
 * presión de la empresa por encontrar quién los sacó. Siguen a un clic para quien entra
 * en la web; simplemente no aparecen en resultados de búsqueda.
 *
 * `noarchive` va aparte de `noindex`: sin él, el buscador puede seguir sirviendo su
 * copia en caché del documento aunque no lo liste.
 *
 * Comprobado el 13-ago-2026 contra producción: las cabeceras de este fichero SÍ llegan
 * a los ficheros estáticos de `public/` (un GET a /docs/panfleto.pdf ya devolvía la CSP).
 */
const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, noarchive" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/docs/:path*", headers: noIndexHeaders },
    ];
  },
};

export default nextConfig;
