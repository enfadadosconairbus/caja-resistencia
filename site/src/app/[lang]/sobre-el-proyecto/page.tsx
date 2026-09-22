import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { FONDO } from "@/config/fondo";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";
const PROSE = "mx-auto max-w-2xl";

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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/sobre-el-proyecto`]));
  return {
    title: `${d.sobre.metaTitle} · ${d.meta.title}`,
    description: d.sobre.metaDescription,
    alternates: {
      canonical: `/${lang}/sobre-el-proyecto`,
      languages: { ...languages, "x-default": "/es/sobre-el-proyecto" },
    },
  };
}

function Seccion({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--color-linea)] pt-10 mt-10 first:border-t-0 first:mt-0 first:pt-0">
      <h2 className="font-[family-name:var(--ff-display)] text-xl font-bold text-[var(--color-tinta)] md:text-2xl">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-[var(--color-tinta-suave)] leading-relaxed text-justify hyphens-auto">
        {children}
      </div>
    </section>
  );
}

export default async function SobreElProyecto({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);
  const s = d.sobre;

  return (
    <div className="bg-[var(--color-fondo)] text-[var(--color-tinta)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-tinta)] focus:px-4 focus:py-2 focus:text-[var(--color-fondo)]"
      >
        {d.nav.skip}
      </a>

      <SiteNav lang={lang} nav={d.nav} pagina="sobre" />

      <main id="main" tabIndex={-1}>
        <section className={SECTION}>
          <div className={PROSE}>
            <Link
              href={`/${lang}`}
              className="mb-8 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)] transition-colors hover:text-[var(--color-acento-tinta)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M8.5 3 4.5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {s.volver}
            </Link>

            <p className="kicker">{s.kicker}</p>
            <h1 className="mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
              {s.title}
            </h1>

            <div className="mt-12 space-y-0">
              <Seccion heading={s.naturaleza.heading}>
                {s.naturaleza.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Seccion>

              <Seccion heading={s.criterio.heading}>
                <p>{s.criterio.intro}</p>
                <ul className="space-y-2 pl-1">
                  {s.criterio.items.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden="true" className="mt-1 shrink-0 text-[var(--color-acento-tinta)]">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm italic">{s.criterio.coda}</p>
              </Seccion>

              <Seccion heading={s.privacidad.heading}>
                {s.privacidad.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Seccion>

              <Seccion heading={s.correcciones.heading}>
                {s.correcciones.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Seccion>

              <Seccion heading={s.independencia.heading}>
                {s.independencia.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Seccion>
            </div>
          </div>
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
