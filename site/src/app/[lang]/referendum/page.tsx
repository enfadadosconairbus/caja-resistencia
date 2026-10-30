import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SITE_URL } from "@/lib/site-url";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { GuiaReferendum } from "@/components/guia-referendum";
import { FONDO } from "@/config/fondo";
import ARRANQUE from "@/config/arranque-huelga.json";

const SECTION = "mx-auto max-w-6xl px-5 py-16 md:py-24";

/**
 * Paleta «fresca» (azul profundo + cielo) tomada de
 * public/docs/same-sky-different-pay-es.html. Se aplica SOLO al contenido de la guía
 * (el <main>) redefiniendo los tokens de color; la barra y el pie mantienen el tema del
 * sitio. El acento de relleno usa un azul algo más hondo que el «sky» para que el texto
 * blanco de los botones mantenga contraste AA.
 */
const PALETA_FRESCA = {
  "--color-fondo": "#0B1626",
  "--color-superficie": "#13233B",
  "--color-tinta": "#F4F8FF",
  "--color-tinta-suave": "#9FB3CE",
  "--color-linea": "#24395C",
  "--color-acento": "#1E6FD0",
  "--color-acento-hondo": "#1559A8",
  "--color-acento-tinta": "#4EA3FF",
  "--color-tinta-fija": "#0B1626",
  "--color-papel-fijo": "#F4F8FF",
  "--color-confianza-tinta": "#4EA3FF",
} as unknown as CSSProperties;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const d = await getDictionary(lang);
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/referendum`]));
  return {
    metadataBase: new URL(SITE_URL),
    title: d.referendum.meta.title,
    description: d.referendum.meta.description,
    alternates: {
      canonical: `/${lang}/referendum`,
      languages: { ...languages, "x-default": "/es/referendum" },
    },
  };
}

/**
 * GUÍA DE LA PROPUESTA · referéndum. Página dedicada que repasa punto por punto la
 * «propuesta de acuerdo» que vota la plantilla: qué plantea, qué falta por concretar y por
 * qué importa. Se enlaza desde el hero de ÚLTIMAS NOTICIAS de la portada. Tono informativo,
 * reivindicativo suavizado; no pide el voto.
 */
export default async function Referendum({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);
  const r = d.referendum;

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
        pagina="referendum"
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

      {/* La guía adopta la paleta «fresca» de same-sky, acotada a su propio contenido. */}
      <main id="main" tabIndex={-1} style={PALETA_FRESCA} className="bg-[var(--color-fondo)] text-[var(--color-tinta)]">
        {/* ── HERO ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-tinta-fija)] text-[var(--color-papel-fijo)]">
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24 md:pt-20">
            <p className="kicker !text-[var(--color-acento-tinta)]">{r.hero.kicker}</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              {r.hero.titulo.map((line, i) => (
                <span key={i} className="mask-rise block" style={{ animationDelay: `${i * 0.08}s` }}>
                  {line}
                </span>
              ))}
            </h1>
            <p
              className="rise-in mt-6 max-w-3xl text-lg leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_88%,transparent)] md:text-xl"
              style={{ animationDelay: "0.25s" }}
            >
              {r.hero.intro}
            </p>

            {/* Estado de la votación */}
            <div
              className="rise-in mt-8 max-w-3xl rounded-xl border border-white/12 p-5"
              style={{ animationDelay: "0.35s" }}
            >
              <p className="font-[family-name:var(--ff-mono)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-acento-tinta)]">
                {r.estado.etiqueta}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_85%,transparent)]">
                {r.estado.texto}
              </p>
            </div>

            <div className="rise-in mt-8" style={{ animationDelay: "0.45s" }}>
              <a
                href="#guia"
                className="inline-block rounded-full bg-[var(--color-acento)] px-8 py-4 font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
              >
                {r.hero.cta}
              </a>
            </div>
          </div>
        </section>

        {/* ── LA PREGUNTA CENTRAL ── */}
        <section className={SECTION}>
          <p className="kicker">{r.preguntaCentral.kicker}</p>
          <h2 className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
            {r.preguntaCentral.titulo}
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-lg text-[var(--color-tinta-suave)]">
            {r.preguntaCentral.cuerpo.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── GUÍA INTERACTIVA · 14 PUNTOS ── */}
        <section id="guia" className="scroll-mt-24 border-t border-[var(--color-linea)] bg-[var(--color-fondo)]">
          <div className={SECTION}>
            <p className="kicker">{r.guia.kicker}</p>
            <h2 className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
              {r.guia.titulo}
            </h2>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{r.guia.intro}</p>
            <div className="mt-10">
              <GuiaReferendum
                puntos={r.guia.puntos}
                s={{
                  todos: r.guia.filtros.todos,
                  categorias: r.guia.filtros.categorias,
                  mostrando: r.guia.filtros.mostrando,
                  puntosLabel: r.guia.filtros.puntosLabel,
                  bloques: r.guia.bloques,
                }}
              />
            </div>
          </div>
        </section>

        {/* ── ANTES DE VOTAR ── */}
        <section className={`${SECTION} border-t border-[var(--color-linea)]`}>
          <p className="kicker">{r.antesDeVotar.kicker}</p>
          <h2 className="mb-8 mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
            {r.antesDeVotar.titulo}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {r.antesDeVotar.items.map((it) => (
              <div key={it.q} className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
                <h3 className="font-[family-name:var(--ff-display)] text-lg font-bold leading-snug text-[var(--color-tinta)]">
                  {it.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-tinta-suave)]">{it.a}</p>
              </div>
            ))}
          </div>
        </section>
        {/* CIERRE «Una decisión informada» + Compartir/Imprimir: RETIRADO (petición de la coordinación).
            Se conserva solo la nota de independencia, como línea discreta al pie.
            Los strings r.cierre / r.volver quedan en los diccionarios por si se recupera. */}
        <div className="mx-auto max-w-6xl px-5 pb-16">
          <p className="max-w-3xl font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[var(--color-tinta-suave)]">
            {r.nota}
          </p>
        </div>
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
