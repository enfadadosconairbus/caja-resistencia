"use client";
import * as React from "react";
import Link from "next/link";
import { FONDO, type TitularJuridico } from "@/config/fondo";
import { mailtoRedactor } from "@/lib/gmail";
import { ContadorVisitas } from "@/components/contador-visitas";
import { abrirBuzon } from "@/lib/buzon-eventos";

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

type LegalKey = "aviso" | "privacidad" | "cookies" | "condiciones";

type FooterStrings = {
  tagline: string;
  independence: string;
  legal: Record<LegalKey, string>;
  /** Atribución que exige la licencia CC BY 4.0 del modelo 3D del huelguista (plan gratis de Meshy). */
  creditos: string;
  visitasLabel: string;
  visitasNota: string;
  /** Enlace a la página «Gobernanza». */
  sobre: string;
  /** Abre el buzón de sugerencias (`components/buzon.tsx`). Es la entrada que no depende del
   *  huelguista: sirve con él oculto, en móvil y con teclado o lector de pantalla. */
  buzon: string;
  /** Bloque de contacto: tres funciones, cada una con su correo (o pendiente). */
  contacto: {
    heading: string;
    /** Caja de resistencia e incidencias de la web: comparten correo, van en una fila. */
    cajaWeb: string;
    gestion: string;
    gestionPendiente: string;
  };
};
/** `nota` es un aviso opcional que se pinta en rojo sobre el cuerpo del modal. Sustituye al
 *  antiguo `draftTag` compartido: cada texto legal avisa lo suyo (o nada). */
type LegalModals = Record<LegalKey, { title: string; body: string; nota?: string }>;
type CookieStrings = { text: string; masInfo: string; cerrar: string };
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

/**
 * Una función de contacto: la función arriba, su correo debajo, con un filo de color que los
 * agrupa. Antes iban en la misma línea y, en móvil, el correo saltaba a la línea siguiente
 * pegado al rótulo de la fila de abajo: no se sabía qué correo era de qué. El correo abre el
 * programa de correo (mailto) y se ve entero para copiarlo. El enlace «Gmail» (redactor web)
 * se quitó el 6-oct-2026 a petición de la coordinación.
 */
function ContactoFila({ label, email, pendiente }: { label: string; email: string | null; pendiente?: string }) {
  return (
    <li className="border-l-2 border-[var(--color-acento)] pl-3">
      <span className="block text-sm font-semibold text-[var(--color-tinta)]">{label}</span>
      {email ? (
        <a
          href={mailtoRedactor(email, label)}
          aria-label={`${label}: ${email}`}
          className="mt-0.5 inline-block break-all font-[family-name:var(--ff-mono)] text-xs text-[var(--color-acento-tinta)] underline underline-offset-4 hover:text-[var(--color-tinta)]"
        >
          {email}
        </a>
      ) : (
        <span className="mt-0.5 block font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {pendiente}
        </span>
      )}
    </li>
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

  const legalOrder: LegalKey[] = ["aviso", "privacidad", "cookies", "condiciones"];

  return (
    <>
      <footer className="border-t border-[var(--color-linea)] bg-[var(--color-superficie)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2">
          <div className="max-w-md">
            <p className="font-[family-name:var(--ff-display)] text-lg font-bold text-[var(--color-tinta)]">
              {footer.tagline}
            </p>
            <p className="mt-3 text-sm text-[var(--color-tinta-suave)]">{footer.independence}</p>

            {/* Contacto por funciones: cada una a su buzón. El correo va aquí etiquetado (no
                como un sobre suelto que no dice para qué). La gestión de la caja está pendiente
                hasta que el sindicato dé su canal. */}
            <div className="mt-6">
              <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                {footer.contacto.heading}
              </p>
              <ul className="mt-3 space-y-4">
                <ContactoFila label={footer.contacto.cajaWeb} email={FONDO.redes.emailWeb} />
                <ContactoFila label={footer.contacto.gestion} email={FONDO.contacto.general} pendiente={footer.contacto.gestionPendiente} />
              </ul>
            </div>

            <div className="mt-8">
              <ContadorVisitas label={footer.visitasLabel} nota={footer.visitasNota} />
            </div>
          </div>
          <div className="md:justify-self-end">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li>
                <Link
                  href={`/${lang}/gobernanza`}
                  className="text-[var(--color-tinta)] underline underline-offset-4 hover:text-[var(--color-acento-tinta)]"
                >
                  {footer.sobre}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={abrirBuzon}
                  className="text-[var(--color-tinta)] underline underline-offset-4 hover:text-[var(--color-acento-tinta)]"
                >
                  {footer.buzon}
                </button>
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
            <p className="mt-2 max-w-sm font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
              {footer.creditos}{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer license"
                className="underline underline-offset-2 hover:text-[var(--color-tinta)]"
              >
                CC BY 4.0
              </a>
              .
            </p>
          </div>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        className="m-auto w-[min(92vw,640px)] rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-0 text-[var(--color-tinta)] backdrop:bg-black/40"
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

      {/* Aviso de cookies DISCRETO y descartable. No hay banda de consentimiento con tres
          botones porque no hay nada que consentir: el único almacenamiento es técnico
          (idioma + "aviso visto"), exento del consentimiento previo (art. 22.2 LSSI-CE),
          como afirma la propia Política de cookies. Una tarjeta pequeña abajo a la izquierda,
          «Más información» abre la política, y un botón la cierra para siempre. */}
      {cookieVisible ? (
        <div
          id="banner-cookies"
          role="note"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-4 shadow-[0_8px_30px_var(--sombra-sutil)] md:left-4 md:right-auto"
        >
          <script dangerouslySetInnerHTML={{ __html: guionSinParpadeo }} />
          <p className="text-xs leading-relaxed text-[var(--color-tinta-suave)]">
            {cookies.text}{" "}
            <button
              type="button"
              onClick={() => setActive("cookies")}
              className="font-medium text-[var(--color-acento-tinta)] underline underline-offset-2"
            >
              {cookies.masInfo}
            </button>
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={decideCookies}
              className="rounded-full bg-[var(--color-tinta)] px-4 py-1.5 text-xs font-semibold text-[var(--color-fondo)]"
            >
              {cookies.cerrar}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
