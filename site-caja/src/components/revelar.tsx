import * as React from "react";

/**
 * Reveals en CSS puro — la versión sin JavaScript de `Rise` y `Stagger`.
 *
 * POR QUÉ EXISTE (26-sep-2026). `Rise` y `Stagger` son de framer-motion y sirven su
 * estado inicial como estilo EN LÍNEA: el HTML de `/la-caja` salía con 103 bloques
 * `style="opacity:0"`. Con el JS bloqueado, caído o simplemente aún sin hidratar, la
 * página del dinero estaba en blanco: ni las cuatro cifras de transparencia, ni el
 * desglose de gastos, ni los canales. En una web cuyo argumento es «mira en qué se
 * gasta el dinero», que las cifras dependan de que hidrate React es el peor sitio
 * posible para ponerlas.
 *
 * Esto anima lo mismo con la clase `.rise-in` de `globals.css`, que ya existía y no la
 * usaba nadie. Una animación CSS arranca en el primer pintado: no espera a React, no
 * necesita IntersectionObserver y, si el CSS no llegara, el contenido simplemente está.
 * `prefers-reduced-motion` la apaga entera, también en `globals.css`.
 *
 * QUÉ SE PIERDE, y por qué se acepta: el disparo por scroll. Estos reveals corren al
 * cargar, así que lo que está bajo el pliegue ya ha terminado de animar cuando llegas.
 * Se cambia coreografía por existencia — y solo donde el contenido es INFORMACIÓN. Para
 * lo ornamental, `Rise` y `Stagger` siguen siendo lo correcto y siguen en uso.
 *
 * NO es craft: vive solo en esta web (`motion.tsx` está bajo la guardia de deriva D-15
 * y no se toca). Si el patrón se repite en otro cliente, ahí se sube a la plantilla.
 */
export function Revelar({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Retardo en segundos. Úsalo con cuentagotas: retrasar información es lo que se vino a evitar. */
  delay?: number;
}) {
  return (
    <div
      className={className ? `rise-in ${className}` : "rise-in"}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Equivalente de `Stagger`: los hijos entran en cascada. El retardo se lo inyecta a cada
 * `RevelarItem` por índice — CSS no sabe contar hermanos para calcular un `animation-delay`.
 */
export function RevelarLista({
  children,
  className,
  paso = 0.08,
  inicio = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  /** Segundos entre un hijo y el siguiente. */
  paso?: number;
  /** Retardo del primer hijo. */
  inicio?: number;
}) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) =>
        React.isValidElement<{ style?: React.CSSProperties }>(child)
          ? React.cloneElement(child, {
              style: {
                ...child.props.style,
                animationDelay: `${(inicio + i * paso).toFixed(2)}s`,
              },
            })
          : child,
      )}
    </div>
  );
}

/** Un hijo de `RevelarLista`. El `style` se lo pone la lista; no hace falta pasarlo a mano. */
export function RevelarItem({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className ? `rise-in ${className}` : "rise-in"} style={style}>
      {children}
    </div>
  );
}
