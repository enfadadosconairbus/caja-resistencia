import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { FONDO, euros } from "@/config/fondo";
import { MaskText } from "@/components/motion";
import { Revelar, RevelarLista, RevelarItem } from "@/components/revelar";
import { TarjetaCampana } from "@/components/campana-ficha";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * CAMPAÑAS — el archivo de luchas que ha sostenido la caja.
 *
 * Es la sección que convierte esto en una caja PERMANENTE en vez de en la web de una
 * huelga. Sin ella, cuando acabe el conflicto de 2026 la portada se queda sin nada que
 * decir; con ella, el conflicto de turno pasa a ser contenido y la caja es el sujeto.
 *
 * Dos reglas de esta sección, las dos con su porqué en `config/fondo.ts`:
 *
 *   · Una campaña dice lo que COSTÓ, no lo que recaudó. Los ingresos son acumulados y no
 *     se atribuyen: quien transfiere no dice a qué lucha va.
 *   · Las previstas salen sin fechas y sin cifras. Están porque contestan la pregunta de
 *     quien aporta hoy —¿para qué sigue abierta la caja si la huelga está en pausa?—, no
 *     para anunciar un calendario que la asamblea no ha aprobado.
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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/campanas`]));
  return {
    title: `${d.campanas.title} · ${d.meta.title}`,
    description: d.campanas.intro,
    alternates: {
      canonical: `/${lang}/campanas`,
      languages: { ...languages, "x-default": "/es/campanas" },
    },
  };
}

export default async function Campanas({
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

  const s = d.campanas;
  // El acumulado solo se enuncia si hay dato verificado, y cuenta las campañas REALES:
  // decir «en 3 campañas» incluyendo las que todavía no existen sería inflar el historial.
  const reales = FONDO.campanas.filter((c) => c.estado !== "prevista");
  // Singular y plural en frases aparte, no un «1 campaña(s)»: son cuatro idiomas y cada
  // uno pluraliza a su manera. Hoy hay una sola campaña real, así que esta rama es la que
  // se ve — y es justo la que se habría quedado sin revisar.
  const acumulado =
    FONDO.cifras.recaudado === null
      ? null
      : (reales.length === 1 ? s.acumuladoUna : s.acumulado)
          .replace("{recaudado}", euros(FONDO.cifras.recaudado, lang))
          .replace("{n}", String(reales.length));

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
            <p className="kicker">{s.kicker}</p>
            <MaskText
              as="h1"
              immediate
              lines={s.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
            />
            <Revelar>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{s.intro}</p>
            </Revelar>
            {acumulado ? (
              <Revelar>
                <p className="mt-6 max-w-3xl font-[family-name:var(--ff-mono)] text-sm leading-relaxed text-[var(--color-tinta)]">
                  {acumulado}
                </p>
              </Revelar>
            ) : null}
          </div>
        </section>

        <section className={SECTION}>
          <RevelarLista className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FONDO.campanas.map((c) => (
              <RevelarItem key={c.clave} className="h-full">
                <TarjetaCampana
                  c={c}
                  s={s}
                  lang={lang}
                  etiquetasGasto={d.transparencia.detalle as Record<string, string>}
                />
              </RevelarItem>
            ))}
          </RevelarLista>

          {/* La frase que explica por qué hay campañas previstas y por qué se puede aportar
              sin que haya huelga. Es el argumento de la permanencia, y va al final para que
              se lea DESPUÉS de haber visto las tres tarjetas. */}
          <Revelar>
            <p className="mt-12 max-w-2xl border-l-2 border-[var(--color-acento-tinta)] pl-5 text-[var(--color-tinta-suave)]">
              {s.permanente}
            </p>
          </Revelar>
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
