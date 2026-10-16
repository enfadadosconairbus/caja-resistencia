"use client";

import * as React from "react";

/**
 * POLVO — motas que derivan despacio y se apartan del ratón, sobre las bandas de pizarra de
 * la portada («Últimas noticias» y «Estado de la negociación»).
 *
 * Traído de la web de Pingüy (`clientes/pinguy/site/src/components/ui/polvo.tsx`, 1-oct-2026),
 * con su misma disciplina de coste —sin colisiones entre motas, coste lineal—, cambiando solo
 * la paleta: papel en vez de nieve y, una de cada nueve, el coral fijo de la marca en vez de
 * la ascua. NO es craft: vive en esta web; si un tercer sitio lo quiere, se sube a la plantilla.
 *
 *   · **No se renderiza en el servidor.** Monta tras la hidratación: el canvas no existe
 *     cuando se resuelve el LCP y no compite por él.
 *   · **`prefers-reduced-motion` → no arranca.** Ni el canvas se crea.
 *   · **Se para cuando no se ve** (IntersectionObserver) y con la pestaña oculta.
 *   · **El ratón solo influye en `pointer: fine`.** En táctil, deriva suave.
 *   · `pointer-events: none`: nunca se interpone entre el dedo y un enlace.
 *   · **`z-index: -1`** dentro de una banda con `isolation: isolate` (clase `.grano`): se pinta
 *     encima del fondo y del grano y debajo de todo el contenido, sin promover a los hijos.
 */

type Mota = {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  ascua: boolean;
  fase: number;
};

/* Densidad. Se subió ~3x a petición de la coordinación tras ver la primera versión.
   Sigue siendo textura, no espectáculo: ~112 motas en un hero de 1440×656.
   El coste es LINEAL en el número de motas porque no hay colisiones — que es
   justo lo que se quitó del componente original. Duplicar aquí es barato;
   duplicar con colisiones habría sido cuadrático. */
const DENSIDAD = 0.00012;
/* El tope solo es una red de seguridad, no el regulador. Estaba en 160 y la
   banda «La casa» (1425×1194) lo tocaba, así que le salía MENOS densidad que al
   hero — justo lo contrario de lo pedido. A 240 ninguna banda lo alcanza y la
   densidad es de verdad la misma en las cuatro. Sigue siendo barato: sin
   colisiones, el coste es lineal, y las bandas fuera de pantalla ni se pintan. */
const MAX_MOTAS = 240;
const RADIO_RATON = 130;
const FUERZA = 0.55;
const REGRESO = 0.012;
const ROCE = 0.94;

export function Polvo() {
  const ref = React.useRef<HTMLCanvasElement>(null);

  /* `useSyncExternalStore` en vez de un `useState` + `useEffect`: en el
     servidor devuelve `false` (no hay canvas en el HTML, así que no compite por
     el LCP) y en el cliente lee `prefers-reduced-motion` sin provocar un render
     en cascada. Es el mismo patrón que usa `MagneticButton` del craft para
     `pointer: fine` (PILOT-FIX-001). */
  const activo = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  React.useEffect(() => {
    if (!activo) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let motas: Mota[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const raton = { x: -9999, y: -9999, dentro: false };

    const dimensionar = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = Math.min(Math.floor(w * h * DENSIDAD), MAX_MOTAS);
      motas = Array.from({ length: n }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
          x,
          y,
          ox: x,
          oy: y,
          vx: 0,
          vy: 0,
          r: 0.6 + Math.random() * 1.5,
          a: 0.12 + Math.random() * 0.22,
          // Una de cada nueve en coral: el acento, con cuentagotas.
          ascua: Math.random() > 0.89,
          fase: Math.random() * Math.PI * 2,
        };
      });
    };

    const pintar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motas) {
        // Deriva orgánica lentísima
        m.ox += Math.sin(t * 0.00007 + m.fase) * 0.045;
        m.oy += Math.cos(t * 0.00006 + m.fase) * 0.035;
        if (m.ox < 0) m.ox = w;
        if (m.ox > w) m.ox = 0;
        if (m.oy < 0) m.oy = h;
        if (m.oy > h) m.oy = 0;

        if (raton.dentro) {
          const dx = m.x - raton.x;
          const dy = m.y - raton.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < RADIO_RATON * RADIO_RATON && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = ((RADIO_RATON - d) / RADIO_RATON) * FUERZA;
            m.vx += (dx / d) * f;
            m.vy += (dy / d) * f;
          }
        }

        // Muelle de vuelta al origen, sin colisiones entre motas
        m.vx += (m.ox - m.x) * REGRESO;
        m.vy += (m.oy - m.y) * REGRESO;
        m.vx *= ROCE;
        m.vy *= ROCE;
        m.x += m.vx;
        m.y += m.vy;

        const parpadeo = 0.75 + 0.25 * Math.sin(t * 0.0012 + m.fase);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.ascua
          ? `rgba(255, 127, 97, ${(m.a * parpadeo * 1.15).toFixed(3)})`
          : `rgba(247, 247, 245, ${(m.a * parpadeo).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(pintar);
    };

    const arrancar = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };
    const parar = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!finePointer) return;
      const r = cv.getBoundingClientRect();
      raton.x = e.clientX - r.left;
      raton.y = e.clientY - r.top;
      raton.dentro = true;
    };
    const onLeave = () => {
      raton.dentro = false;
    };
    const onVis = () => {
      if (document.hidden || !visible) parar();
      else arrancar();
    };

    dimensionar();
    const ro = new ResizeObserver(dimensionar);
    ro.observe(cv);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !document.hidden) arrancar();
        else parar();
      },
      { threshold: 0 },
    );
    io.observe(cv);

    if (finePointer) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      parar();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [activo]);

  if (!activo) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[-1] block h-full w-full"
    />
  );
}
