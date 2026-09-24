import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "./dictionaries";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Canales } from "@/components/canales";
import { FaqAccordion } from "@/components/faq-accordion";
import { ConflictoCards } from "@/components/conflicto-cards";
import { InformeDestacado } from "@/components/informe-destacado";
import { Termometro } from "@/components/termometro";
import { CoberturaVideo } from "@/components/cobertura-video";
import COBERTURA_VIDEO from "@/config/cobertura-video.json";
import { DocumentacionAvance } from "@/components/documentacion-avance";
import { Cartel } from "@/components/cartel";
import { LineaTemporal } from "@/components/linea-temporal";
import { SenderoCronologia } from "@/components/sendero-cronologia";
import { Plegable } from "@/components/plegable";
import HITOS from "@/config/hitos.json";
import { MuroAportaciones } from "@/components/muro-aportaciones";
import { NegociacionHero } from "@/components/negociacion-hero";
import { UltimaHoraImagen } from "@/components/ultima-hora-imagen";
import { FONDO, WEB_CAJA_PUENTE_URL } from "@/config/fondo";
import { redactorGmail } from "@/lib/gmail";
import INTERNACIONAL from "@/config/internacional.json";
import ARRANQUE from "@/config/arranque-huelga.json";
import NEGOCIACION from "@/config/negociacion.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { MaskText, Rise } from "@/components/motion";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * Cobertura de prensa de la última hora (suspensión del referéndum, 18-sep-2026).
 * Los enlaces no dependen del idioma; la etiqueta del panel vive en el diccionario.
 * Los cinco medios cubren el auto de medidas cautelarísimas de la Audiencia Nacional.
 */
const PRENSA_ULTIMA_HORA: { medio: string; url: string }[] = [
  {
    medio: "El Economista",
    url: "https://www.eleconomista.es/industria/noticias/14014914/09/26/la-audiencia-nacional-suspende-provisionalmente-el-referendum-de-airbus-sobre-la-huelga-indefinida.html",
  },
  {
    medio: "Forbes",
    url: "https://forbes.es/ultima-hora/1023802/la-audiencia-nacional-suspende-provisionalmente-el-referendum-sobre-la-ultima-propuesta-de-airbus/",
  },
  {
    medio: "Press Digital",
    url: "https://www.pressdigital.es/articulo/economia/2026-09-18/6020093-audiencia-nacional-suspende-provisionalmente-referendum-sobre-ultima-propuesta-airbus",
  },
  {
    medio: "Infobae",
    url: "https://www.infobae.com/espana/agencias/2026/09/18/audiencia-nacional-frena-temporalmente-referendum-de-airbus-tras-medidas-cautelares-de-cgt/",
  },
  {
    medio: "Demócrata",
    url: "https://www.democrata.es/economia/la-audiencia-nacional-frena-de-forma-temporal-la-consulta-sobre-la-ultima-oferta-de-airbus/",
  },
];

/**
 * PORTADA. Cuenta el conflicto y lo documenta; el dinero vive en su propia página.
 *
 * Reparto de páginas (decisión de la coordinación, 09-ago-2026):
 *   · portada   → conflicto, termómetro, solidaridad, documentación, preguntas, contacto
 *   · /la-caja  → qué es la caja, transparencia, muro, aportar y grandes donantes
 *   · /tienda   → merchandising
 * En la portada se queda el botón de Aportar (hero, nav y banda de llamada), que lleva a
 * /la-caja#aportar: sacar la sección no puede costar la conversión.
 */
