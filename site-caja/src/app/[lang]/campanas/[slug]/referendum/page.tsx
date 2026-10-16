import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../../../dictionaries";
import { SITE_URL } from "@/lib/site-url";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { GuiaReferendum } from "@/components/guia-referendum";
import { FONDO } from "@/config/fondo";
import ARRANQUE from "@/config/arranque-huelga.json";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * GUÍA DE LA PROPUESTA · referéndum. Tercera pieza de la fase 2.
 *
 * Repasa punto por punto la «propuesta de acuerdo» que vota la plantilla: qué plantea, qué
 * falta por concretar y por qué importa. Tono informativo; no pide el voto.
 *
 * Es la página más perecedera de la mudanza: el referéndum se vota el 30 de septiembre y el
 * 1 de octubre de 2026. Después sigue teniendo sentido —como registro de qué se votaba—,
 * pero el `estado` del hero habrá que cambiarlo.
 *
 * Se trajo entera de la Web A con dos cambios: cuelga de la campaña en vez de la raíz, y
 * `--color-tinta-fija` volvió a la paleta para su banda negra (se había retirado al aplicar
 * SEÑAL porque no la usaba nadie).
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
  if (!buscar(slug)) return {};
  const d = await getDictionary(lang);
  const languages = Object.fromEntries(
    locales.map((l) => [l, `/${l}/campanas/${slug}/referendum`]),
  );
  return {
    metadataBase: new URL(SITE_URL),
    title: d.referendum.meta.title,
    description: d.referendum.meta.description,
    alternates: {
      canonical: `/${lang}/campanas/${slug}/referendum`,
      languages: { ...languages, "x-default": `/es/campanas/${slug}/referendum` },
    },
  };
}

export default async function ReferendumCampana({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const c = buscar(slug);
  if (!c) notFound();

  const d = await getDictionary(lang);
  const r = d.referendum;
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
        sufijo={`/campanas/${slug}/referendum`}
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

            {/* Sin paleta local: esta pagina habla SEÑAL como el resto. La Web A la pintaba de
          azul («same-sky») porque alli el sitio era papel y una pagina oscura contrastaba;
          aqui el sitio YA es oscuro, asi que el cambio no aportaria nada y costaria
          coherencia. */}
      <main id="main" tabIndex={-1}>
        {/* ── HERO ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-tinta-fija)] text-[var(--color-papel-fijo)]">
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24 md:pt-20">
            {/* Vuelta a la campaña. En la Web A esta página colgaba de la raíz y su enlace
                de vuelta estaba comentado; aquí es una hija y tiene que poder volver, como
                la cronología y la documentación. Va en papel fijo porque la banda es negra
                fija: la tinta suave se invierte con el tema y aquí desaparecería. */}
            <Link
              href={`/${lang}/campanas/${slug}`}
              className="mb-8 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_72%,transparent)] transition-colors hover:text-[var(--color-papel-fijo)]"
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
            <p className="kicker !text-[var(--color-acento-fijo)]">{r.hero.kicker}</p>
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
