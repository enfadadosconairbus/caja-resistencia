import type { Metadata } from "next";
import { notFound } from "next/navigation";
// Fuentes AUTO-ALOJADAS (sirven desde el propio dominio → CSP `font-src 'self'`). Se cambió
// de next/font/google al migrar a vinext, que las serviría por CDN. Las variables CSS
// (--ff-display/body/mono) se definen en globals.css; aquí solo se cargan los @font-face.
import "@fontsource-variable/archivo";
import "@fontsource-variable/source-sans-3";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "../globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { Huelguista } from "@/components/huelguista/huelguista";
import { Buzon } from "@/components/buzon";
import { SITE_URL } from "@/lib/site-url";
import { guionTemaSinParpadeo } from "@/lib/tema";
import { getDictionary, hasLocale, locales } from "./dictionaries";

// Par tipográfico propio (nunca Inter/Roboto — criterio 2 del $10K): Archivo (display),
// Source Sans 3 (body), IBM Plex Mono (datos/kickers). Auto-alojado vía @fontsource; las
// variables --ff-* se definen en globals.css.

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const d = await getDictionary(lang);
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}`]));
  return {
    metadataBase: new URL(SITE_URL),
    title: d.meta.title,
    description: d.meta.description,
    // Los iconos NO van aquí: vinext no emite el campo `icons` de `Metadata` (comprobado en
    // producción, no aparece ni en el `<head>` ni en el cuerpo). Van como `<link>` sueltos
    // en el `<head>` de abajo, que es lo único que sobrevive al build.
    alternates: {
      canonical: `/${lang}`,
      languages: { ...languages, "x-default": "/es" },
    },
    openGraph: {
      type: "website",
      locale: lang,
      title: d.meta.title,
      description: d.meta.description,
      // PNG 1200×630 (og.png): WhatsApp, Telegram, X y Facebook no previsualizan SVG.
      images: [{ url: "/og.png", width: 1200, height: 630, alt: d.meta.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: d.meta.title,
      description: d.meta.description,
      images: ["/og.png"],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);

  // schema.org: es una iniciativa/causa, no una empresa. NGO genérico, sin datos inventados.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: "#EnfadadosconAirbus",
    description:
      "Caja de resistencia del movimiento de la plantilla de Airbus España: aportaciones, transparencia y gobernanza del fondo.",
    areaServed: "ES",
  };

  return (
    <html
      lang={lang}
      // `dark` va puesta DE SALIDA: el defecto de esta web es la noche (excepción a D-09,
      // razonada en `lib/tema.ts`). El guion de abajo la QUITA antes del primer pintado si
      // la visita anterior eligió papel; por eso `suppressHydrationWarning`, porque React
      // compararía el HTML del servidor con el DOM ya retocado y avisaría.
      className="h-full dark"
      suppressHydrationWarning
    >
      <head>
        {/* Antes de nada: el tema elegido en la visita anterior, para que no haya destello
            de papel blanco al abrir de noche. Ver `lib/tema.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: guionTemaSinParpadeo }} />

        {/* Iconos a mano, y hay motivo. Los tres ficheros están donde manda el convenio de
            Next (`app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`) y en desarrollo
            las etiquetas salen solas — pero el build de vinext NO las emite. Comprobado en
            producción: los tres se sirven con su content-type correcto y el documento
            entero venía con cero `<link rel="icon">`. Declararlos en el campo `icons` de
            `Metadata` tampoco sirve: vinext se lo salta igual. Aquí, en el `<head>`
            literal, es el único sitio donde sobreviven.
            El favicon colaba de todas formas porque el navegador pide `/favicon.ico` por su
            cuenta; el de 180 para la pantalla de inicio del móvil se perdía. */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon" />
        <link rel="icon" href="/icon.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
      </head>
      <body className="min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <MotionProvider>{children}</MotionProvider>
        {/* El huelguista vive en el borde inferior de todas las páginas públicas (no en
            /panel, que tiene su propio layout). three.js entra en diferido: ver el componente. */}
        <Huelguista textos={d.huelguista} />
        {/* Buzón de sugerencias: lo abren el huelguista y el enlace del pie. La clave de
            Turnstile es pública (`vars` de wrangler.jsonc). */}
        <Buzon textos={d.buzon} lang={lang} claveSitio={process.env.TURNSTILE_SITE_KEY} />
      </body>
    </html>
  );
}