export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const d = await getDictionary(lang);

  /* Semilla del estado de la chapa. La portada se genera estática, así que esta fecha
     es la del build: sirve para que el primer render del cliente coincida, y el propio
     componente la recalcula al montar. */
  const hoyEnMadrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARRANQUE.zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  /* Los manifiestos son DOS documentos, no uno en cuatro idiomas (ver internacional.json):
     la v3 de reivindicaciones, solo en español, y el internacional al Grupo Airbus, en
     en/fr/de. El botón grande sirve el que le toca al idioma de la página; debajo, cada
     documento se ofrece con su nombre y sus idiomas, para que nadie se descargue el
     internacional creyendo que es la v3 traducida. */
  type Manifiesto = { doc?: string; lang?: string; label: string; pdf: string; mb?: number };
  const MANIFIESTOS: Manifiesto[] = INTERNACIONAL.manifiestoIdiomas;
  // Sin `doc` es del internacional: es lo único que da de alta revisar-y-publicar.py.
  const docDe = (m: Manifiesto) => m.doc ?? "grupo";
  const manifiesto = MANIFIESTOS.find((m) => m.lang === lang) ?? MANIFIESTOS[0];
  // El peso lo pone el fichero; el separador decimal y la unidad, el diccionario.
  const peso = (mb?: number) =>
    mb
      ? d.conflicto.docManifiestoMeta.replace(
          "{t}",
          new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(mb),
        )
      : "PDF";
  const titulos: Record<string, string> = d.conflicto.docManifiesto;
  /* El documento del botón grande encabeza «en otros idiomas» (son de verdad el mismo
     texto); los demás llevan su propio título. En español la primera fila no sale: la v3
     no está traducida, y fingir que sí es justo lo que había que arreglar. */
  const manifiestoFilas = [...new Set(MANIFIESTOS.map(docDe))]
    .sort((a) => (a === docDe(manifiesto) ? -1 : 1))
    .map((doc) => ({
      doc,
      titulo:
        doc === docDe(manifiesto)
          ? d.conflicto.docManifiestoOtros
          : d.conflicto.docManifiestoOtroDoc.replace("{doc}", titulos[doc]),
      idiomas: MANIFIESTOS.filter((m) => docDe(m) === doc && m !== manifiesto),
    }))
    .filter((fila) => fila.idiomas.length > 0);

  return (
    <div className="bg-[var(--color-fondo)] text-[var(--color-tinta)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-tinta)] focus:px-4 focus:py-2 focus:text-[var(--color-fondo)]"
      >
        {d.nav.skip}
      </a>

      {/* La chapa de huelga va DENTRO de la cabecera sticky (ranura `cintillo`): así se
          queda fija arriba junto con la barra al hacer scroll, en vez de irse. */}
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


      <main id="main" tabIndex={-1}>
        {/* ── ÚLTIMAS NOTICIAS · última hora, por encima del estado de la negociación ──
            18-sep-2026: la Sala de lo Social de la Audiencia Nacional suspende, en
            cautelarísimas, el referéndum del 24-25 de septiembre. Misma banda oscura que
            la negociación (tinta-fija / papel-fijo) para que las dos lean como un bloque. */}
        <section
          id="ultimas-noticias"
          className="border-b border-[var(--color-linea)] bg-[var(--color-tinta-fija)] text-[var(--color-papel-fijo)]"
        >
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-14 md:pt-20 md:pb-20">
            {/* Cabecera a dos columnas: a la izquierda el titular; a la derecha, en el
                hueco que quedaba, los enlaces a la cobertura de prensa de esta noticia. */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="kicker !mb-0 flex items-center gap-2 !text-[var(--color-acento-tinta)]">
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
              </div>

              {/* En la prensa · enlaces externos (nueva pestaña) a la cobertura de la noticia. */}
              <aside className="rise-in lg:pt-1" style={{ animationDelay: "0.3s" }}>
                <p className="kicker !mb-0 !text-[var(--color-acento-tinta)]">{d.ultimasNoticias.enPrensa}</p>
                <ul className="mt-4 space-y-2">
                  {PRENSA_ULTIMA_HORA.map((f) => (
                    <li key={f.url}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-3 rounded-lg border border-white/12 px-4 py-3 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
                      >
                        <span className="text-sm font-medium text-[var(--color-papel-fijo)]">{f.medio}</span>
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
                          className="shrink-0 text-[var(--color-acento-tinta)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        >
                          <path d="M7 17 17 7M8 7h9v9" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            {/* Ilustración de última hora (encargo del cliente, 18-sep). A sangre sobre la
                banda oscura, con clic-para-ampliar y descarga como las infografías. */}
            <UltimaHoraImagen
              src="/img/ultima-hora-referendum-suspendido.webp"
              alt={d.ultimasNoticias.imagenAlt}
              descarga="ultima-hora-referendum-suspendido.webp"
              ampliarLabel={d.ultimasNoticias.ampliar}
              descargarLabel={d.ultimasNoticias.descargar}
              cerrarLabel={d.ultimasNoticias.cerrar}
            />

            {/* Cuatro claves. Rejilla con separadores de un píxel (gap-px sobre un fondo
                claro tenue): cada celda recupera el fondo de la banda y entre ellas queda
                una raya fina, sin marcos. */}
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/12 bg-white/12 sm:grid-cols-2">
              {d.ultimasNoticias.puntos.map((p, i) => (
                <div
                  key={p.etiqueta}
                  className="rise-in bg-[var(--color-tinta-fija)] p-6 md:p-7"
                  style={{ animationDelay: `${0.35 + i * 0.08}s` }}
                >
                  <p className="font-[family-name:var(--ff-mono)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-acento-tinta)]">
                    {p.etiqueta}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)] md:text-base">
                    {p.texto}
                  </p>
                </div>
              ))}
            </div>

            {/* Las fuentes ya no van como texto al pie: cada medio es ahora un enlace en el
                panel «En la prensa» de la cabecera. Aquí solo queda la nota de seguimiento. */}
            <p
              className="rise-in mt-8 font-[family-name:var(--ff-mono)] text-[11px] italic leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_50%,transparent)]"
              style={{ animationDelay: "0.6s" }}
            >
              {d.ultimasNoticias.nota}
            </p>
          </div>
        </section>

        {/* ── HERO · estado de la negociación ── */}
        <NegociacionHero
          imagenes={NEGOCIACION.imagenes}
          fuentes={NEGOCIACION.fuentes}
          s={d.negociacion}
        />

        {/* ── HERO · above-the-fold · reveals CSS (LCP sano) ── */}
        <section className="relative overflow-hidden border-b border-[var(--color-linea)]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-16">
            <div>
              <p className="kicker mask-rise inline-block">{d.hero.kicker}</p>
              <h1 className="mt-6 font-[family-name:var(--ff-display)] text-5xl font-extrabold leading-[1.02] tracking-tight text-[var(--color-tinta)] md:text-7xl">
                <MaskText as="span" lines={d.hero.title} immediate delay={0.05} />
              </h1>
              <p
                className="rise-in mt-8 max-w-2xl text-lg text-[var(--color-tinta-suave)] md:text-xl"
                style={{ animationDelay: "0.35s" }}
              >
                {d.hero.subtitle}
              </p>
              <div
                className="rise-in mt-10 flex flex-wrap items-center gap-4"
                style={{ animationDelay: "0.5s" }}
              >
                {/* «Aportar» — PUENTE TEMPORAL (3-sep-2026): mientras los legales del sindicato
                    revisan Web B, enlaza a la página puente en GitHub Pages en vez de quedar
                    desactivado. Al activar Web B: volver a WEB_CAJA_URL y restaurar el <span>
                    inerte + la nota `d.hero.aportarNota`. */}
                <a
                  href={WEB_CAJA_PUENTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full bg-[var(--color-acento)] px-8 py-4 font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
                >
                  {d.hero.ctaPrimary}
                </a>
                <a
                  href="#conflicto"
                  className="rounded-full border border-[var(--color-tinta)] px-8 py-4 font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
                >
                  {d.hero.ctaSecondary}
                </a>
              </div>
              <ul
                className="rise-in mt-12 flex flex-wrap gap-x-6 gap-y-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]"
                style={{ animationDelay: "0.65s" }}
              >
                {d.hero.values.map((v) => (
                  <li key={v} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-acento)]" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ficha del conflicto: llena el hueco de la derecha con dato verificable,
                no con decoración. Todo sale del manifiesto y de config/fondo.ts. */}
            <aside
              className="rise-in self-start rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6 lg:sticky lg:top-24"
              style={{ animationDelay: "0.8s" }}
            >
              <p className="kicker !mb-0">{d.ficha.kicker}</p>
              <dl className="mt-5">
                {/* `last:border-b-0`: debajo iba una línea de procedencia y la última raya
                    separaba de ella. Sin esa línea, la raya quedaba flotando contra el borde
                    de la tarjeta separando la última fila de nada. */}
                {d.ficha.filas.map((f) => (
                  <div key={f.k} className="border-b border-[var(--color-linea)] py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                      {f.k}
                    </dt>
                    <dd className="mt-1 font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-tinta)]">
                      {f.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        {/* ── CARTEL de campaña (INC-004: pendiente de clearance legal) ── */}
        <Cartel alt={d.cartel.alt} centrosLabel={d.cartel.centros} />

        {/* ── EL CONFLICTO ── */}
        <section id="conflicto" className={SECTION}>
          <p className="kicker">{d.conflicto.kicker}</p>
          <MaskText
            as="h2"
            lines={d.conflicto.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <Rise>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.conflicto.intro}</p>
          </Rise>
          <Rise>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { href: manifiesto.pdf, cta: titulos[docDe(manifiesto)], meta: peso(manifiesto.mb) },
                { href: "/docs/dossier-recuperacion-salarial-v11.pdf", cta: d.conflicto.docDossier, meta: d.conflicto.docDossierMeta },
                { href: "/docs/pliego-garantias-espacio.pdf", cta: d.conflicto.docPliego, meta: d.conflicto.docPliegoMeta },
              ].map((doc) => (
                <a
                  key={doc.href}
                  href={doc.href}
                  download
                  className="inline-flex items-center gap-3 rounded-full border border-[var(--color-tinta)] px-6 py-3 text-sm font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="shrink-0">
                    <path d="M10 3v10m0 0 4-4m-4 4-4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {doc.cta}
                  <span className="font-[family-name:var(--ff-mono)] text-[10px] font-normal opacity-70">{doc.meta}</span>
                </a>
              ))}
            </div>
          </Rise>
          {manifiestoFilas.map((fila) => (
            <Rise key={fila.doc}>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
                  {fila.titulo}
                </span>
                {fila.idiomas.map((doc) => (
                  <a
                    key={doc.pdf}
                    href={doc.pdf}
                    download
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-linea)] px-4 py-2 text-xs font-semibold text-[var(--color-tinta)] transition-colors hover:border-[var(--color-tinta)] hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="shrink-0">
                      <path d="M10 3v10m0 0 4-4m-4 4-4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {doc.label}
                    {/* El peso solo en el documento que NO es el del botón grande: ahí es un
                        fichero nuevo para el lector, no la misma lectura en otro idioma. */}
                    {fila.doc !== docDe(manifiesto) && (
                      <span className="font-[family-name:var(--ff-mono)] text-[10px] font-normal opacity-70">
                        {peso(doc.mb)}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </Rise>
          ))}
          {/* El informe comparativo va DESPUÉS de los PDF y en su propia caja: no es un
              documento del conflicto entre otros, es el que pone las cifras españolas
              frente al resto del grupo y del sector. */}
          <Rise>
            <InformeDestacado s={d.informes} lang={lang} variante="compacto" />
          </Rise>
          <ConflictoCards
            points={d.conflicto.points}
            exigeLabel={d.conflicto.exigeLabel}
            masDetalle={d.conflicto.masDetalle}
          />
        </section>

        {/* ── CRONOLOGÍA · el relato del conflicto, hito a hito, con su documento ──
            El eje llega al 25-ago (huelga indefinida y arranque del calendario del SIMA) y la marca de HOY se
            recalcula sola: la página se revalida cada hora. */}
        <section id="cronologia" className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.cronologia.kicker}</p>
            <MaskText
              as="h2"
              lines={d.cronologia.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.cronologia.intro}</p>
            </Rise>
            {/* Cronología colapsable (la coordinación, 28-ago-2026): 30 hitos servidos dos veces
                —sendero en `xl`, raíl por debajo— hacían la página interminable. Va dentro de
                un <details> plegado por defecto para cortar la sensación de scroll infinito;
                el visitante la despliega cuando quiere. Colapsa igual en escritorio y móvil. */}
            <div className="mt-8">
              <Plegable titulo={d.cronologia.plegableTitulo} n={HITOS.hitos.length} nivel="h3">
                {/* Sendero serpenteante en pantalla ancha; en móvil, el mismo relato sobre un
                    raíl recto. Serpentear necesita dos carriles separados, y buena parte de la
                    plantilla entra desde el móvil. */}
                <SenderoCronologia
                  hitos={HITOS.hitos}
                  hoyISO={new Date().toISOString().slice(0, 10)}
                  lang={lang}
                  s={d.cronologia}
                />
                <div className="xl:hidden">
                  <LineaTemporal
                    hitos={HITOS.hitos}
                    hoyISO={new Date().toISOString().slice(0, 10)}
                    lang={lang}
                    s={d.cronologia}
                  />
                </div>
              </Plegable>
            </div>
          </div>
        </section>

        {/* ── TERMÓMETRO · datos de dashboard de terceros (incluye el punto de ruptura) ── */}
        <section id="termometro" className="border-t border-[var(--color-linea)]">
          <div className={SECTION}>
            <Termometro s={d.termometro} lang={lang} />
          </div>
        </section>

        {/* ── COBERTURA EN VÍDEO · los cortes de informativos ──
            Va pegada al termómetro (que CUANTIFICA la cobertura): aquí se VE. No se aloja
            metraje de las cadenas —copyright y presupuesto de bytes—; cada corte se reproduce
            desde su fuente con un facade que no llama a Google hasta que se pulsa play. El de
            solidaridad internacional (francés) NO va aquí: vive en la sección `#internacional`. */}
        <section id="cobertura-video" className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.coberturaVideo.kicker}</p>
            <MaskText
              as="h2"
              lines={d.coberturaVideo.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.coberturaVideo.intro}</p>
            </Rise>
            <CoberturaVideo cortes={COBERTURA_VIDEO.cortes} lang={lang} s={d.coberturaVideo} />
            <p className="mt-8 font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
              {d.coberturaVideo.fuente}
            </p>
          </div>
        </section>

        {/* ── LLAMADA A LA CAJA · la sección vive en /la-caja; el botón se queda aquí ──
            El `id` no es un ancla de navegación (nadie enlaza a `#caja-cta`): existe para
            que el scroll-spy de la barra sepa que esta banda es «La caja». Sin él se
            quedaba marcado «El conflicto» del termómetro de arriba mientras se leía una
            banda que habla de la caja. (la coordinación, 14-ago-2026.) */}
        <section
          id="caja-cta"
          className="border-y border-[var(--color-linea)] bg-[var(--color-confianza)] text-[var(--color-papel-fijo)]"
        >
          <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-16`}>
            <div>
            <p className="kicker !text-[color-mix(in_srgb,var(--color-papel-fijo)_80%,transparent)]">
              {d.cajaCta.kicker}
            </p>
            <MaskText
              as="h2"
              lines={d.cajaCta.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-2xl text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)]">
                {d.cajaCta.body}
              </p>
            </Rise>
            {/* CTA a la caja de resistencia — PUENTE TEMPORAL (3-sep-2026): mientras los legales
                revisan Web B, enlaza a la página puente en GitHub Pages en vez de quedar
                desactivado. Cuando la caja esté lista: apuntar a WEB_CAJA_URL y restaurar el
                <span> inerte + la nota `d.hero.aportarNota`. */}
            <Rise>
              <div className="mt-8">
                <a
                  href={WEB_CAJA_PUENTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full bg-[var(--color-papel-fijo)] px-8 py-4 font-semibold text-[var(--color-confianza)] transition-opacity hover:opacity-90"
                >
                  {d.cajaCta.ctaAportar}
                </a>
              </div>
            </Rise>
            </div>

            {/* Muro de aportaciones: el elemento de firma de la marca. Vive en /la-caja,
                pero la banda de la portada es donde se pide el dinero, y ahí la metáfora
                —muchas unidades pequeñas que sostienen algo— hace el trabajo que no hace
                un texto. Se rellena al entrar en pantalla, una sola vez. */}
            <MuroAportaciones ariaLabel={d.muro.body} />
          </div>
        </section>

        {/* ── SOLIDARIDAD INTERNACIONAL ── */}
        <section id="internacional" className="border-b border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.internacional.kicker}</p>
            <MaskText
              as="h2"
              lines={d.internacional.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.internacional.body}</p>
            </Rise>
            <Rise>
              <p className="mt-3 max-w-3xl text-sm text-[var(--color-tinta-suave)]">
                {d.internacional.orgLanding}
              </p>
            </Rise>
            {/* Aquí había un segundo botón, «Descargar dossier del conflicto v4». Se retiró
                (10-ago-2026): ofrecía la v4 del dossier de recuperación salarial cuando en
                «El conflicto», más arriba en esta misma página, ya se ofrece la v10. Dos
                versiones del mismo documento en la misma página, y la vieja presentada como
                el dossier del conflicto: quien llegara aquí primero se descargaba la antigua. */}
            {/* «Contacto para organizaciones» → buzón de la WEB (config/fondo.ts). Antes
                llevaba a /la-caja#donantes; la coordinación pidió (11-ago-2026) que sea el mail directo.
                Va a `emailWeb`, no al correo histórico de los iconos: una organización que
                escribe por la web no es lo mismo que la plantilla escribiendo al canal de
                siempre. Si algún día no hubiera correo, cae al enlace de la caja para no
                dejar un botón muerto. */}
            <div className="mt-8">
              {FONDO.redes.emailWeb ? (
                <a
                  href={`mailto:${FONDO.redes.emailWeb}`}
                  className="inline-block rounded-full bg-[var(--color-confianza)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-tinta-fija)]"
                >
                  {d.internacional.ctaContact}
                </a>
              ) : (
                <Link
                  href={`/${lang}/la-caja#donantes`}
                  className="inline-block rounded-full bg-[var(--color-confianza)] px-6 py-3 text-sm font-semibold text-white"
                >
                  {d.internacional.ctaContact}
                </Link>
              )}
            </div>

            {/* Comunicados internacionales de solidaridad. */}
            <div className="mt-10">
              <p className="kicker">{d.internacional.comunicadosLabel}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {/* `min-w-0` en el elemento de grid, no solo en el titular: un elemento de
                    grid vale `min-width: auto`, o sea que se dimensiona al `min-content` de
                    lo que lleva dentro. Y el titular va en `nowrap` (por `truncate`), así que
                    su `min-content` es el texto ENTERO: la pista crecía a 363 px dentro de un
                    contenedor de 335 y el recorte no llegaba a actuar nunca. */}
                {INTERNACIONAL.comunicados.map((c) => (
                  <li key={c.pdf} className="min-w-0">
                    <a
                      href={c.pdf}
                      download
                      className="group flex items-center gap-3 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-4 py-3 transition-colors hover:border-[var(--color-tinta)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">
                        {c.titulo}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                        {c.meta}
                      </span>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="shrink-0 text-[var(--color-acento-tinta)]">
                        <path d="M10 3v10m0 0 4-4m-4 4-4-4M3 16h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vídeo de solidaridad internacional. Va SOLO aquí (petición de la coordinación): es un
                mensaje de un obrero de Airbus Marignane al piquete de Madrid, no cobertura
                de un informativo, y su sitio es la solidaridad, no el bloque de la huelga.
                Reproductor propio de la cadena (no embebible) → tarjeta con enlace. */}
            {COBERTURA_VIDEO.internacional.length > 0 && (
              <div className="mt-12">
                <p className="kicker">{d.coberturaVideo.internacionalLabel}</p>
                <CoberturaVideo
                  cortes={COBERTURA_VIDEO.internacional}
                  lang={lang}
                  s={d.coberturaVideo}
                  columnas={2}
                />
              </div>
            )}
          </div>
        </section>

        {/* ── DOCUMENTACIÓN · avance con contadores; el contenido vive en /documentacion.
            La sección completa aquí costaba 5.317 elementos de DOM y 14,7 s de LCP en
            móvil (A4, 09-ago-2026). ── */}
        <section id="documentacion" className="scroll-mt-24">
          {/* Ancla antigua: los enlaces a #actualizaciones que ya circulan siguen cayendo aquí. */}
          <span id="actualizaciones" aria-hidden="true" />
          <div className={SECTION}>
            <DocumentacionAvance s={d.documentacion} lang={lang} />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className={`${SECTION} border-t border-[var(--color-linea)]`}>
          <p className="kicker">{d.faq.kicker}</p>
          <MaskText
            as="h2"
            lines={d.faq.title}
            className="mb-8 mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <FaqAccordion items={d.faq.items} />
        </section>

        {/* ── CONTACTO ── */}
        <section id="contacto" className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          {/* Dos columnas: a la izquierda el contacto de siempre; a la derecha, la puerta de
              entrada a sugerencias. La banda quedaba medio vacía a partir de `lg` y el hueco
              es justo donde cabe pedir algo a quien ya ha llegado al final de la página. */}
          <div className={`${SECTION} grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16`}>
            <div>
              <p className="kicker">{d.contacto.kicker}</p>
              <MaskText
                as="h2"
                lines={d.contacto.title}
                className="mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
              />
              <Rise>
                <p className="mt-6 max-w-2xl text-[var(--color-tinta-suave)]">{d.contacto.body}</p>
              </Rise>
              {/* Canales públicos del movimiento (config/fondo.ts → redes), en iconos. El marcado
                  vive en `components/canales.tsx`, compartido con el pie: antes eran dos listas
                  copiadas y cualquier cambio había que hacerlo dos veces. */}
              <Rise>
                <Canales
                  etiqueta={d.footer.redes}
                  asunto={d.footer.redesAsunto}
                  nuevaPestana={d.footer.redesNuevaPestana}
                  className="mt-6"
                />
              </Rise>
            </div>

            {/* Sugerencias y mejoras. Escribe al buzón de la WEB (`emailWeb`), no al correo
                histórico del movimiento que llevan los iconos de al lado: así lo de la web
                llega separado del día a día. Sin correo configurado no se pinta: un CTA que
                abre un redactor sin destinatario es peor que no ofrecerlo. La tarjeta va en
                `fondo` porque la sección ya es `superficie` — mismo tono, no se despegaría. */}
            {FONDO.redes.emailWeb ? (
              <Rise className="lg:self-start" delay={0.1}>
                <div className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6 md:p-8">
                  <p className="kicker">{d.contacto.sugerencias.kicker}</p>
                  <h3 className="mt-3 font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                    {d.contacto.sugerencias.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                    {d.contacto.sugerencias.body}
                  </p>
                  {/* El botón abre el REDACTOR DE GMAIL en una pestaña, no un `mailto:`.
                      Motivo (14-ago-2026): `mailto:` no hace absolutamente nada en un
                      escritorio sin cliente de correo asociado —el caso de la coordinación, con
                      Gmail abierto en otra pestaña— y el usuario se queda mirando un botón
                      muerto. Quien use otro programa tiene el `mailto:` justo debajo, y la
                      dirección en texto para copiarla. La URL la arma `lib/gmail.ts`, que es
                      el mismo sitio del que tiran los iconos de canales. */}
                  <a
                    href={redactorGmail(FONDO.redes.emailWeb, d.contacto.sugerencias.asunto)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${d.contacto.sugerencias.cta} (${d.contacto.sugerencias.nuevaPestana})`}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-confianza)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-tinta-fija)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                      <path d="m3.5 6.5 8.5 6 8.5-6" />
                    </svg>
                    {d.contacto.sugerencias.cta}
                  </a>
                  {/* Salida para quien no use Gmail: el `mailto:` de toda la vida, en enlace
                      secundario, y la dirección en texto para copiarla. Sin esto, mandar a
                      Gmail a un sindicato francés con Outlook sería dejarle sin vía.
                      Aquí había además una línea explicando que se abría el gestor de correo;
                      la coordinación la retiró (14-ago-2026): con el botón yendo ya a Gmail, sobraba. */}
                  <p className="mt-4 font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[var(--color-tinta-suave)]">
                    <a
                      href={`mailto:${FONDO.redes.emailWeb}?subject=${encodeURIComponent(
                        d.contacto.sugerencias.asunto,
                      )}`}
                      className="underline underline-offset-4 hover:text-[var(--color-tinta)]"
                    >
                      {d.contacto.sugerencias.ctaOtro}
                    </a>
                    <br />
                    <span className="text-[var(--color-tinta)]">{FONDO.redes.emailWeb}</span>
                  </p>
                </div>
              </Rise>
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
