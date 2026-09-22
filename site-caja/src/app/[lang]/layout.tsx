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
      className="h-full"
      // El guion de abajo le añade `dark` a este mismo elemento antes de que React hidrate:
      // sin esto, React compara el HTML del servidor con el DOM ya retocado y avisa.
      suppressHydrationWarning
    >
      <head>
        {/* Antes de nada: el tema elegido en la visita anterior, para que no haya destello
            de papel blanco al abrir de noche. Ver `lib/tema.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: guionTemaSinParpadeo }} />
      </head>
      <body className="min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
