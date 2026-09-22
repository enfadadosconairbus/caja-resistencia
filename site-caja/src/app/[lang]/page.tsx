import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "./dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { Aviso } from "@/components/aviso";
import { FaqAccordion } from "@/components/faq-accordion";
import { MuroAportaciones } from "@/components/muro-aportaciones";
import { FONDO, WEB_MOVIMIENTO_URL, euros, recuento, saldoDisponible } from "@/config/fondo";
import { MaskText, Rise, Stagger, StaggerItem, MagneticButton } from "@/components/motion";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * PORTADA de la web de la CAJA (Web B).
 *
 * Objetivo: entender el conflicto y decidir cómo ayudar. Abre con la banda azul de firma +
 * el muro; sigue con «de dónde viene esta caja» (resumen del conflicto + enlace a la web del
 * movimiento) y los accesos para ayudar. Los valores se resumen en una línea y se desarrollan
 * a fondo en /gobernanza, para no repetirlos por toda la web.
 */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function Portada({
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

  const teasers = [
    { href: `/${lang}/la-caja#transparencia`, kicker: d.transparencia.kicker, title: d.transparencia.title, body: d.transparencia.intro, cta: d.cajaCta.ctaSecondary },
    { href: `/${lang}/la-caja#aportar`, kicker: d.aportar.kicker, title: d.aportar.title, body: d.aportar.intro, cta: d.cajaCta.ctaPrimary },
    { href: `/${lang}/tienda`, kicker: d.tienda.kicker, title: d.tienda.title, body: d.tienda.intro, cta: d.cajaCta.ctaTienda },
  ];

  // Prueba de confianza sobre el pliegue: cifras verificadas de config/fondo.ts. Solo se
  // muestran si hay dato real (recaudado != null); si no, no se pinta nada (nunca un relleno).
  const heroStats =
    FONDO.cifras.recaudado === null
      ? null
      : [
          { k: d.transparencia.stats.recaudado, v: euros(FONDO.cifras.recaudado, lang) },
          { k: d.transparencia.stats.saldo, v: euros(saldoDisponible(FONDO.cifras), lang) },
          { k: d.transparencia.stats.aportaciones, v: recuento(FONDO.cifras.aportaciones, lang) },
        ];
  const heroActualizado = FONDO.cifras.actualizado
    ? `${d.transparencia.actualizadoLabel}: ${new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(FONDO.cifras.actualizado))}`
    : null;

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
        pagina="portada"
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

      <Aviso texto={d.caja.aviso} />

      <main id="main" tabIndex={-1}>
        {/* ── HERO DE FIRMA: banda azul + muro de aportaciones ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-confianza)] text-[var(--color-papel-fijo)]">
          <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-16`}>
            <div>
              <p className="kicker !text-[color-mix(in_srgb,var(--color-papel-fijo)_80%,transparent)]">
                {d.cajaCta.kicker}
              </p>
              <MaskText
                as="h1"
                lines={d.cajaCta.title}
                className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
              />
              <Rise>
                <p className="mt-6 max-w-2xl text-lg text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)]">
                  {d.cajaCta.body}
                </p>
              </Rise>
              <Rise>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <MagneticButton
                    href={`/${lang}/la-caja#aportar`}
                    className="inline-block rounded-full bg-[var(--color-acento)] px-8 py-4 font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
                  >
                    {d.cajaCta.ctaPrimary}
                  </MagneticButton>
                  <Link
                    href={`/${lang}/la-caja`}
                    className="rounded-full border border-[var(--color-papel-fijo)] px-8 py-4 font-semibold text-[var(--color-papel-fijo)] transition-colors hover:bg-[var(--color-papel-fijo)] hover:text-[var(--color-confianza)]"
                  >
                    {d.cajaCta.ctaSecondary}
                  </Link>
                </div>
              </Rise>
              {heroStats ? (
                <Rise>
                  <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                    {heroStats.map((s) => (
                      <div key={s.k}>
                        <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_70%,transparent)]">
                          {s.k}
                        </dt>
                        <dd className="mt-1 font-[family-name:var(--ff-mono)] text-3xl font-medium tabular-nums">
                          {s.v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {heroActualizado ? (
                    <p className="mt-3 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_60%,transparent)]">
                      {heroActualizado}
                    </p>
                  ) : null}
                </Rise>
              ) : null}
            </div>
            <MuroAportaciones ariaLabel={d.muro.body} />
          </div>
        </section>

        {/* ── DE DÓNDE VIENE ESTA CAJA · resumen del conflicto + enlace a la web del movimiento ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.origen.kicker}</p>
            <MaskText
              as="h2"
              lines={d.origen.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{d.origen.body}</p>
            </Rise>
            <Rise>
              <a
                href={WEB_MOVIMIENTO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-tinta)] px-7 py-3.5 text-sm font-semibold text-[var(--color-fondo)] transition-opacity hover:opacity-90"
              >
                {d.origen.cta}
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M5 11 11 5M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </Rise>
          </div>
        </section>

        {/* ── ACCESOS: transparencia · aportar · tienda ── */}
        <section className={SECTION}>
          <Stagger className="grid gap-6 md:grid-cols-3">
            {teasers.map((t) => (
              <StaggerItem key={t.href}>
                <Link
                  href={t.href}
                  className="group flex h-full flex-col rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-7 transition-colors hover:border-[var(--color-tinta)]"
                >
                  <p className="kicker">{t.kicker}</p>
                  <h3 className="mt-3 font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                    {t.title}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--color-tinta-suave)]">{t.body}</p>
                  <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
                    {t.cta}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                      <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          {/* Valores en UNA línea; se desarrollan a fondo solo en Gobernanza. */}
          <Rise>
            <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-tinta-suave)]">
              {d.valores.resumen}{" "}
              <Link
                href={`/${lang}/gobernanza`}
                className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)] underline underline-offset-4 hover:text-[var(--color-tinta)]"
              >
                {d.valores.cta}
              </Link>
            </p>
          </Rise>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className={`${SECTION} border-t border-[var(--color-linea)] scroll-mt-24`}>
          <p className="kicker">{d.faq.kicker}</p>
          <MaskText
            as="h2"
            lines={d.faq.title}
            className="mb-8 mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <FaqAccordion items={d.faq.items} />
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
