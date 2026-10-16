import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "./dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { FaqAccordion } from "@/components/faq-accordion";
import { MuroAportaciones } from "@/components/muro-aportaciones";
import { APORTACION_ONLINE, FONDO, euros, recuento, saldoDisponible } from "@/config/fondo";
import { MaskText, Rise, Stagger, StaggerItem, MagneticButton } from "@/components/motion";
// El HERO usa reveals en CSS (`revelar.tsx`): es lo que está sobre el pliegue y lo que
// mide el LCP, así que no puede esperar a que hidrate React. Bajo el pliegue se queda
// `Rise`/`Stagger`, que revelan al hacer scroll — ahí la coreografía sí vale lo que cuesta.
import { Revelar } from "@/components/revelar";
import { Cartel } from "@/components/cartel";
import { Polvo } from "@/components/polvo";
import { UltimaHoraImagen } from "@/components/ultima-hora-imagen";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * Cobertura de prensa de la última hora (levantamiento de las cautelares y nueva
 * convocatoria del referéndum para el 30-sep y 1-oct, 24-sep-2026).
 * Los enlaces no dependen del idioma; la etiqueta del panel vive en el diccionario.
 */
const PRENSA_ULTIMA_HORA: { medio: string; url: string; fecha: string }[] = [
  {
    medio: "ABC",
    url: "https://www.abc.es/economia/sindicatos-desconvocan-huelga-airbus-tras-apoyo-mayoritario-20261005193333-nt.html",
    fecha: "2026-10-05",
  },
  {
    medio: "Cinco Días",
    url: "https://cincodias.elpais.com/companias/2026-10-05/el-comite-de-huelga-desconvoca-el-paro-de-la-plantilla-de-airbus-tras-la-validacion-del-preacuerdo-laboral.html",
    fecha: "2026-10-05",
  },
  {
    // Es del 2-oct (cuenta el fin del conflicto; aún no la desconvocatoria formal).
    medio: "Industry Talks",
    url: "https://industrytalks.es/fin-al-conflicto-laboral-en-airbus-los-empleados-aceptan-la-ultima-propuesta-y-zanjan-tres-meses-de-paros/",
    fecha: "2026-10-02",
  },
  {
    medio: "Cinco Días",
    url: "https://cincodias.elpais.com/companias/2026-10-01/la-plantilla-de-airbus-en-espana-valida-el-preacuerdo-laboral-de-industria-y-pone-fin-a-la-huelga.html",
    fecha: "2026-10-01",
  },
  {
    medio: "Press Digital",
    url: "https://www.pressdigital.es/articulo/economia/2026-10-01/6036267-plantilla-airbus-acepta-mayoria-ultima-propuesta-poner-fin-conflicto-espana",
    fecha: "2026-10-01",
  },
  {
    medio: "Artículo 14",
    url: "https://www.articulo14.es/economia/los-trabajadores-de-airbus-avalan-el-acuerdo-laboral-que-la-empresa-alcanzo-con-industria-20261001.html",
    fecha: "2026-10-01",
  },
];

