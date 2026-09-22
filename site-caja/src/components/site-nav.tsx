"use client";
import * as React from "react";
import Link from "next/link";
import { MagneticButton } from "@/components/motion";
import { TemaToggle } from "@/components/tema-toggle";

type NavStrings = {
  conflicto: string;
  caja: string;
  transparencia: string;
  internacional: string;
  tienda: string;
  donantes: string;
  documentacion: string;
  sobre: string;
  faq: string;
  gobernanza: string;
  contacto: string;
  aportar: string;
  marca: string;
  menu: string;
  close: string;
  /** Etiquetas del interruptor de tema: lo que hará al pulsarlo, no el estado actual. */
  temaOscuro: string;
  temaClaro: string;
};

/**
 * Qué epígrafe de la barra se marca en cada sección de la portada.
 *
 * La cronología y el termómetro no tienen epígrafe propio, pero cuentan el conflicto: son
 * la continuación de «El conflicto» y ahí es donde se quedan. Antes se observaban igual
 * pero sin traducir a ningún enlace, así que al entrar en ellas la barra se quedaba SIN
 * nada marcado — y son dos de las secciones más largas de la página, donde más rato pasa
 * la gente. (Carlos, 14-ago-2026.)
 *
 * El orden importa: se recorre en orden de documento para elegir la sección activa.
 * Cadena vacía = ningún epígrafe; es el caso de «Contacto», que no tiene enlace propio y
 * donde apagar la barra sí es lo correcto.
 */
// Portada de la Web B: la única sección con ancla propia que se espía es la FAQ.
const SECCION_A_EPIGRAFE: Record<string, string> = {
  faq: "faq",
};

const LOCALES: { code: string; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
];

/**
 * Navegación de las tres páginas: portada, La caja y Tienda.
 *
 * En la portada los enlaces de sección son anclas y se ilumina la sección activa
 * (scroll-spy). Fuera de ella no hay nada que espiar: los mismos enlaces apuntan a
 * `/{lang}#ancla` y se marca la página en la que estás.
 */
