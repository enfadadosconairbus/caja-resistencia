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
  campanas: string;
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
 * la gente. (la coordinación, 14-ago-2026.)
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
  sufijo,
}: {
  lang: string;
  nav: NavStrings;
  pagina?: "portada" | "caja" | "campanas" | "tienda" | "gobernanza";
  /** Cintillo de huelga: va DENTRO de la cabecera sticky para quedarse fijo con la barra. */
  cintillo?: React.ReactNode;
  /** Sufijo de ruta para el cambio de idioma, cuando no se puede derivar de `pagina`. */
  sufijo?: string;
}) {
  // El cambio de idioma mantiene la página en la que estás. Las rutas con parámetro —la
  // ficha de una campaña— no se pueden derivar de `pagina`, así que la componen ellas y la
  // pasan hecha en `sufijo`.
  const sufijoIdioma =
    sufijo ??
    (pagina === "caja"
      ? "/la-caja"
      : pagina === "campanas"
        ? "/campanas"
        : pagina === "tienda"
          ? "/material"
          : pagina === "gobernanza"
            ? "/gobernanza"
            : "");
  const enPortada = pagina === "portada";
  const [open, setOpen] = React.useState(false);
  // Fuera de la portada el enlace activo es la propia página, y no cambia: estado inicial,
  // no efecto. En la portada lo decide el scroll-spy de abajo.
  const [active, setActive] = React.useState(enPortada ? "" : pagina);

  const ancla = (id: string) => (enPortada ? `#${id}` : `/${lang}#${id}`);
  const links = [
    { href: `/${lang}/la-caja`, id: "caja", label: nav.caja },
    { href: `/${lang}/campanas`, id: "campanas", label: nav.campanas },
    { href: `/${lang}/gobernanza`, id: "gobernanza", label: nav.gobernanza },
    { href: `/${lang}/material`, id: "tienda", label: nav.tienda },
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
        {/* `min-w-0` y no `shrink-0` (1-oct-2026): con el bloque sin poder encoger, la página
            medía 465 px en un móvil de 375 y todo lo fijo al borde derecho —el huelguista, su
            botón para volver a mostrarlo— quedaba FUERA de la pantalla. El subtítulo parte en dos
            líneas; para el título, ver la cuenta junto al botón del tema, más abajo. */}
        <Link
          href={`/${lang}`}
          className="flex min-w-0 items-center gap-3 leading-tight text-[var(--color-tinta)]"
        >
          {/* El escudo del movimiento. 44 px = la mitad larga de la barra (68 px), que es
              la altura que pidió la coordinación. `aria-hidden` porque el nombre va escrito
              justo al lado: anunciarlo dos veces a un lector de pantalla es ruido. El PNG
              lleva el fondo blanco recortado — el original venía en cuadrado opaco y sobre
              la barra casi negra era un bloque. */}
          <img
            src="/img/logo-asi-no.png"
            alt=""
            aria-hidden="true"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="block min-w-0">
            <span className="block whitespace-nowrap font-[family-name:var(--ff-display)] text-[17px] font-extrabold tracking-tight min-[400px]:text-lg">
              #EnfadadosconAirbus
            </span>
            <span className="block text-balance font-[family-name:var(--ff-mono)] text-[11px] font-medium leading-snug text-[var(--color-acento-tinta)] sm:text-xs">
              {nav.marca}
            </span>
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
                       la coordinación dibujó a mano al pedirlo (14-ago-2026). */
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
          <LocaleSwitcher current={lang} sufijo={sufijoIdioma} />
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
            <LocaleSwitcher current={lang} sufijo={sufijoIdioma} />
          </span>
          {/* El tema también baja al desplegable por debajo de `sm` (1-oct-2026). Antes se
              quedaba arriba con esta cuenta: 193 + 36 + 12 + 64 = 305 de 335. Estaba mal: medido
              en el navegador, logo + título son 249 (44 + 12 + 193), así que con el tema y el
              «Menú» (106) la barra pedía 371 px de 335 y la página se iba en horizontal. Sin el
              tema caben 299; y por debajo de 400 px el título pasa de 18 a 17 px, para que a
              360 (el Android más común) tampoco se salga. */}
          <span className="hidden sm:block">
            <TemaToggle label={{ oscuro: nav.temaOscuro, claro: nav.temaClaro }} />
          </span>
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
            <li className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-linea)] pt-3 sm:hidden">
              <LocaleSwitcher current={lang} sufijo={sufijoIdioma} />
              <TemaToggle label={{ oscuro: nav.temaOscuro, claro: nav.temaClaro }} />
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

function LocaleSwitcher({
  current,
  sufijo,
}: {
  current: string;
  /** Ruta a la que salta el cambio de idioma, ya compuesta por quien renderiza la barra. */
  sufijo: string;
}) {
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
