import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../../../dictionaries";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { CoberturaVideo } from "@/components/cobertura-video";
import { FONDO } from "@/config/fondo";
import ARRANQUE from "@/config/arranque-huelga.json";
import COBERTURA from "@/config/cobertura-video.json";
import INTERNACIONAL from "@/config/internacional.json";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * PRENSA Y SOLIDARIDAD de una campaña — cuarta y última pieza de la fase 2.
 *
 * Reúne lo que quedaba en la Web A: los diez cortes de informativos y la solidaridad
 * internacional (cuatro comunicados y el mensaje de Marignane). Con esto la ficha de la
 * campaña ya no manda a ningún sitio de fuera.
 *
 * NO SE ALOJA METRAJE. El copyright es de las cadenas y el presupuesto de bytes no daría
 * (D-32). Cada corte de YouTube va con un facade: carátula estática auto-alojada
 * (`public/img/cobertura/`, 264 KB los nueve) y CERO contacto con Google hasta que el
 * visitante pulsa play; entonces, y solo entonces, se monta el iframe de youtube-nocookie.
 * Los de reproductor propio no se pueden embeber y van como tarjeta con enlace a su origen.
 *
 * El vídeo internacional va aparte y al final, con los comunicados: es un mensaje de un
 * obrero de Airbus Marignane al piquete de Madrid, no cobertura de un informativo. Esa
 * separación la pidió la coordinación en la Web A y se respeta aquí.
 *
 * Coste real de la mudanza: cero cadenas nuevas para el cuerpo. `coberturaVideo` (8 claves)
 * e `internacional` (6) ya estaban en los cuatro diccionarios, heredadas al copiar el sitio
 * y sin usarse desde entonces. El componente tampoco necesitó retoque: ya hablaba en
 * tokens, así que habla SEÑAL.
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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/campanas/${slug}/prensa`]));
  return {
    title: `${d.campanas.prensaTitulo} · ${ficha.nombre} · ${d.meta.title}`,
    description: d.coberturaVideo.intro,
    alternates: {
      canonical: `/${lang}/campanas/${slug}/prensa`,
      languages: { ...languages, "x-default": `/es/campanas/${slug}/prensa` },
    },
  };
}

export default async function PrensaCampana({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const c = buscar(slug);
  if (!c) notFound();

  const d = await getDictionary(lang);
  const s = d.campanas;
  const cv = d.coberturaVideo;
  const int = d.internacional;
  const ficha = s.fichas[c.clave as keyof typeof s.fichas];

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
        sufijo={`/campanas/${slug}/prensa`}
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
        {/* ── COBERTURA EN VÍDEO ── */}
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

          <p className="kicker mt-8">{cv.kicker}</p>
          <h1 className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
            {cv.title.map((line, i) => (
              <span key={i} className="mask-rise block" style={{ animationDelay: `${i * 0.08}s` }}>
                {line}
              </span>
            ))}
          </h1>
          <p
            className="rise-in mt-6 max-w-3xl text-[var(--color-tinta-suave)]"
            style={{ animationDelay: "0.2s" }}
          >
            {cv.intro}
          </p>

          <CoberturaVideo cortes={COBERTURA.cortes} lang={lang} s={cv} />

          <p className="mt-8 max-w-3xl font-[family-name:var(--ff-mono)] text-xs leading-relaxed text-[var(--color-tinta-suave)]">
            {cv.fuente}
          </p>
        </section>

        {/* ── SOLIDARIDAD INTERNACIONAL ──
            En la Web A era una sección de la portada. Viene entera, con su llamada y sus
            cuatro comunicados: son organizaciones que se pusieron de nuestro lado, y esta es
            la única página de la Web B donde eso está contado. */}
        <section className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{int.kicker}</p>
            <h2 className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-4xl">
              {int.title}
            </h2>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{int.body}</p>

            {/* «Contacto para organizaciones» → buzón de la WEB (`redes.emailWeb`), no el
                correo histórico de los iconos: una organización que escribe por la web no es
                lo mismo que la plantilla escribiendo al canal de siempre. Va al mail directo
                porque lo pidió la coordinación (11-ago-2026); antes llevaba a
                /la-caja#donantes, que se queda como red de seguridad para no dejar un botón
                muerto si algún día no hubiera correo. */}
            <div className="mt-8">
              {FONDO.redes.emailWeb ? (
                <a
                  href={`mailto:${FONDO.redes.emailWeb}`}
                  className="inline-block rounded-full bg-[var(--color-confianza)] px-6 py-3 text-sm font-semibold text-[var(--color-papel-fijo)] transition-colors hover:bg-[var(--color-tinta-fija)]"
                >
                  {int.ctaContact}
                </a>
              ) : (
                <Link
                  href={`/${lang}/la-caja#donantes`}
                  className="inline-block rounded-full bg-[var(--color-confianza)] px-6 py-3 text-sm font-semibold text-[var(--color-papel-fijo)] transition-colors hover:bg-[var(--color-tinta-fija)]"
                >
                  {int.ctaContact}
                </Link>
              )}
            </div>

            {/* Comunicados internacionales de solidaridad.
                `min-w-0` en el <li>, no solo en el titular: un elemento de grid vale
                `min-width: auto`, o sea que se dimensiona al `min-content` de lo que lleva
                dentro, y el titular va en `nowrap` por `truncate` — su `min-content` es el
                texto ENTERO. Sin esto la pista crece y el recorte no llega a actuar nunca. */}
            <div className="mt-12">
              <p className="kicker">{int.comunicadosLabel}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {INTERNACIONAL.comunicados.map((com) => (
                  <li key={com.pdf} className="min-w-0">
                    <a
                      href={com.pdf}
                      download
                      className="group flex items-center gap-3 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-4 py-3 transition-colors hover:border-[var(--color-tinta)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">
                        {com.titulo}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                        {com.meta}
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                        className="shrink-0 text-[var(--color-acento-tinta)]"
                      >
                        <path
                          d="M10 3v10m0 0 4-4m-4 4-4-4M3 16h14"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {COBERTURA.internacional.length > 0 ? (
              <div className="mt-12">
                <p className="kicker">{cv.internacionalLabel}</p>
                <CoberturaVideo cortes={COBERTURA.internacional} lang={lang} s={cv} columnas={2} />
              </div>
            ) : null}
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
