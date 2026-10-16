import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import {
  FONDO,
  costeCampana,
  eurosExacto,
  type GastoLinea,
} from "@/config/fondo";
import { MaskText } from "@/components/motion";
import { Revelar, RevelarLista, RevelarItem } from "@/components/revelar";
import { EstadoChapa, periodo } from "@/components/campana-ficha";
import { ConflictoCards } from "@/components/conflicto-cards";
import { InformeDestacado } from "@/components/informe-destacado";
import { LemaAsiNo } from "@/components/lema-asi-no";
import { ComparativaHuelga } from "@/components/comparativa-huelga";
import INTERNACIONAL from "@/config/internacional.json";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * FICHA DE UNA CAMPAÑA. Rinde cuentas de una lucha: qué se peleaba, qué costó, en qué se
 * gastó y qué se ha conseguido.
 *
 * Solo tienen ficha las campañas con `slug`. Las previstas no: todavía no hay nada que
 * contar y una página vacía es peor que ninguna.
 *
 * El texto de «qué se ha conseguido» vive en los diccionarios a propósito. Cambia cada vez
 * que cambia el conflicto —el de 2026 caduca con el referéndum del 30 de septiembre— y
 * tiene que poder reescribirse sin tocar código y en los cuatro idiomas.
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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/campanas/${slug}`]));
  return {
    title: `${ficha.nombre} · ${d.meta.title}`,
    description: ficha.lema,
    alternates: {
      canonical: `/${lang}/campanas/${slug}`,
      languages: { ...languages, "x-default": `/es/campanas/${slug}` },
    },
  };
}

export default async function FichaCampana({
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
  const ficha = s.fichas[c.clave as keyof typeof s.fichas];
  const etiquetas = d.transparencia.detalle as Record<string, string>;
  /* ── Los manifiestos de la sección «El conflicto» ──
     OJO: aquí hay DOS documentos distintos, no un manifiesto en cuatro idiomas. La v3 de
     reivindicaciones (7 puntos, solo en español) y el manifiesto al Grupo Airbus de julio
     (6 demandas, en en/fr/de). El botón grande sirve el que le toca al idioma de la página;
     debajo, cada documento se ofrece con su nombre, para que nadie se descargue el
     internacional creyendo que es la v3 traducida. Una entrada sin `doc` cuenta como
     «grupo»: es lo único que da de alta revisar-y-publicar.py. */
  type Manifiesto = { doc?: string; lang?: string; label: string; pdf: string; mb?: number };
  const MANIFIESTOS: Manifiesto[] = INTERNACIONAL.manifiestoIdiomas;
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
  const titulosManifiesto: Record<string, string> = d.conflicto.docManifiesto;
  const manifiestoFilas = [...new Set(MANIFIESTOS.map(docDe))]
    .sort((a) => (a === docDe(manifiesto) ? -1 : 1))
    .map((doc) => ({
      doc,
      titulo:
        doc === docDe(manifiesto)
          ? d.conflicto.docManifiestoOtros
          : d.conflicto.docManifiestoOtroDoc.replace("{doc}", titulosManifiesto[doc]),
      idiomas: MANIFIESTOS.filter((m) => docDe(m) === doc && m !== manifiesto),
    }))
    .filter((fila) => fila.idiomas.length > 0);

  const hoyEnMadrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARRANQUE.zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const conseguido = ficha.conseguido;

  // El emblema «ASÍ, NO» es de esta huelga, no de cualquier campaña: la siguiente tendrá
  // el suyo o ninguno. Va junto a «Lo que ha costado», en el hueco a la derecha del desglose.
  const conLema = slug === "huelga-2026";

  /* La ficha del conflicto (la misma de la portada de la Web A, `d.ficha`) es también de
     ESTA huelga. Ocupa el hueco derecho del hero, en vertical como en la Web A. Se probó en
     tira horizontal bajo el título (1-oct-2026) y se descartó: leía como una tabla suelta. */
  const fichaConflicto = slug === "huelga-2026" ? d.ficha : null;

  const coste = costeCampana(c);
  const imputados = c.gastos.filter((g) => g.importe !== null);
  const pendientes = c.gastos.filter((g) => g.importe === null);

  // Dos columnas fijas, igual que el desglose de /la-caja: concepto a la izquierda e importe
  // siempre a la derecha. Con una fila flexible, en móvil el importe de los conceptos largos
  // bajaba debajo del texto y el de los cortos se quedaba al lado.
  const fila = (g: GastoLinea) => (
    <div
      key={g.clave}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-[var(--color-linea)] py-3 last:border-0"
    >
      <dt className="text-sm leading-snug text-[var(--color-tinta)]">{etiquetas[g.clave] ?? g.clave}</dt>
      <dd
        className={
          g.importe === null
            ? "max-w-[8.5rem] text-right font-[family-name:var(--ff-mono)] text-xs uppercase leading-snug tracking-wider text-[var(--color-tinta-suave)]"
            : "whitespace-nowrap text-right font-[family-name:var(--ff-mono)] text-sm tabular-nums text-[var(--color-tinta)]"
        }
      >
        {g.importe === null ? etiquetas.pendiente : eurosExacto(g.importe, lang)}
      </dd>
    </div>
  );

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
        // El cambio de idioma tiene que quedarse en ESTA campaña, no volver al índice.
        sufijo={`/campanas/${slug}`}
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
          {/* Con lema, el hero se parte en dos columnas desde 1024 px: el texto a la izquierda
              y el emblema en el hueco de la derecha. Sin lema, el hero de siempre. */}
          {/* Con ficha, el hero se parte en dos columnas desde 1024 px: el texto a la izquierda
              y la ficha en el hueco de la derecha. Sin ficha, el hero de siempre. */}
          <div
            className={`${SECTION} ${
              fichaConflicto ? "grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center lg:gap-16" : ""
            }`}
          >
            <div>
              <Link
                href={`/${lang}/campanas`}
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
                {s.volver}
              </Link>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <EstadoChapa estado={c.estado} s={s} />
                <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                  {periodo(c, s, lang)}
                </span>
              </div>

              <MaskText
                as="h1"
                immediate
                lines={ficha.nombre}
                className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
              />
              <Revelar>
                <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{ficha.lema}</p>
              </Revelar>
            </div>

            {/* ── FICHA DEL CONFLICTO · tarjeta vertical, como en la portada de la Web A ── */}
            {fichaConflicto && (
              <aside
                className="rise-in rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6"
                style={{ animationDelay: "0.3s" }}
              >
                <p className="kicker !mb-0">{fichaConflicto.kicker}</p>
                <dl className="mt-5">
                  {fichaConflicto.filas.map((f) => (
                    <div
                      key={f.k}
                      className="border-b border-[var(--color-linea)] py-3 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                        {f.k}
                      </dt>
                      <dd className="mt-1 font-[family-name:var(--ff-display)] text-lg font-semibold leading-snug text-[var(--color-tinta)]">
                        {f.v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            )}
          </div>
        </section>

        {/* ── LO QUE HA COSTADO ── */}
        {/* Con lema, la sección se parte en dos desde 1024 px: la cifra y el desglose a la
            izquierda y el emblema «ASÍ, NO» en el hueco que deja la tarjeta a la derecha. */}
        <section
          className={`${SECTION} ${
            conLema ? "lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16" : ""
          }`}
        >
          <div>
            <p className="kicker">{c.estado === "cerrada" ? s.costeCerrada : s.coste}</p>
            <Revelar>
              <p className="mt-4 font-[family-name:var(--ff-mono)] text-5xl font-medium tabular-nums text-[var(--color-tinta)] md:text-6xl">
                {eurosExacto(coste, lang)}
              </p>
            </Revelar>

            {c.gastos.length ? (
              <Revelar>
                <div className="mt-10 max-w-2xl rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
                  <h2 className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]">
                    {s.desglose}
                  </h2>
                  <dl className="mt-4">
                    {imputados.map(fila)}
                    {pendientes.map(fila)}
                  </dl>
                </div>
              </Revelar>
            ) : (
              <Revelar>
                <p className="mt-6 text-[var(--color-tinta-suave)]">{s.sinGastos}</p>
              </Revelar>
            )}
          </div>
          {conLema && <LemaAsiNo pie={s.lemaPie} />}
        </section>

        {/* ── QUÉ SE HA CONSEGUIDO ── */}
        {conseguido ? (
          <section className="border-y border-[var(--color-linea)] bg-[var(--color-superficie)]">
            <div className={SECTION}>
              <p className="kicker">{s.conseguidoLabel}</p>
              {/* Si la ficha trae comparativa (antes / después de la huelga), va tras el primer
                  párrafo, que es el que la presenta; el resto (el camino, lo que pagó la caja)
                  sigue debajo. */}
              <RevelarLista className="mt-6 max-w-3xl space-y-5">
                {conseguido
                  .split(/\n{2,}/)
                  .slice(0, "comparativa" in ficha ? 1 : undefined)
                  .map((parrafo, i) => (
                    <RevelarItem key={i}>
                      <p className="text-lg leading-relaxed text-[var(--color-tinta)]">{parrafo}</p>
                    </RevelarItem>
                  ))}
              </RevelarLista>
              {"comparativa" in ficha ? (
                <>
                  <Revelar>
                    <ComparativaHuelga c={ficha.comparativa} />
                  </Revelar>
                  <RevelarLista className="mt-12 max-w-3xl space-y-5">
                    {conseguido
                      .split(/\n{2,}/)
                      .slice(1)
                      .map((parrafo, i) => (
                        <RevelarItem key={i}>
                          <p className="text-lg leading-relaxed text-[var(--color-tinta)]">{parrafo}</p>
                        </RevelarItem>
                      ))}
                  </RevelarLista>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── EL CONFLICTO · las siete reivindicaciones y los documentos que las sostienen ──
            Última pieza que quedaba en la Web A, y la encontró la guardia de documentos: al
            traer los cuatro PDF que la Web B no tenía, `pliego-garantias-espacio.pdf` salió
            marcado como expuesto sin enlazar. Lo enlazaba ESTA sección, que no se había
            mudado — o sea que faltaba el contenido, no el fichero.

            Va después de «qué se ha conseguido» y antes de las tarjetas: primero lo que se
            pide, luego lo que se ha logrado, y al final a dónde ir a leer más.

            Solo para la campaña que tiene el manifiesto detrás. Una campaña «prevista» no
            tiene reivindicaciones publicadas, y pintarle las de 2026 sería atribuirle algo
            que nadie ha escrito. */}
        {c.clave === "huelga-2026" ? (
          <section className={SECTION}>
            <p className="kicker">{d.conflicto.kicker}</p>
            <MaskText
              as="h2"
              lines={d.conflicto.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Revelar>
              <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.conflicto.intro}</p>
            </Revelar>

            {/* Los tres documentos de cabecera. El manifiesto se sirve en el idioma de la
                página; los otros dos solo existen en español. */}
            <Revelar>
              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  { href: manifiesto.pdf, cta: titulosManifiesto[docDe(manifiesto)], meta: peso(manifiesto.mb) },
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
                    <span className="font-[family-name:var(--ff-mono)] text-[10px] font-normal opacity-70">
                      {doc.meta}
                    </span>
                  </a>
                ))}
              </div>
            </Revelar>

            {/* «En otros idiomas», con cada documento por su nombre: son DOS documentos
                distintos, no un manifiesto traducido. La v3 de reivindicaciones solo existe
                en español; el internacional al Grupo Airbus, en en/fr/de. Ofrecerlos como si
                fueran el mismo texto es justo el error que esta fila evita. */}
            {manifiestoFilas.map((fila) => (
              <Revelar key={fila.doc}>
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
                      {/* El peso solo cuando es OTRO documento: en la fila del manifiesto de
                          la página, cada idioma es la misma lectura y el peso sobra. */}
                      {fila.doc !== docDe(manifiesto) && (
                        <span className="font-[family-name:var(--ff-mono)] text-[10px] font-normal opacity-70">
                          {peso(doc.mb)}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </Revelar>
            ))}

            <Revelar>
              <InformeDestacado s={d.informes} lang={lang} variante="compacto" />
            </Revelar>

            <ConflictoCards
              points={d.conflicto.points}
              exigeLabel={d.conflicto.exigeLabel}
              masDetalle={d.conflicto.masDetalle}
            />

            <p className="mt-8 font-[family-name:var(--ff-mono)] text-[11px] text-[var(--color-tinta-suave)]">
              {d.conflicto.fuente}
            </p>
          </section>
        ) : null}

        {/* ── EL RELATO ──
            Las cuatro piezas de la fase 2 ya viven AQUÍ: cronología, documentación,
            referéndum y prensa. Las cuatro tarjetas son enlaces internos y esta ficha no
            manda a la Web A para nada — que es justo lo que hacía falta para poder apagarla
            en la fase 3. */}
        <section className={SECTION}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Revelar>
              <Link
                href={`/${lang}/campanas/${slug}/cronologia`}
                className="group flex h-full flex-col rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-7 transition-colors hover:border-[var(--color-tinta)]"
              >
                <h2 className="font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                  {s.cronologiaTitulo}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {s.cronologiaTexto}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
                  {s.cronologiaCta}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </Revelar>

            <Revelar>
              <Link
                href={`/${lang}/campanas/${slug}/documentacion`}
                className="group flex h-full flex-col rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-7 transition-colors hover:border-[var(--color-tinta)]"
              >
                <h2 className="font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                  {s.docsTitulo}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {s.docsTexto}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
                  {s.docsCta}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </Revelar>

            <Revelar>
              <Link
                href={`/${lang}/campanas/${slug}/referendum`}
                className="group flex h-full flex-col rounded-xl border border-[var(--color-acento-tinta)] bg-[color-mix(in_srgb,var(--color-acento)_7%,transparent)] p-7 transition-colors hover:border-[var(--color-tinta)]"
              >
                <h2 className="font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                  {s.refTitulo}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {s.refTexto}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
                  {s.refCta}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </Revelar>

            {/* Cuarta tarjeta: era el único enlace que quedaba a la Web A («la cobertura de
                prensa sigue, de momento, en la web del movimiento»). Con la fase 2 cerrada
                la prensa está aquí, así que deja de ser un enlace de salida y pasa a ser una
                hija más. Las cadenas `relato`/`relatoCta` se quedan en los diccionarios. */}
            <Revelar>
              <Link
                href={`/${lang}/campanas/${slug}/prensa`}
                className="group flex h-full flex-col rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-7 transition-colors hover:border-[var(--color-tinta)]"
              >
                <h2 className="font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
                  {s.prensaTitulo}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {s.prensaTexto}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
                  {s.prensaCta}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </Revelar>
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