export function SiteNav({
  lang,
  nav,
  pagina = "portada",
  cintillo,
}: {
  lang: string;
  nav: NavStrings;
  pagina?: "portada" | "caja" | "tienda" | "gobernanza";
  /** Cintillo de huelga: va DENTRO de la cabecera sticky para quedarse fijo con la barra. */
  cintillo?: React.ReactNode;
}) {
  const enPortada = pagina === "portada";
  const [open, setOpen] = React.useState(false);
  // Fuera de la portada el enlace activo es la propia página, y no cambia: estado inicial,
  // no efecto. En la portada lo decide el scroll-spy de abajo.
  const [active, setActive] = React.useState(enPortada ? "" : pagina);

  const ancla = (id: string) => (enPortada ? `#${id}` : `/${lang}#${id}`);
  const links = [
    { href: `/${lang}/la-caja`, id: "caja", label: nav.caja },
    { href: `/${lang}/gobernanza`, id: "gobernanza", label: nav.gobernanza },
    { href: `/${lang}/tienda`, id: "tienda", label: nav.tienda },
    { href: ancla("faq"), id: "faq", label: nav.faq },
  ];
  // El botón Aportar lleva siempre a la caja; en la propia página de la caja es un ancla local.
  const aportarHref = pagina === "caja" ? "#aportar" : `/${lang}/la-caja#aportar`;

  // Scroll-spy: marca el epígrafe de la sección en la que estás. Una banda estrecha en
  // el tercio superior del viewport (rootMargin) decide la sección "activa"; se elige la
  // primera en orden del documento que la cruza. Se limpia solo al desmontar.
  React.useEffect(() => {
    if (!enPortada) return;
    // Se observan TODAS las secciones, tengan epígrafe propio o no: `SECCION_A_EPIGRAFE`
    // dice cuál se marca en cada una. Las que cuelgan de «El conflicto» lo mantienen
    // encendido; las que no pertenecen a ninguno lo apagan en vez de dejarlo pegado.
    const ids = Object.keys(SECCION_A_EPIGRAFE);
    // (documentacion sigue en la lista: en la portada queda el bloque de avance con esa ancla)
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const visibles = new Map<string, boolean>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visibles.set(e.target.id, e.isIntersecting);
        const activo = ids.find((id) => visibles.get(id));
        if (activo !== undefined) setActive(SECCION_A_EPIGRAFE[activo]);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [enPortada]);

  // En la página de La caja el botón Aportar es el destino de la propia página: se remarca.
  const enAportar = pagina === "caja";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-linea)] bg-[color-mix(in_srgb,var(--color-fondo)_88%,transparent)] backdrop-blur-md">
      {cintillo}
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3"
      >
        <Link
          href={`/${lang}`}
          className="shrink-0 leading-tight text-[var(--color-tinta)]"
        >
          <span className="block whitespace-nowrap font-[family-name:var(--ff-display)] text-lg font-extrabold tracking-tight">
            #EnfadadosconAirbus
          </span>
          <span className="block font-[family-name:var(--ff-mono)] text-xs font-medium text-[var(--color-acento-tinta)]">
            {nav.marca}
          </span>
        </Link>

        <div className="hidden items-center gap-6 xl:flex">
          <ul className="flex items-center gap-5 text-sm text-[var(--color-tinta-suave)]">
            {links.map((l) => {
              const on = active === l.id;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? "location" : undefined}
                    /* El activo, además de rojo y en seminegrita, va subrayado: solo con
                       el color se pierde de vista en la barra oscura, y es justo lo que
                       Carlos dibujó a mano al pedirlo (14-ago-2026). */
                    className={`whitespace-nowrap transition-colors ${
                      on
                        ? "font-semibold text-[var(--color-acento-tinta)] underline decoration-2 underline-offset-[6px]"
                        : "hover:text-[var(--color-tinta)]"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <LocaleSwitcher current={lang} pagina={pagina} />
          <TemaToggle label={{ oscuro: nav.temaOscuro, claro: nav.temaClaro }} />
          <MagneticButton
            href={aportarHref}
            className={`inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,box-shadow] hover:bg-[var(--color-acento-hondo)] ${
              enAportar
                ? "bg-[var(--color-acento-hondo)] shadow-[0_4px_18px_rgba(192,57,43,0.45)] ring-2 ring-[var(--color-acento-tinta)] ring-offset-2 ring-offset-[var(--color-fondo)]"
                : "bg-[var(--color-acento)]"
            }`}
          >
            {nav.aportar}
          </MagneticButton>
        </div>

        {/* El selector de idioma sale de la barra por debajo de `sm` y baja al desplegable.
            A 375 px no cabía: la caja de contenido son 335 px y el logo (193) más este grupo
            (188) suman 381, así que la página se iba en horizontal 42 px. Es el ancho de
            referencia de móvil, y buena parte de la plantilla entra desde ahí. */}
        <div className="flex items-center gap-3 xl:hidden">
          <span className="hidden sm:block">
            <LocaleSwitcher current={lang} pagina={pagina} />
          </span>
          {/* El tema sí se queda en la barra a 375 px, al revés que el idioma: son 36 px
              y la cuenta de arriba deja sitio (193 + 36 + 12 + 64 = 305 de 335). Meterlo
              en el desplegable obligaría a abrir un menú para bajar el brillo. */}
          <TemaToggle label={{ oscuro: nav.temaOscuro, claro: nav.temaClaro }} />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-[var(--color-linea)] px-3 py-2 text-sm text-[var(--color-tinta)]"
          >
            {open ? nav.close : nav.menu}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-menu" className="border-t border-[var(--color-linea)] xl:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3 text-[var(--color-tinta)]">
            {links.map((l) => {
              const on = active === l.id;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? "location" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-2 py-2.5 ${
                      on
                        ? "bg-[var(--color-superficie)] font-semibold text-[var(--color-acento-tinta)]"
                        : "hover:bg-[var(--color-superficie)]"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2">
              <Link
                href={aportarHref}
                onClick={() => setOpen(false)}
                className={`block rounded-full px-5 py-3 text-center font-semibold text-white transition-[background-color,box-shadow] ${
                  enAportar
                    ? "bg-[var(--color-acento-hondo)] shadow-[0_4px_18px_rgba(192,57,43,0.45)] ring-2 ring-[var(--color-acento-tinta)] ring-offset-2 ring-offset-[var(--color-fondo)]"
                    : "bg-[var(--color-acento)]"
                }`}
              >
                {nav.aportar}
              </Link>
            </li>
            {/* Contrapartida de lo anterior: por debajo de `sm` el idioma se elige aquí,
                porque arriba no cabe. De `sm` para arriba sigue en la barra y aquí sobra. */}
            <li className="mt-3 border-t border-[var(--color-linea)] pt-3 sm:hidden">
              <LocaleSwitcher current={lang} pagina={pagina} />
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

function LocaleSwitcher({
  current,
  pagina,
}: {
  current: string;
  pagina: "portada" | "caja" | "tienda" | "gobernanza";
}) {
  // El cambio de idioma mantiene la página en la que estás, no te devuelve a la portada.
  const sufijo =
    pagina === "caja" ? "/la-caja" : pagina === "tienda" ? "/tienda"
    : pagina === "gobernanza" ? "/gobernanza" : "";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Idioma">
      {LOCALES.map((l) => {
        const active = l.code === current;
        return (
          <Link
            key={l.code}
            href={`/${l.code}${sufijo}`}
            aria-current={active ? "true" : undefined}
            className={`rounded px-1.5 py-1 font-[family-name:var(--ff-mono)] text-xs ${
              active
                ? "font-semibold text-[var(--color-acento-tinta)]"
                : "text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
