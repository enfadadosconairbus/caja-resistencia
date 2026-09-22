import { FONDO } from "@/config/fondo";
import { redactorGmail } from "@/lib/gmail";

/**
 * Canales públicos del movimiento, en iconos.
 *
 * Se comparte entre la sección «Contacto» y el pie: antes eran dos listas de enlaces de texto
 * copiadas una en cada sitio, y cualquier cambio había que hacerlo dos veces.
 *
 * **Iconos sin texto visible, pero con nombre accesible.** Un enlace cuyo contenido es solo un
 * SVG decorativo no tiene nombre: un lector de pantalla lee «enlace» y ya. Aquí el nombre lo
 * pone `aria-label` (y el `title` da el tooltip del ratón), así que la lista se recorre igual
 * con teclado o por voz. El SVG va `aria-hidden` para que no se lea dos veces.
 *
 * **Colores de la web, no de las marcas.** Nada de azul Telegram ni degradado Instagram: los
 * iconos van en la tinta del sitio y pasan al rojo del acento al enfocarlos o pasar por encima.
 * Meter las libreas ajenas aquí chocaría con la paleta y, en una web que ya tiene un problema
 * abierto de marcas de terceros (INC-004), no conviene añadir más.
 */

const ICONO = {
  telegram: (
    <path d="M21.9 4.3 2.9 11.6c-1 .4-1 1.8 0 2.2l4.6 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.7 3.5c.7.5 1.7.1 1.9-.8l3.3-15.5c.2-1-.8-1.8-1.8-1.4Zm-3.4 4L10 15.6l-.4 3.4-1.4-4.3 10.3-6.4Z" />
  ),
  instagram: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  email: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>
  ),
} as const;

type Canal = keyof typeof ICONO;

function Enlace({ canal, href, nombre }: { canal: Canal; href: string; nombre: string }) {
  // Los tres salen del sitio, el correo incluido: desde que abre el redactor de Gmail en vez
  // de un `mailto:`, ya no hay ningún canal que se quede en la pestaña actual.
  return (
    <li>
      <a
        href={href}
        aria-label={nombre}
        title={nombre}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-linea)] text-[var(--color-tinta)] transition-colors hover:border-[var(--color-acento-tinta)] hover:text-[var(--color-acento-tinta)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONO[canal]}
        </svg>
      </a>
    </li>
  );
}

export function Canales({
  etiqueta,
  asunto,
  nuevaPestana,
  className = "",
  conEtiqueta = false,
  soloSocial = false,
}: {
  /** Nombre accesible de la lista; también el rótulo visible si `conEtiqueta`. */
  etiqueta: string;
  /** Asunto con el que se abre el redactor de Gmail al pulsar el sobre. */
  asunto: string;
  /** Aviso de pestaña nueva; se añade al nombre accesible, sin texto visible. */
  nuevaPestana: string;
  className?: string;
  conEtiqueta?: boolean;
  /** Si true, oculta el sobre (correo): se usa cuando los correos van aparte, etiquetados. */
  soloSocial?: boolean;
}) {
  const { telegram, instagram, email: emailRaw } = FONDO.redes;
  const email = soloSocial ? null : emailRaw;
  if (!telegram && !instagram && !email) return null;

  return (
    <nav aria-label={etiqueta} className={className}>
      {conEtiqueta ? (
        <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {etiqueta}
        </p>
      ) : null}
      <ul className={`flex flex-wrap items-center gap-3 ${conEtiqueta ? "mt-2" : ""}`}>
        {telegram ? <Enlace canal="telegram" href={telegram} nombre="Telegram" /> : null}
        {instagram ? <Enlace canal="instagram" href={instagram} nombre="Instagram" /> : null}
        {/* El sobre lleva al REDACTOR de Gmail con destinatario y asunto puestos, no a un
            `mailto:` que en muchos escritorios no hace nada (ver `lib/gmail.ts`). La
            dirección sigue siendo el nombre accesible: quien use lector de pantalla oye a
            dónde escribe, y el `title` la enseña al pasar el ratón para poder copiarla. */}
        {email ? (
          <Enlace
            canal="email"
            href={redactorGmail(email, asunto)}
            nombre={`${email} (${nuevaPestana})`}
          />
        ) : null}
      </ul>
    </nav>
  );
}
