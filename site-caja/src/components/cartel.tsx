/**
 * Cartel de campaña — banda a sangre bajo la banda azul de la portada.
 *
 * La ilustración es la misma que abre la web del movimiento (Web A). Aquí va DEBAJO del
 * hero tipográfico, no encima ni detrás, por las mismas razones que allí y por una más
 * que es de esta web:
 *
 *  · El titular conserva su contraste sobre el azul y no hereda el LCP de una imagen de
 *    200 KB.
 *  · Lo primero que se ve sigue siendo «Que nadie tenga que rendirse por dinero» con el
 *    botón de Aportar, que es el camino que esta web existe para recorrer. Medido a
 *    1440×900: el CTA acaba en 667 px, dentro del pliegue. Metiendo la imagen encima se
 *    iría a ~970 px, o sea fuera de pantalla.
 *
 * A TAMAÑO COMPLETO. Estuvo un día acotada a `42vh` (378 px a 1440 de ancho) para que la
 * ilustración se viera entera sin bajar; la coordinación la quiere al tamaño original, así
 * que va a 16/9 a sangre como en la Web A — 810 px de alto a 1440. Se ve al bajar, no de
 * entrada, y a cambio la escena no se recorta: el avión entero, Kong y la primera fila de
 * puños. El recorte se hacía con `max-h` y `object-cover`; ahora `aspect-video` manda sola.
 *
 * ⚠️ PENDIENTE DE CLEARANCE LEGAL (INC-004, heredado de la Web A): la ilustración usa
 * librea y marca de Airbus, y un King Kong. Aquí pesa MÁS que allí, porque esta web pide
 * dinero y va a un dominio a nombre del sindicato. Para retirarlo: borra este fichero, su
 * uso en `[lang]/page.tsx`, las claves `cartel` de los cuatro diccionarios y
 * `public/img/cartel.webp`.
 */
const CARTEL = "/img/cartel.webp";

export function Cartel({ alt }: { alt: string }) {
  return (
    // Fondo de tinta FIJA: mientras la imagen baja (va `lazy`), la banda no puede
    // destellar en claro al cambiar de tema.
    <figure className="border-y border-[var(--color-linea)] bg-[#101114]">
      <img
        src={CARTEL}
        alt={alt}
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
        // `aspect-video` reserva la caja antes de que baje la imagen → sin salto de layout.
        // Sin tope de altura: la ilustración va entera, a su 16/9.
        className="aspect-video w-full object-cover"
      />
    </figure>
  );
}
