import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { Merchandising } from "@/components/merchandising";
import { MaskText, Rise } from "@/components/motion";
import { FONDO } from "@/config/fondo";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/** TIENDA — segunda página. El merchandising ya no compite con el conflicto en la portada. */

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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/tienda`]));
  return {
    title: `${d.tienda.metaTitle} · ${d.meta.title}`,
    description: d.tienda.metaDescription,
    alternates: { canonical: `/${lang}/tienda`, languages: { ...languages, "x-default": "/es/tienda" } },
  };
}

export default async function TiendaPagina({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ pago?: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);
  const { pago } = await searchParams;
  const hoyEnMadrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARRANQUE.zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

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
        pagina="tienda"
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
        <section id="tienda" className={SECTION}>
          <Link
            href={`/${lang}`}
            className="mb-8 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)] transition-colors hover:text-[var(--color-acento-tinta)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M8.5 3 4.5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {d.tienda.volver}
          </Link>
          <p className="kicker mt-8">{d.tienda.kicker}</p>
          <MaskText
            as="h1"
            lines={d.tienda.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
          />
          <Rise>
            <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{d.tienda.intro}</p>
          </Rise>

          {pago === "ok" || pago === "cancelado" ? (
            <div
              role="status"
              className={`mt-8 max-w-3xl rounded-xl border p-5 ${
                pago === "ok"
                  ? "border-[var(--color-confianza)] bg-[var(--color-superficie)]"
                  : "border-[var(--color-linea)] bg-[var(--color-fondo)]"
              }`}
            >
              <p className="font-[family-name:var(--ff-display)] text-lg font-bold">
                {pago === "ok" ? d.tienda.pago.okTitulo : d.tienda.pago.canceladoTitulo}
              </p>
              <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
                {pago === "ok" ? d.tienda.pago.okTexto : d.tienda.pago.canceladoTexto}
              </p>
              <Link
                href={`/${lang}/tienda`}
                className="mt-3 inline-block font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)] underline underline-offset-4"
              >
                {d.tienda.pago.cerrar}
              </Link>
            </div>
          ) : null}

          <Merchandising s={d.tienda} lang={lang} />
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
