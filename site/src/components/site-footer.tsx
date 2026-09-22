"use client";
import * as React from "react";
import Link from "next/link";
import type { TitularJuridico } from "@/config/fondo";
import { ContadorVisitas } from "@/components/contador-visitas";
import { Canales } from "@/components/canales";

// Lectura del "consentimiento visto" sin setState-en-efecto (useSyncExternalStore).
const subscribeCookie = () => () => {};
const getCookieSnapshot = () => {
  try {
    return Boolean(localStorage.getItem("caja-cookie"));
  } catch {
    return false;
  }
};
/**
 * En SSR se asume que el banner SÍ se pinta.
 *
 * Antes se asumía lo contrario para evitar el parpadeo a quien ya lo había aceptado, y
 * salía caro: el banner aparecía solo después de hidratar, así que era el elemento LCP de
 * la página con 3,6 s de retraso de pintado — el 85 % del LCP medido en producción. Ahora
 * viene en el HTML y el parpadeo lo evita `guionSinParpadeo`, que lo oculta ANTES del
 * primer pintado leyendo el mismo `localStorage`.
 */
const getServerCookieSnapshot = () => false;

/**
 * Se ejecuta antes de pintar: si ya se aceptó, oculta el banner sin que llegue a verse.
 * Va como script inline a propósito — un fichero externo llegaría tarde.
 */
const guionSinParpadeo = `try{if(localStorage.getItem('caja-cookie')){var e=document.getElementById('banner-cookies');if(e)e.hidden=true}}catch(e){}`;

type LegalKey = "aviso" | "privacidad" | "cookies";

type FooterStrings = {
  tagline: string;
  independence: string;
  legal: Record<LegalKey, string>;
  rights: string;
  visitasLabel: string;
  visitasNota: string;
  /** Etiqueta de la fila de canales (Telegram, Instagram, correo). */
  redes: string;
  /** Asunto con el que el sobre abre el redactor de Gmail. */
  redesAsunto: string;
  /** Aviso de pestaña nueva para los canales. Sin texto visible. */
  redesNuevaPestana: string;
  /** Enlace a la página «Sobre este proyecto». */
  sobre: string;
};
/** `nota` es un aviso opcional que se pinta en rojo sobre el cuerpo del modal. Sustituye al
 *  antiguo `draftTag` compartido: cada texto legal avisa lo suyo (o nada). */
type LegalModals = Record<LegalKey, { title: string; body: string; nota?: string }>;
type CookieStrings = { text: string; accept: string; reject: string; configure: string };
type TitularLabels = Record<keyof TitularJuridico, string>;

/**
 * Identificación del titular exigida por la LSSI-CE. Solo se pinta cuando existe:
 * el borrador de arriba explica qué falta, y aquí no se rellena nada a mano.
 */