/**
 * PORTADA de la web de la CAJA (Web B).
 *
 * Objetivo: entender el conflicto y decidir cómo ayudar. Abre con la actualidad que trae la
 * Web A (últimas noticias + estado de la negociación) y, debajo, la banda azul de firma +
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
    { href: `/${lang}/material`, kicker: d.tienda.kicker, title: d.tienda.title, body: d.tienda.intro, cta: d.cajaCta.ctaTienda },
  ];

  // Prueba de confianza sobre el pliegue: cifras verificadas de config/fondo.ts. Solo se
  // muestran si hay dato real (recaudado != null); si no, no se pinta nada (nunca un relleno).
  const heroStats =
    FONDO.cifras.recaudado === null
      ? null
      : [
          // `senal` pinta la cifra en el teal, igual que en Transparencia: solo el saldo
          // disponible, que es el que contesta «¿cuánto queda?».
          { k: d.transparencia.stats.recaudado, v: euros(FONDO.cifras.recaudado, lang), senal: false },
          { k: d.transparencia.stats.saldo, v: euros(saldoDisponible(), lang), senal: true },
          { k: d.transparencia.stats.aportaciones, v: recuento(FONDO.cifras.aportaciones, lang), senal: false },
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
            desconvocadaISO={ARRANQUE.desconvocada}
            zona={ARRANQUE.zona}
          />
        }
      />

      <main id="main" tabIndex={-1}>
        {/* ── ÚLTIMAS NOTICIAS · traída de la Web A (1-oct-2026), por encima del estado de la
            negociación y de la banda azul. Es COPIA: al actualizar la noticia en la Web A hay
            que actualizarla aquí (diccionarios `ultimasNoticias` y PRENSA_ULTIMA_HORA). En la
            Web B la guía del referéndum vive dentro de la campaña, no en /referendum. ──
            18-sep-2026: la Sala de lo Social de la Audiencia Nacional suspende, en
            cautelarísimas, el referéndum del 24-25 de septiembre. Misma banda oscura que
            la negociación (pizarra con grano y polvo / papel-fijo) para que las dos lean como un
            bloque. */}
        {/* 1-oct-2026: la plantilla aprueba el acuerdo en referéndum (87,33 % de participación;
            76,76 % sí, 20,26 % no, 2,98 % abstenciones). Esta banda pasa a contarlo, con la
            infografía del movimiento, y «Estado de la negociación» se retira de la portada: la
            negociación terminó. El componente y su config siguen en el repo, sin usar. */}
        <section
          id="ultimas-noticias"
          className="grano overflow-hidden border-b border-[var(--color-linea)] bg-[var(--color-pizarra)] text-[var(--color-papel-fijo)]"
        >
          <Polvo />
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-14 md:pt-20 md:pb-20">
            {/* Cabecera a dos columnas: a la izquierda el titular; a la derecha, en el
                hueco que quedaba, los enlaces a la cobertura de prensa de esta noticia. */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="kicker !mb-0 flex items-center gap-2 !text-[var(--color-acento-fijo)]">
                    {/* Punto pulsante: señal de «última hora» con el acento de la marca. */}
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-acento)] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-acento)]" />
                    </span>
                    {d.ultimasNoticias.kicker}
                  </p>
                  <span className="font-[family-name:var(--ff-mono)] text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_55%,transparent)]">
                    {d.ultimasNoticias.fecha} · {d.ultimasNoticias.enDirecto}
                  </span>
                </div>

                <h2 className="mt-4 max-w-4xl font-[family-name:var(--ff-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  {d.ultimasNoticias.titulo.map((line, i) => (
                    <span key={i} className="mask-rise block" style={{ animationDelay: `${i * 0.08}s` }}>
                      {line}
                    </span>
                  ))}
                </h2>

                <p
                  className="rise-in mt-6 max-w-3xl text-lg leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_88%,transparent)] md:text-xl"
                  style={{ animationDelay: "0.25s" }}
                >
                  {d.ultimasNoticias.entradilla}
                </p>
                {/* 5-oct-2026: desconvocatoria formal. Párrafo propio, con raya de acento, para
                    que se lea como lo último que ha pasado sin tapar el resultado del referéndum. */}
                <p
                  className="rise-in mt-5 max-w-3xl border-l-2 border-[var(--color-acento-fijo)] pl-4 text-base font-semibold leading-relaxed text-[var(--color-papel-fijo)] md:text-lg"
                  style={{ animationDelay: "0.3s" }}
                >
                  {d.ultimasNoticias.desconvocatoria}
                </p>
              </div>

              {/* En la prensa · enlaces externos (nueva pestaña) a la cobertura de la noticia. */}
              <aside className="rise-in lg:pt-1" style={{ animationDelay: "0.3s" }}>
                <p className="kicker !mb-0 !text-[var(--color-acento-fijo)]">{d.ultimasNoticias.enPrensa}</p>
                <ul className="mt-4 space-y-2">
                  {PRENSA_ULTIMA_HORA.map((f) => (
                    <li key={f.url}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-3 rounded-lg border border-white/12 px-4 py-3 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
                      >
                        <span className="text-sm font-medium text-[var(--color-papel-fijo)]">
                          {f.medio}
                          <span className="ml-2 font-[family-name:var(--ff-mono)] text-[11px] font-normal text-[color-mix(in_srgb,var(--color-papel-fijo)_65%,transparent)]">
                            {new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(f.fecha))}
                          </span>
                        </span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="shrink-0 text-[var(--color-acento-fijo)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        >
                          <path d="M7 17 17 7M8 7h9v9" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            {/* ── EL JUICIO DEL 4-N · lo que queda por resolver ──
                Va justo debajo del titular y por ENCIMA de la infografía a propósito: el
                acuerdo cierra la negociación, no el recorrido judicial, y eso tiene que leerse
                antes que el detalle de lo pactado. La fecha grande hace de ancla visual. */}
            <section
              aria-labelledby="juicio-4n"
              className="rise-in mt-10 rounded-xl border border-[color-mix(in_srgb,var(--color-acento-fijo)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-acento-fijo)_8%,transparent)] p-6 md:p-8"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-10">
                <p className="flex items-baseline gap-3 text-[var(--color-acento-fijo)] md:block" aria-hidden="true">
                  <span className="block font-[family-name:var(--ff-display)] text-6xl font-extrabold leading-none md:text-7xl">
                    {d.ultimasNoticias.juicio.dia}
                  </span>
                  <span className="block font-[family-name:var(--ff-mono)] text-xs font-semibold uppercase tracking-wider md:mt-2">
                    {d.ultimasNoticias.juicio.mes}
                  </span>
                </p>
                <div>
                  <p className="kicker !mb-0 !text-[var(--color-acento-fijo)]">{d.ultimasNoticias.juicio.kicker}</p>
                  <h3
                    id="juicio-4n"
                    className="mt-3 font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight md:text-3xl"
                  >
                    {d.ultimasNoticias.juicio.titulo}
                  </h3>
                  {d.ultimasNoticias.juicio.texto.map((parrafo, i) => (
                    <p
                      key={i}
                      className="mt-3 max-w-3xl text-base leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_88%,transparent)] md:text-lg"
                    >
                      {parrafo}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            {/* Ilustración de última hora (encargo del cliente, 24-sep). A sangre sobre la
                banda oscura, con clic-para-ampliar y descarga como las infografías. */}
            {/* El CTA a la guía va superpuesto en la esquina superior de la ilustración
                (zona libre del cartel), no como botón aparte debajo. */}
            <UltimaHoraImagen
              src="/img/ultima-hora-acuerdo-aprobado.webp"
              alt={d.ultimasNoticias.imagenAlt}
              descarga="acuerdo-aprobado-en-referendum.webp"
              ampliarLabel={d.ultimasNoticias.ampliar}
              descargarLabel={d.ultimasNoticias.descargar}
              cerrarLabel={d.ultimasNoticias.cerrar}
            />
            {/* 1-oct-2026: fuera el botón a la guía, las cuatro claves del acuerdo y la nota
                de pie (petición de la coordinación: «ya no aplica»). La banda termina en la infografía.
                Las cadenas `guiaCta`, `puntos` y `nota` siguen en los diccionarios. */}
          </div>
        </section>


        {/* ── HERO DE FIRMA: banda azul + muro de aportaciones ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-confianza)] text-[var(--color-papel-fijo)]">
          <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-16`}>
            <div>
              <p className="kicker !text-[color-mix(in_srgb,var(--color-papel-fijo)_80%,transparent)]">
                {d.cajaCta.kicker}
              </p>
              {/* `immediate`: reveal en CSS puro. Sin él, framer sirve el titular con
                  `transform:translateY(115%)` dentro de un `overflow-hidden` y el H1 no
                  existe hasta que hidrata — ni para quien tenga JS bloqueado, ni para el
                  LCP. Es la rama que `globals.css` documenta como «sin JS, el texto es
                  visible igualmente». (26-sep-2026) */}
              <MaskText
                as="h1"
                immediate
                lines={d.cajaCta.title}
                className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
              />
              <Revelar>
                <p className="mt-6 max-w-2xl text-lg text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)]">
                  {d.cajaCta.body}
                </p>
              </Revelar>
              <Revelar>
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
              </Revelar>
              {heroStats ? (
                <Revelar>
                  {/* Mismo sistema de tarjetas que las cuatro de Transparencia, pero medido
                    contra la banda azul en vez de contra el lienzo: relleno de papel al 8 %
                    (separa 1,25:1 de la banda, igual que aquellas separan 1,23:1 del suyo) y
                    borde al 26 % (1,69:1). Las cifras dan 8,91:1 y los rótulos 5,30:1. Los
                    tokens son FIJOS porque la banda no cambia con el tema. */}
                  <dl className="mt-10 grid gap-3 sm:grid-cols-3">
                    {heroStats.map((s) => (
                      <div
                        key={s.k}
                        className="rounded-xl border border-[color-mix(in_srgb,var(--color-papel-fijo)_26%,transparent)] bg-[color-mix(in_srgb,var(--color-papel-fijo)_8%,transparent)] px-5 py-4"
                      >
                        <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_70%,transparent)]">
                          {s.k}
                        </dt>
                        <dd
                          className={`mt-1 font-[family-name:var(--ff-mono)] text-3xl font-medium tabular-nums ${
                            s.senal ? "text-[var(--color-senal-fijo)]" : ""
                          }`}
                        >
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
                </Revelar>
              ) : null}
            </div>
            <MuroAportaciones
              aportaciones={FONDO.cifras.aportaciones}
              s={d.muro}
              lang={lang}
            />
          </div>
        </section>

        {/* Cartel de campaña — el mismo que abre la web del movimiento. Va aquí, bajo el
            hero, y no encima: medido a 1440×900, el botón de Aportar acaba en 667 px y
            metiendo la imagen delante se iría fuera de pantalla. Ver `cartel.tsx`. */}
        <Cartel alt={d.cartel.alt} />

        {/* ── DE DÓNDE VIENE ESTA CAJA · resumen del conflicto + enlace a la campaña que lo origina ── */}
        <section className="border-b border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.origen.kicker}</p>
            <MaskText
              immediate
                as="h2"
              lines={d.origen.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{d.origen.body}</p>
            </Rise>
            <Rise>
              {/* Lleva a la campaña que originó el conflicto, dentro de esta web: ya no sale
                  a la del movimiento. Por eso la flecha es de avance y no la de «sale fuera». */}
              <Link
                href={`/${lang}/campanas/huelga-2026`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-tinta)] px-7 py-3.5 text-sm font-semibold text-[var(--color-fondo)] transition-opacity hover:opacity-90"
              >
                {d.origen.cta}
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
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
            immediate
                as="h2"
            lines={d.faq.title}
            className="mb-8 mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          {/* `{max}` es el tope del pago online: sale de fondo.ts para que la respuesta sobre
              grandes donantes no se quede atrás si cambia. */}
          <FaqAccordion
            items={d.faq.items.map((i) => ({ ...i, a: i.a.replace("{max}", euros(APORTACION_ONLINE.max, lang)) }))}
          />
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
