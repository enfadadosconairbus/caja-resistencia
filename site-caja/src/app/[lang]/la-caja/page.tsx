import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, locales } from "../dictionaries";
import { SiteNav } from "@/components/site-nav";
import ARRANQUE from "@/config/arranque-huelga.json";
import { ChapaHuelga } from "@/components/chapa-huelga";
import { SiteFooter } from "@/components/site-footer";
import { MuroAportaciones } from "@/components/muro-aportaciones";
import { AportarCanales } from "@/components/aportar-canales";
import { FONDO } from "@/config/fondo";
import { redactorGmail } from "@/lib/gmail";
import { MaskText } from "@/components/motion";
// Reveals en CSS puro, no framer: en la página del dinero la información no puede
// depender de que hidrate React (ver `revelar.tsx`).
import { Revelar, RevelarLista, RevelarItem } from "@/components/revelar";
import { PanelTransparencia, type Movimiento, type TextosPanel } from "@/components/panel-transparencia";
import RECAUDACION from "@/config/recaudacion.json";

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

  // Panel de transparencia: los datos detallados salen de config/fondo.ts (gastos con sus
  // pagos fechados) y de config/recaudacion.json (recaudación diaria AGREGADA, sin nombres).
  // `scripts/check-panel.mjs` comprueba que todo cuadra al céntimo con las cifras publicadas.
  // Las campañas previstas no salen: no han gastado nada.
  const fichas = d.campanas.fichas as Record<string, { corto: string }>;
  const campanasPanel = FONDO.campanas.filter((c) => c.estado !== "prevista");
  const movimientos: Movimiento[] = campanasPanel.flatMap((c) =>
    c.gastos.flatMap((g) =>
      (g.pagos ?? []).map((p) => ({ fecha: p.fecha, importe: p.importe, campana: c.clave, concepto: g.clave, tipo: g.tipo })),
    ),
  );
  const actualizado = FONDO.cifras.actualizado;
  // Canal de organizaciones/grandes donantes: correo dedicado si existe, si no el de la comisión.
  const contactoOrg = FONDO.contacto.organizaciones ?? FONDO.contacto.general;
  // El correo de "Hablar con la comisión" sale a la comisión Y al buzón de la web, en el mismo mail.
  const donantesDestinatarios = [contactoOrg, FONDO.redes.emailWeb].filter(Boolean).join(",");

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
            desconvocadaISO={ARRANQUE.desconvocada}
            zona={ARRANQUE.zona}
          />
        }
      />


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
            {/* `immediate`: el titular se pinta en el primer render (ver portada). */}
            <MaskText
              as="h1"
              immediate
              lines={d.caja.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-4xl font-extrabold leading-tight md:text-6xl"
            />
            <Revelar>
              <p className="mt-6 max-w-3xl text-lg text-[var(--color-tinta-suave)]">{d.caja.body}</p>
            </Revelar>
            {/* Valores en UNA línea; el desarrollo a fondo (independencia, control colectivo)
                vive solo en /gobernanza para no repetirlo por toda la web. */}
            <Revelar>
              <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-tinta-suave)]">
                {d.valores.resumen}{" "}
                <Link
                  href={`/${lang}/gobernanza`}
                  className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)] underline underline-offset-4 hover:text-[var(--color-tinta)]"
                >
                  {d.valores.cta}
                </Link>
              </p>
            </Revelar>
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
            immediate
            lines={d.transparencia.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <Revelar>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.transparencia.intro}</p>
          </Revelar>
          {actualizado ? (
            <PanelTransparencia
              lang={lang}
              corte={actualizado}
              dias={RECAUDACION.dias}
              movimientos={movimientos}
              campanas={campanasPanel.map((c) => ({ clave: c.clave, nombre: fichas[c.clave]?.corto ?? c.clave }))}
              conceptos={d.transparencia.detalle as Record<string, string>}
              t={d.transparencia.panel as TextosPanel}
            />
          ) : null}

          <Revelar>
            <p className="mt-6 max-w-3xl text-sm text-[var(--color-tinta-suave)]">{d.transparencia.note}</p>
          </Revelar>
        </section>

        {/* ── MURO DE APORTACIONES (firma) ── */}
        <section className="border-y border-[var(--color-linea)] bg-[var(--color-confianza)] text-[var(--color-papel-fijo)]">
          <div className={SECTION}>
            <p className="kicker !text-[color-mix(in_srgb,var(--color-papel-fijo)_80%,transparent)]">
              {d.muro.kicker}
            </p>
            <MaskText
              as="h2"
              immediate
              lines={d.muro.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <Revelar>
              <p className="mt-6 max-w-2xl text-[color-mix(in_srgb,var(--color-papel-fijo)_82%,transparent)]">
                {d.muro.body}
              </p>
            </Revelar>
            <div className="mt-12">
              <MuroAportaciones
                aportaciones={FONDO.cifras.aportaciones}
                s={d.muro}
                lang={lang}
              />
            </div>
          </div>
        </section>

        {/* ── APORTAR ── Dos vías y las dos cobran: pago online por Stripe (tarjeta, wallets,
            Bizum…) y transferencia. Antes había tres tarjetas de «vías», un bloque aparte para
            el código Bizum de ONG y una vista previa de tarjeta que no cobraba; con Stripe en
            LIVE (1-oct-2026) todo eso se colapsa en este bloque. */}
        <section id="aportar" className={`${SECTION} scroll-mt-24`}>
          <p className="kicker">{d.aportar.kicker}</p>
          <MaskText
            as="h2"
            immediate
            lines={d.aportar.title}
            className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
          />
          <Revelar>
            <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{d.aportar.intro}</p>
          </Revelar>
          <AportarCanales s={d.aportar.canales} lang={lang} />
        </section>

        {/* ── GRANDES DONANTES ── */}
        <section id="donantes" className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
          <div className={SECTION}>
            <p className="kicker">{d.donantes.kicker}</p>
            <MaskText
              as="h2"
              immediate
              lines={d.donantes.title}
              className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
            />
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <div>
                <Revelar>
                  <p className="text-[var(--color-tinta-suave)]">{d.donantes.body}</p>
                </Revelar>
                <RevelarLista className="mt-6 space-y-3">
                  {d.donantes.bullets.map((b) => (
                    <RevelarItem key={b} className="flex items-start gap-3">
                      <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-acento)]" />
                      <span className="text-sm text-[var(--color-tinta)]">{b}</span>
                    </RevelarItem>
                  ))}
                </RevelarLista>
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