function TitularBloque({
  titular,
  labels,
}: {
  titular: TitularJuridico;
  labels: TitularLabels;
}) {
  const filas = (Object.keys(labels) as (keyof TitularJuridico)[])
    .map((k) => ({ k, v: titular[k] }))
    .filter((f): f is { k: keyof TitularJuridico; v: string } => Boolean(f.v));

  if (!filas.length) return null;

  return (
    <dl className="mt-4 border-t border-[var(--color-linea)] pt-4">
      {filas.map(({ k, v }) => (
        <div key={k} className="flex flex-wrap justify-between gap-2 py-1.5">
          <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {labels[k]}
          </dt>
          <dd className="text-sm text-[var(--color-tinta)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SiteFooter({
  footer,
  legalModals,
  cookies,
  titular,
  titularLabels,
  lang,
}: {
  footer: FooterStrings;
  legalModals: LegalModals;
  cookies: CookieStrings;
  titular: TitularJuridico;
  titularLabels: TitularLabels;
  lang: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [active, setActive] = React.useState<LegalKey | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const seen = React.useSyncExternalStore(
    subscribeCookie,
    getCookieSnapshot,
    getServerCookieSnapshot,
  );
  const cookieVisible = !seen && !dismissed;

  React.useEffect(() => {
    if (active) dialogRef.current?.showModal();
  }, [active]);

  const open = (k: LegalKey) => setActive(k);
  const close = () => {
    dialogRef.current?.close();
    setActive(null);
  };
  const decideCookies = () => {
    try {
      localStorage.setItem("caja-cookie", "seen");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const legalOrder: LegalKey[] = ["aviso", "privacidad", "cookies"];

  return (
    <>
      <footer className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2">
          <div className="max-w-md">
            <p className="font-[family-name:var(--ff-display)] text-lg font-bold text-[var(--color-tinta)]">
              {footer.tagline}
            </p>
            <p className="mt-3 text-sm text-[var(--color-tinta-suave)]">{footer.independence}</p>

            {/* Canales del movimiento, los mismos que en «Contacto». El marcado vive en
                `components/canales.tsx`: aquí van con rótulo, allí sin él. */}
            <Canales
              etiqueta={footer.redes}
              asunto={footer.redesAsunto}
              nuevaPestana={footer.redesNuevaPestana}
              className="mt-6"
              conEtiqueta
            />

            <div className="mt-8">
              <ContadorVisitas label={footer.visitasLabel} nota={footer.visitasNota} />
            </div>
          </div>
          <div className="md:justify-self-end">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li>
                <Link
                  href={`/${lang}/sobre-el-proyecto`}
                  className="text-[var(--color-tinta)] underline underline-offset-4 hover:text-[var(--color-acento-tinta)]"
                >
                  {footer.sobre}
                </Link>
              </li>
              {legalOrder.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => open(k)}
                    className="text-[var(--color-tinta)] underline underline-offset-4 hover:text-[var(--color-acento-tinta)]"
                  >
                    {footer.legal[k]}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-sm font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
              {footer.rights}
            </p>
          </div>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        className="m-auto w-[min(92vw,640px)] rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-0 text-[var(--color-tinta)] backdrop:bg-black/40"
      >
        {active ? (
          <div className="p-6">
            <div className="mb-3 flex items-start justify-between gap-4">
              <h2 className="font-[family-name:var(--ff-display)] text-xl font-bold">
                {legalModals[active].title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="rounded-md border border-[var(--color-linea)] px-2 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            {legalModals[active].nota ? (
              <p className="mb-3 rounded border border-[var(--color-acento-tinta)] bg-[color-mix(in_srgb,var(--color-acento)_10%,transparent)] px-3 py-2 font-[family-name:var(--ff-mono)] text-xs leading-relaxed text-[var(--color-acento-tinta)]">
                {legalModals[active].nota}
              </p>
            ) : null}
            <div className="space-y-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
              {legalModals[active].body.split(/\n{2,}/).map((parrafo, i) => (
                <p key={i}>{parrafo}</p>
              ))}
            </div>
            {active === "aviso" ? (
              <TitularBloque titular={titular} labels={titularLabels} />
            ) : null}
          </div>
        ) : null}
      </dialog>

      {cookieVisible ? (
        <div
          id="banner-cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-linea)] bg-[var(--color-fondo)] p-4 shadow-[0_-4px_24px_var(--sombra-sutil)]"
        >
          <script dangerouslySetInnerHTML={{ __html: guionSinParpadeo }} />
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm text-[var(--color-tinta-suave)]">{cookies.text}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActive("cookies");
                  decideCookies();
                }}
                className="rounded-full border border-[var(--color-linea)] px-4 py-2 text-sm text-[var(--color-tinta)]"
              >
                {cookies.configure}
              </button>
              <button
                type="button"
                onClick={decideCookies}
                className="rounded-full border border-[var(--color-linea)] px-4 py-2 text-sm text-[var(--color-tinta)]"
              >
                {cookies.reject}
              </button>
              <button
                type="button"
                onClick={decideCookies}
                className="rounded-full bg-[var(--color-acento)] px-4 py-2 text-sm font-semibold text-white"
              >
                {cookies.accept}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
