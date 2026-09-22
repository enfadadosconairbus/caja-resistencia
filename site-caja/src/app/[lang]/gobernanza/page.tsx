import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { FONDO } from "@/config/fondo";
import { redactorGmail } from "@/lib/gmail";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";
const PROSE = "mx-auto max-w-2xl";

/**
 * GOBERNANZA (antes «Sobre este proyecto»). Es el ÚNICO sitio donde se explican a fondo la
 * independencia, la soberanía de la plantilla y el control colectivo; el resto de la web los
 * resume y enlaza aquí. Suma los documentos que rigen la caja y el contacto de la comisión
 * gestora. Todo lo que aún no existe (reglamento, dossier, correo del sindicato) se muestra
 * como pendiente, nunca inventado.
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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/gobernanza`]));
  return {
    title: `${d.sobre.metaTitle} · ${d.meta.title}`,
    description: d.sobre.metaDescription,
    alternates: {
      canonical: `/${lang}/gobernanza`,
      languages: { ...languages, "x-default": "/es/gobernanza" },
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

export default async function Gobernanza({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);
  const hoyEnMadrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARRANQUE.zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const s = d.sobre;
  const gestion = FONDO.contacto.general;

  return (
    <div className="bg-[var(--color-fondo)] text-[var(--color-tinta)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-tinta)] focus:px-4 focus:py-2 focus:text-[var(--color-fondo)]"
      >
        {d.nav.skip}
      </a>

      <SiteNav
        lang={lang}
        nav={d.nav}
        pagina="gobernanza"
        cintillo={
          <ChapaHuelga
            s={d.arranque.chapa}
            hoyISO={hoyEnMadrid}
            inicioISO={ARRANQUE.inicio}
            pausaISO={ARRANQUE.pausa}
            zona={ARRANQUE.zona}
          />
        }
      />

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

              <Seccion heading={s.independencia.heading}>
                {s.independencia.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Seccion>

              {/* ── REGLAMENTO DE REPARTO (aprobado en asamblea) ── */}
              <Seccion heading={s.reglamentoReparto.heading}>
                {s.reglamentoReparto.body.split(/\n\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
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

              {/* ── CONTACTO DE LA GESTIÓN DE LA CAJA (comisión gestora / sindicato) ── */}
              <Seccion heading={s.contactoCaja.heading}>
                <p>{s.contactoCaja.body}</p>
                {gestion ? (
                  <a
                    href={redactorGmail(gestion, s.contactoCaja.heading)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-[family-name:var(--ff-mono)] text-sm text-[var(--color-acento-tinta)] underline underline-offset-4 not-italic"
                  >
                    {gestion}
                  </a>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-[var(--color-linea)] px-4 py-3 font-[family-name:var(--ff-mono)] text-xs not-italic text-[var(--color-tinta-suave)]">
                    {s.contactoCaja.pendiente}
                  </p>
                )}
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
