import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../../../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import HITOS from "@/config/hitos.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { FONDO } from "@/config/fondo";
import { MaskText } from "@/components/motion";
import { Revelar } from "@/components/revelar";
import { SenderoCronologia } from "@/components/sendero-cronologia";
import { LineaTemporal, type Hito } from "@/components/linea-temporal";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * CRONOLOGÍA de una campaña — primera pieza de la fase 2, la mudanza de la Web A.
 *
 * Se trajo entera del sitio del movimiento: los 66 hitos ya traducidos a los cuatro
 * idiomas, los dos componentes que los pintan y los 32 PDFs que citan. NO se trajeron los
 * otros 209 documentos: la cronología solo necesita 11,2 MB de los 152, y traer el resto
 * antes de tener la sección de Documentación sería mover peso sin contenido que lo use.
 *
 * Dos cosas que hicieron la mudanza más barata de lo que decía el plan:
 *
 *   · Los componentes ya hablan SEÑAL. Usan siete tokens —`tinta`, `tinta-suave`, `linea`,
 *     `acento-tinta`, `fondo`, `confianza-tinta`, `superficie`— y los siete existen aquí
 *     con los valores de la paleta nueva. No hubo que repintar nada.
 *   · Las cadenas de `cronologia` ya estaban en los diccionarios: se heredaron al copiar el
 *     sitio y llevaban desde entonces sin usarse. Vocabulario muerto que revive.
 *
 * Lo único que se cambió: `next/image` por `<img>`, porque esta web no usa `next/image` en
 * ningún sitio y sobre Workers necesitaría un loader propio.
 *
 * A diferencia de la Web A, aquí la cronología NO va plegada. Allí compartía portada con
 * todo lo demás y sus 2.500 px de alto pedían un `<details>`; aquí la página ES la
 * cronología, y plegar lo que alguien ha venido a ver es ponerle una puerta a un campo.
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
    locales.map((l) => [l, `/${l}/campanas/${slug}/cronologia`]),
  );
  return {
    title: `${d.cronologia.title} · ${ficha.nombre} · ${d.meta.title}`,
    description: d.cronologia.intro,
    alternates: {
      canonical: `/${lang}/campanas/${slug}/cronologia`,
      languages: { ...languages, "x-default": `/es/campanas/${slug}/cronologia` },
    },
  };
}

export default async function CronologiaCampana({
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
  // «Hoy» lo fija el servidor: si lo calculara el cliente no casaría al hidratar.
  const hoyISO = new Date().toISOString().slice(0, 10);

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
        sufijo={`/campanas/${slug}/cronologia`}
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
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
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
            <p className="kicker mt-8">{d.cronologia.kicker}</p>
            <MaskText
              as="h1"
              immediate
              lines={d.cronologia.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
            />
            <Revelar>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">
                {d.cronologia.intro}
              </p>
            </Revelar>
          </div>
        </section>

        <section className={SECTION}>
          {/* Sendero serpenteante en pantalla ancha; por debajo de `xl`, el mismo relato
              sobre un raíl recto. Serpentear necesita dos carriles separados, y buena parte
              de la plantilla entra desde el móvil. */}
          <SenderoCronologia
            hitos={HITOS.hitos as Hito[]}
            hoyISO={hoyISO}
            lang={lang}
            s={d.cronologia}
          />
          <div className="xl:hidden">
            <LineaTemporal
              hitos={HITOS.hitos as Hito[]}
              hoyISO={hoyISO}
              lang={lang}
              s={d.cronologia}
            />
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
