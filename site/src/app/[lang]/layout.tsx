import type { Metadata } from "next";
import { Archivo, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { SITE_URL } from "@/lib/site-url";
import { guionTemaSinParpadeo } from "@/lib/tema";
import { getDictionary, hasLocale, locales } from "./dictionaries";

// Par tipográfico propio (nunca Inter/Roboto — criterio 2 del $10K).
const display = Archivo({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});
const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

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
      images: [{ url: "/og.svg", alt: d.meta.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: d.meta.title,
      description: d.meta.description,
      images: ["/og.svg"],
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
      "Medio del movimiento de la plantilla de Airbus España: conflicto, documentación, solidaridad internacional y caja de resistencia.",
    areaServed: "ES",
  };

  return (
    <html
      lang={lang}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
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
