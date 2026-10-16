/**
 * Muro de aportaciones — elemento de firma de ESTA marca (no del craft base).
 *
 * DERIVA DEL DATO, NO DE UN NÚMERO ESCRITO A MANO (26-sep-2026). Hasta entonces eran
 * `TOTAL = 84` unidades fijas y nueve acentos elegidos a ojo, mientras
 * `FONDO.cifras.aportaciones` decía 1.099; y el texto de al lado afirmaba que «cada
 * unidad representa una aportación», que era falso. Un adorno que parece un recuento, en
 * la página de transparencia, es el peor sitio posible para tener uno.
 *
 * SIN RETÍCULA. La primera versión pintaba los 110 cuadros y marcaba uno de cada diez. Dos
 * problemas, los dos de la coordinación y los dos ciertos: la retícula completa pesaba como
 * una tabla, y marcar «cada diez» en un grid de columnas fijas dibujaba una DIAGONAL — un
 * patrón que no significa nada y que el ojo lee como un error. Ahora solo se ven las
 * marcas, repartidas al azar sobre el mismo campo.
 *
 * SIN FRAMER, Y POR UN FALLO REAL. La entrada la hacía `whileInView` de framer, que sirve
 * su estado inicial como estilo en línea: `opacity:0;transform:scale(0.6)`. El observador
 * no llegaba a dispararse y el muro se quedaba INVISIBLE — medido en el navegador, con JS
 * corriendo. Es el mismo fallo que se arregló en el resto de la web (ver `revelar.tsx`), así
 * que aquí se aplica la misma medicina: la entrada es una animación CSS con retardo por
 * marca. Arranca en el primer pintado, no necesita observador, y sin JS el muro está ahí.
 *
 * Al dejar framer, esto deja de ser componente de cliente: no tiene estado ni eventos, solo
 * aritmética. Se pinta entero en el servidor.
 *
 * Cada marca = 100 aportaciones. La escala ya no se dice en un pie visible (la coordinación
 * lo retiró), pero sigue dicha en el NOMBRE ACCESIBLE, que es donde un lector de pantalla
 * pregunta qué está mirando. Sin dato verificado no se pinta nada (D-10/D-11).
 */

export type MuroStrings = {
  /** Nombre accesible. `{total}` = aportaciones reales, `{escala}` = las que vale cada marca. */
  ariaLabel: string;
};

/** Cuántas aportaciones representa cada cuadro marcado. */
const POR_MARCA = 100;
/** Celdas del campo sobre el que se reparten las marcas. Da el tamaño del bloque. */
const CELDAS = 110;

/**
 * Azar REPRODUCIBLE. Sembrado con las propias aportaciones: el reparto es el mismo en cada
 * render y solo cambia cuando cambia la cifra, que es justo cuando queremos que cambie. Con
 * `Math.random()` el muro se recolocaría en cada visita y en cada revalidación, y un muro
 * que se baraja solo no es un recuento de nada.
 */
function posiciones(semilla: number, marcas: number, celdas: number): Set<number> {
  let s = (semilla * 2654435761) >>> 0;
  const siguiente = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const puestas = new Set<number>();
  // Reparto por tramos: una marca por cada tramo del campo, colocada al azar DENTRO de su
  // tramo. El azar puro dejaba huecos enormes y pegotes de tres marcas juntas — parecía
  // roto, no aleatorio.
  const tramo = celdas / marcas;
  for (let i = 0; i < marcas; i++) {
    const desde = Math.floor(i * tramo);
    const hasta = Math.max(desde + 1, Math.floor((i + 1) * tramo));
    let p = desde + Math.floor(siguiente() * (hasta - desde));
    while (puestas.has(p) && p < celdas) p++;
    if (p < celdas) puestas.add(p);
  }
  return puestas;
}

export function MuroAportaciones({
  aportaciones,
  s,
  lang,
}: {
  /** Cifra verificada. `null` = todavía no hay dato, y entonces no hay muro. */
  aportaciones: number | null;
  s: MuroStrings;
  lang: string;
}) {
  if (aportaciones === null || aportaciones <= 0) return null;

  const marcas = Math.min(CELDAS, Math.max(1, Math.round(aportaciones / POR_MARCA)));
  const marcadas = [...posiciones(aportaciones, marcas, CELDAS)].sort((a, b) => a - b);
  const orden = new Map(marcadas.map((p, i) => [p, i]));
  const num = new Intl.NumberFormat(lang);
  const ariaLabel = s.ariaLabel
    .replace("{total}", num.format(aportaciones))
    .replace("{escala}", num.format(POR_MARCA));

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1.5"
    >
      {Array.from({ length: CELDAS }, (_, i) => {
        const n = orden.get(i);
        // Las celdas vacías se pintan igual, sin relleno: sostienen la retícula para que las
        // marcas caigan siempre donde deben. Quitarlas del DOM desmontaría el reparto.
        if (n === undefined) return <span key={i} className="muro-hueco" />;
        return (
          <span
            key={i}
            className="muro-marca"
            style={{ animationDelay: `${(0.05 + n * 0.05).toFixed(2)}s` }}
          />
        );
      })}
    </div>
  );
}
