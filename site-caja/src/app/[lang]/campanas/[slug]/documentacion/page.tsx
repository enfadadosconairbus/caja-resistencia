import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../../../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { FONDO } from "@/config/fondo";
import { Documentacion } from "@/components/documentacion";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * DOCUMENTACIÓN de una campaña — segunda pieza de la fase 2.
 *
 * Todo lo que sostiene el relato: el índice de documentos del grupo, las actas de las
 * asambleas de los seis centros y los informes destacados. 196 ficheros, ~99 MB.
 *
 * DE DÓNDE SALE EL ÍNDICE, que es lo único con truco. El grupo publica a diario un índice
 * en telegra.ph y el SERVIDOR lo baja (`lib/documentos-source.ts`); el navegador del
 * visitante nunca contacta con esa fuente. Si la descarga o el parseo fallan, se sirve el
 * último snapshot bueno del repo y la página no se rompe por una fuente ajena.
 *
 * ⚠️ Ese `fetch` lleva `next: { revalidate: 3600 }`, y el README de vinext NO documenta
 * el `fetch` extendido de Next —sí `unstable_cache` y `"use cache"`—. Si sobre Workers
 * resulta que no cachea, cada visita golpearía telegra.ph: hay que medirlo en el runtime
 * real (`npm run start:vinext`, que levanta wrangler) y, si no cachea, envolver
 * `getDocumentos()` en `unstable_cache`.
 *
 * La mudanza no necesitó ni una cadena nueva: `documentacion` (27 claves) e `informes`
 * (6) ya estaban en los cuatro diccionarios, heredadas al copiar el sitio y sin usarse
 * desde entonces.
 */
export function generateStaticParams() {
  return locales.flatMap((lang) =>
    FONDO.campanas.filter((c) => c.slug).map((c) => ({ lang, slug: c.slug as string })),
  );
}

const buscar = (slug: string) => FONDO.campanas.find((c) => c.slug === slug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const c = buscar(slug);
  if (!c) return {};
  const d = await getDictionary(lang);
  const ficha = d.campanas.fichas[c.clave as keyof typeof d.campanas.fichas];
  const languages = Object.fromEntries(
    locales.map((l) => [l, `/${l}/campanas/${slug}/documentacion`]),
  );
  return {
    title: `${d.documentacion.title} · ${ficha.nombre} · ${d.meta.title}`,
    description: d.documentacion.intro,
    alternates: {
      canonical: `/${lang}/campanas/${slug}/documentacion`,
      languages: { ...languages, "x-default": `/es/campanas/${slug}/documentacion` },
    },
  };
}

export default async function DocumentacionCampana({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const c = buscar(slug);
  if (!c) notFound();

  const d = await getDictionary(lang);
  const ficha = d.campanas.fichas[c.clave as keyof typeof d.campanas.fichas];
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
        pagina="campanas"
        sufijo={`/campanas/${slug}/documentacion`}
        cintillo={
          <ChapaHuelga
            s={d.arranque.chapa}
            hoyISO={hoyEnMadrid}
            inicioISO={ARRANQUE.inicio}
            pausaISO={ARRANQUE.pausa}
            desconvocadaISO={ARRANQUE.desconvocada}
            zona={ARRANQUE.zona}
          />
        }
      />

      <main id="main" tabIndex={-1}>
        <section className={SECTION}>
          <Link
            href={`/${lang}/campanas/${slug}`}
            className="inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)] transition-colors hover:text-[var(--color-acento-tinta)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M8.5 3 4.5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {ficha.nombre}
          </Link>

          <div className="mt-8">
            <Documentacion s={d.documentacion} informes={d.informes} lang={lang} titulo="h1" />
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
