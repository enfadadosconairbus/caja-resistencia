import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { Aviso } from "@/components/aviso";
import { SiteFooter } from "@/components/site-footer";
import { MuroAportaciones } from "@/components/muro-aportaciones";
import { AportarCanales } from "@/components/aportar-canales";
import { AportarSelector } from "@/components/aportar-selector";
import { FONDO, euros, eurosExacto, recuento, fondoOperativo, bizumPublicable, gastosTotal, saldoDisponible } from "@/config/fondo";
import { redactorGmail } from "@/lib/gmail";
import { AportarBizum } from "@/components/aportar-bizum";
import { MaskText, Rise, Stagger, StaggerItem } from "@/components/motion";

const SECTION = "mx-auto max-w-6xl px-5 py-20 md:py-28";

/**
 * LA CAJA — segunda página. Reúne todo lo que tiene que ver con el dinero, que antes
 * estaba repartido por la portada: qué es la caja, transparencia, muro de aportaciones,
 * aportar y grandes donantes. En la portada se queda el botón de Aportar, que trae aquí.
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
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/la-caja`]));
  return {
    title: `${d.caja.metaTitle} · ${d.meta.title}`,
    description: d.caja.metaDescription,
    alternates: { canonical: `/${lang}/la-caja`, languages: { ...languages, "x-default": "/es/la-caja" } },
  };
}

export default async function LaCaja({
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

  // Las cifras salen de config/fondo.ts; el diccionario solo pone las etiquetas.
  // Mientras no haya datos verificados, euros()/recuento() devuelven un guion.
  const cifras = [
    { k: d.transparencia.stats.recaudado, v: euros(FONDO.cifras.recaudado, lang) },
    { k: d.transparencia.stats.gastos, v: euros(gastosTotal(FONDO.cifras), lang) },
    { k: d.transparencia.stats.saldo, v: euros(saldoDisponible(FONDO.cifras), lang) },
    { k: d.transparencia.stats.aportaciones, v: recuento(FONDO.cifras.aportaciones, lang) },
  ];
  // Desglose de gastos: importe null = aprobado pero aún sin cifra («pendiente de imputar»).
  const detalle = FONDO.cifras.detalleGastos.map((g) => ({
    k: (d.transparencia.detalle as Record<string, string>)[g.clave] ?? g.clave,
    v: g.importe === null ? d.transparencia.detalle.pendiente : eurosExacto(g.importe, lang),
    pendiente: g.importe === null,
  }));
  const actualizado = FONDO.cifras.actualizado;
  // Canal de organizaciones/grandes donantes: correo dedicado si existe, si no el de la comisión.
  const contactoOrg = FONDO.contacto.organizaciones ?? FONDO.contacto.general;
  // El correo de "Hablar con la comisión" sale a la comisión Y al buzón de la web, en el mismo mail.
  const donantesDestinatarios = [contactoOrg, FONDO.redes.emailWeb].filter(Boolean).join(",");
  // Bizum: el nombre lo resuelve la app del banco; lo mostramos igual (el limpio, sin sufijo).
  const bizumNombre = FONDO.cuenta.titular ?? FONDO.titular.razonSocial ?? "";
  const bizumCif = FONDO.titular.cif ?? "";
  const bizumEmail = FONDO.redes.emailWeb ?? FONDO.redes.email ?? "";

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
        pagina="caja"
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

      <Aviso texto={d.caja.aviso} />


      <main id="main" tabIndex={-1}>
        {/* ── QUÉ ES LA CAJA ── */}
        <section id="caja" className="border-b border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)] transition-colors hover:text-[var(--color-acento-tinta)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M8.5 3 4.5 7l4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {d.caja.volver}
            </Link>
            <p className="kicker mt-8">{d.caja.kicker}</p>
            <MaskText
              as="h1"
              lines={d.caja.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
            />
            <Rise>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{d.caja.body}</p>
            </Rise>
            {/* Valores en UNA línea; el desarrollo a fondo (independencia, control colectivo)
                vive solo en /gobernanza para no repetirlo por toda la web. */}
            <Rise>
              <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-tinta-suave)]">
                {d.valores.resumen}{" "}
                <Link
                  href={`/${lang}/gobernanza`}
                  className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)] underline underline-offset-4 hover:text-[var(--color-tinta)]"
                >
                  {d.valores.cta}
                </Link>
              </p>
            </Rise>
          </div>
        </section>

        {/* ── TRANSPARENCIA ── */}
        <section id="transparencia" className={SECTION}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="kicker">{d.transparencia.kicker}</p>
            <span className="rounded bg-[color-mix(in_srgb,var(--color-confianza)_12%,transparent)] px-2 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)]">
              {actualizado
                ? `${d.transparencia.actualizadoLabel}: ${new Intl.DateTimeFormat(lang, {
                    dateStyle: "long",
                  }).format(new Date(actualizado))}`
                : d.transparencia.sinDatos}
            </span>
          </div>
          <MaskText
            as="h2"
            lines={d.transparencia.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <Rise>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.transparencia.intro}</p>
          </Rise>
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {cifras.map((s) => (
              <StaggerItem
                key={s.k}
                className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6"
              >
                <p className="font-[family-name:var(--ff-mono)] text-4xl font-medium tabular-nums text-[var(--color-tinta)]">
                  {s.v}
                </p>
                <p className="mt-2 text-sm text-[var(--color-tinta-suave)]">{s.k}</p>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Desglose de gastos: en qué se ha ido el dinero, línea a línea. */}
          <Rise>
            <div className="mt-10 max-w-2xl rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
              <h3 className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]">
                {d.transparencia.detalle.titulo}
              </h3>
              <dl className="mt-4">
                {detalle.map((g) => (
                  <div
                    key={g.k}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-linea)] py-3 last:border-0"
                  >
                    <dt className="text-sm text-[var(--color-tinta)]">{g.k}</dt>
                    <dd
                      className={
                        g.pendiente
                          ? "font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]"
                          : "font-[family-name:var(--ff-mono)] text-sm tabular-nums text-[var(--color-tinta)]"
                      }
                    >
                      {g.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Rise>

          <Rise>
            <p className="mt-6 max-w-3xl text-sm text-[var(--color-tinta-suave)]">{d.transparencia.note}</p>
          </Rise>
        </section>

        {/* ── MURO DE APORTACIONES (firma) ── */}
        <section className="border-y border-[var(--color-linea)] bg-[var(--color-confianza)] text-[var(--color-papel-fijo)]">
          <div className={SECTION}>
            <p className="kicker !text-[color-mix(in_srgb,var(--color-papel-fijo)_80%,transparent)]">
              {d.muro.kicker}
            </p>
            <MaskText
              as="h2"
              lines={d.muro.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Rise>
              <p className="mt-6 max-w-2xl text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)]">
                {d.muro.body}
              </p>
            </Rise>
            <div className="mt-12">
              <MuroAportaciones ariaLabel={d.muro.body} />
            </div>
          </div>
        </section>

        {/* ── APORTAR (placeholder honesto, sin pago falso) ── */}
        <section id="aportar" className={`${SECTION} scroll-mt-24`}>
          <p className="kicker">{d.aportar.kicker}</p>
          <MaskText
            as="h2"
            lines={d.aportar.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <Rise>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.aportar.intro}</p>
          </Rise>
          <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
            {d.aportar.vias.map((v) => (
              <StaggerItem
                key={v.t}
                className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6"
              >
                <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold">{v.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-tinta-suave)]">{v.d}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-16">
            <p className="kicker">{d.aportar.canales.kicker}</p>
            <MaskText
              as="h3"
              lines={d.aportar.canales.title}
              className="mt-4 font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight md:text-3xl"
            />
            <AportarCanales s={d.aportar.canales} />
            {bizumPublicable && FONDO.bizum.codigo && bizumNombre && bizumCif && bizumEmail ? (
              <>
                <p className="mt-8 max-w-3xl text-[var(--color-tinta-suave)]">
                  {d.aportar.bizum.intro}
                </p>
                <AportarBizum
                  s={d.aportar.bizum}
                  codigo={FONDO.bizum.codigo}
                  nombre={bizumNombre}
                  cif={bizumCif}
                  email={bizumEmail}
                />
              </>
            ) : null}
          </div>

          {/* Preview del pago con tarjeta: al final, tras los canales que sí operan. */}
          <div className="mt-12">
            <AportarSelector s={d.aportar.selector} lang={lang} />
          </div>

          {!fondoOperativo ? (
            <Rise>
              <p className="mt-8 rounded-lg border border-dashed border-[var(--color-acento-tinta)] bg-[color-mix(in_srgb,var(--color-acento)_6%,transparent)] px-5 py-4 font-[family-name:var(--ff-mono)] text-xs text-[var(--color-acento-tinta-fuerte)]">
                {d.aportar.placeholderNote}
              </p>
            </Rise>
          ) : null}
        </section>

        {/* ── GRANDES DONANTES ── */}
        <section id="donantes" className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.donantes.kicker}</p>
            <MaskText
              as="h2"
              lines={d.donantes.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <div>
                <Rise>
                  <p className="text-[var(--color-tinta-suave)]">{d.donantes.body}</p>
                </Rise>
                <Stagger className="mt-6 space-y-3">
                  {d.donantes.bullets.map((b) => (
                    <StaggerItem key={b} className="flex items-start gap-3">
                      <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-acento)]" />
                      <span className="text-sm text-[var(--color-tinta)]">{b}</span>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
              <div className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6">
                <div className="flex flex-wrap gap-3">
                  {donantesDestinatarios ? (
                    <a
                      href={redactorGmail(donantesDestinatarios, d.donantes.ctaContact)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[var(--color-acento)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
                    >
                      {d.donantes.ctaContact}
                    </a>
                  ) : null}
                  {/* El dossier de gobernanza aparece SOLO cuando exista (hoy `dossierGobernanzaUrl` = null). */}
                  {FONDO.dossierGobernanzaUrl ? (
                    <a
                      href={FONDO.dossierGobernanzaUrl}
                      className="rounded-full border border-[var(--color-linea)] px-6 py-3 text-sm text-[var(--color-tinta)] transition-colors hover:border-[var(--color-acento-tinta)]"
                    >
                      {d.donantes.ctaDossier}
                    </a>
                  ) : null}
                </div>
                <p className="mt-4 font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
                  {d.donantes.note}
                </p>
              </div>
            </div>
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
