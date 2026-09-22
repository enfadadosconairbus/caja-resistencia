import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Documentacion } from "@/components/documentacion";
import { FONDO } from "@/config/fondo";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * DOCUMENTACIÓN — tercera página.
 *
 * Estaba en la portada, y ahí costaba 14,7 s de LCP en móvil: 5.317 elementos de DOM entre
 * 24 actas, 43 resúmenes y 84 documentos, todos servidos en el mismo HTML (medido con
 * Lighthouse en producción, A4 del 09-ago-2026). Sacarla no quita nada —sigue completa y
 * plegable— pero deja de cobrárselo a quien solo entra a entender el conflicto o a aportar.
 * En la portada queda un bloque con los contadores reales y el enlace.
 */

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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/documentacion`]));
  return {
    title: `${d.documentacion.metaTitle} · ${d.meta.title}`,
    description: d.documentacion.metaDescription,
    alternates: {
      canonical: `/${lang}/documentacion`,
      languages: { ...languages, "x-default": "/es/documentacion" },
    },
  };
}

export default async function DocumentacionPagina({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);

  return (
    <div className="bg-[var(--color-fondo)] text-[var(--color-tinta)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-tinta)] focus:px-4 focus:py-2 focus:text-[var(--color-fondo)]"
      >
        {d.nav.skip}
      </a>

      <SiteNav lang={lang} nav={d.nav} pagina="documentacion" />


      <main id="main" tabIndex={-1}>
        {/* Ancla antigua: los enlaces a #documentacion y #actualizaciones que ya circulan
            aterrizan en la portada, que redirige aquí con su bloque de llamada. */}
        <section id="documentacion" className={SECTION}>
          <Link
            href={`/${lang}`}
            className="mb-8 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)] transition-colors hover:text-[var(--color-acento-tinta)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M8.5 3 4.5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {d.documentacion.volver}
          </Link>
          <Documentacion s={d.documentacion} informes={d.informes} lang={lang} titulo="h1" />
        </section>
      </main>

      <SiteFooter
        footer={d.footer}
        legalModals={d.legalModals}
        cookies={d.cookies}
        titular={FONDO.titular}
        titularLabels={d.titularLabels}
        lang={lang}
      />
    </div>
  );
}
