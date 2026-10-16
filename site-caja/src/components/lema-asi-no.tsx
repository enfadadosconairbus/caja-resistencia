import type { CSSProperties } from "react";

/** Orden de entrada de cada pieza: la animación la escalona con `--i`. */
const orden = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * EL LEMA «ASÍ, NO» — el emblema de la huelga de 2026, en el hueco derecho de «Lo que ha
 * costado» de su ficha (hasta el 1-oct-2026 iba en el hero; ese hueco es ahora de la ficha
 * del conflicto).
 *
 * No es la imagen: se compone con la letra de la web (Archivo a peso máximo) y el Ø va en
 * SVG. Así sale nítido a cualquier tamaño, cambia de color con el tema y no pesa bytes
 * (D-32). Fiel al original en lo que lo hace reconocible: dos filas, «N» en azul acero y
 * «Ø» tachado como una señal de prohibido.
 *
 * Colores: `--color-lema` y `--color-lema-n` (globals.css). En claro, el marino y el acero
 * del cartel; de noche, papel y un acero aclarado para que la «N» no se hunda en el azul.
 *
 * Es decorativo: el <h1> de la ficha ya dice «Así, no!». Por eso va como imagen con
 * etiqueta y no como texto que un lector de pantalla leería dos veces letra a letra.
 * El movimiento (letras que suben y la barra que se traza) está en globals.css, dentro de
 * `prefers-reduced-motion: no-preference`.
 */
export function LemaAsiNo({ pie }: { pie: string }) {
  return (
    <figure className="lema-asi-no" role="img" aria-label="Así, no">
      <div className="lema-fila" aria-hidden="true">
        <span style={orden(0)}>A</span>
        <span style={orden(1)}>S</span>
        <span style={orden(2)}>Í</span>
        <span className="lema-coma" style={orden(3)}>,</span>
      </div>
      <div className="lema-fila" aria-hidden="true">
        <span className="lema-n" style={orden(4)}>N</span>
        <svg className="lema-o" viewBox="0 0 100 100" style={orden(5)}>
          <circle cx="50" cy="50" r="38.5" />
          <line className="lema-barra" x1="23" y1="23" x2="77" y2="77" pathLength={1} />
        </svg>
      </div>
      <figcaption className="lema-pie" aria-hidden="true">{pie}</figcaption>
    </figure>
  );
}
