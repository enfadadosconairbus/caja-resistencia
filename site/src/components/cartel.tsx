/**
 * Cartel de campaña — banda a sangre entre el hero y "el conflicto".
 *
 * Va DEBAJO del hero tipográfico, no detrás: así el titular conserva su contraste
 * AA sobre papel, no hereda el LCP de una imagen pesada, y el sistema de reveals
 * firma sigue mandando arriba. Sin parallax (rechazado por el curator para causas
 * cívicas: `design-intelligence/rejected-patterns/hero-parallax-en-causas-civicas.md`).
 *
 * <picture> en vez de dos <Image>: con `hidden`/`block` el navegador se descarga las
 * dos y se pagan 358 KB en todos los dispositivos. Aquí solo baja la que toca.
 * El `aspect-*` reserva la caja en ambos encuadres → sin CLS.
 *
 * ⚠️ PENDIENTE DE CLEARANCE LEGAL (INC-004): librea y marca de Airbus + King Kong.
 * Para retirarlo: borra este archivo, su uso en `page.tsx`, las claves `cartel` de
 * los diccionarios y `public/img/cartel-*.webp`.
 */
const DESKTOP = "/img/cartel-desktop.webp";
const MOBILE = "/img/cartel-mobile.webp";

// Centros de Airbus España en huelga, en orden alfabético (los pidió la coordinación).
const CENTROS = ["Albacete", "Cádiz", "Getafe", "Illescas", "San Pablo", "Tablada"];

export function Cartel({ alt, centrosLabel }: { alt: string; centrosLabel: string }) {
  return (
    // El fondo de la caja es tinta FIJA, no `--color-tinta`: en modo noche esa se vuelve
    // papel y la banda destellaría en claro mientras baja la imagen (va `lazy`).
    <figure className="border-y border-[var(--color-linea)] bg-[var(--color-tinta-fija)]">
      <div className="relative">
        <picture>
          <source media="(min-width: 768px)" srcSet={DESKTOP} width={1280} height={720} />
          <img
            src={MOBILE}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full object-cover md:aspect-[16/9]"
          />
        </picture>

        {/* Nombres de los centros, sobre la banda superior del cielo. El degradado solo
            oscurece arriba (via-transparent antes del centro), así el foco de la imagen
            —avión, Kong, multitud— queda limpio. Tipografía de cartel: Archivo en
            versales, tracking amplio y sombra para legibilidad sobre el cielo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/25 to-transparent px-5 pb-12 pt-4 md:pt-6">
          <ul
            aria-label={centrosLabel}
            className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 font-[family-name:var(--ff-display)] text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-papel-fijo)] sm:gap-x-4 sm:text-base md:text-lg"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
          >
            {CENTROS.map((c, i) => (
              <li key={c} className="flex items-center gap-x-3 sm:gap-x-4">
                {i > 0 ? (
                  <span aria-hidden="true" className="text-[var(--color-acento-tinta)]">
                    ·
                  </span>
                ) : null}
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

    </figure>
  );
}
