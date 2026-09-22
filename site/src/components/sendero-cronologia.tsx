"use client";
import * as React from "react";
import Image from "next/image";
import { fechaES } from "@/lib/formato";
import type { Hito, Texto } from "@/components/linea-temporal";
import { PrensaHito } from "@/components/prensa-hito";

/**
 * Sendero de la cronología — el conflicto como un camino que baja serpenteando.
 *
 * Sustituye al mural horizontal. El muro fallaba en lo esencial: al colocar los hitos por
 * fecha sobre un eje de píxeles-por-día, dos hitos del mismo día caían en la misma `x` y las
 * fichas se pisaban unas a otras. Aquí la geometría hace imposible ese solape:
 *
 * 1. **Dos hitos por fila, en dos columnas fijas.** La `y` no la decide la fecha, la decide el
 *    orden; la fecha solo *estira* la fila (`DIA_PX`), así que se sigue notando que junio va a
 *    saltos de seis días y julio día a día. Empezó con un hito por fila y salían 4.250 px de
 *    sección: mucho scroll para una portada. Con dos por fila baja a ~2.500.
 * 2. **Las dos columnas no comparten ni un píxel de `x`.** La izquierda ocupa una franja y la
 *    derecha otra, con un pasillo en medio por donde baja el camino. Da igual lo que se
 *    aprieten las filas: dos fichas no pueden tocarse.
 * 3. **Los dos hitos de una fila van desfasados en vertical** (`DESFASE`). No es estética: si
 *    estuvieran a la misma altura el camino tendría que ir y volver en horizontal, que se lee
 *    como un zigzag. Bajando en diagonal, el trazo describe una S por fila y el orden de
 *    lectura se sigue solo.
 * 4. **Cada ficha cuelga de un brazo.** Del nodo sale una línea corta hasta el borde de la
 *    ficha —hacia fuera, a su columna— y dentro una costilla vertical enhebra foto, documentos
 *    y prensa. La conexión entre el hito y su documentación de apoyo se ve, no se supone.
 *
 * El recorrido se dibuja al bajar: cada tramo de curva y su ficha aparecen cuando entran en
 * pantalla, así que el sendero *crece* con el scroll. Con `prefers-reduced-motion` está todo
 * dibujado desde el principio. Sin JavaScript también: lo que se anima es la aparición, no el
 * contenido.
 *
 * En pantalla estrecha no hay sendero —dos carriles a 300 px no son un serpenteo, son una
 * lista torcida—: por debajo de `xl` se sirve el raíl vertical de `linea-temporal.tsx`.
 */

export type SenderoStrings = {
  hoy: string;
  futuro: string;
  documentos: string;
  prensa: string;
  instruccion: string;
};

const COLOR: Record<string, string> = {
  huelga: "var(--color-acento-tinta)",
  ruptura: "var(--color-acento-tinta)",
  movilizacion: "var(--color-acento-tinta)",
  votacion: "var(--color-confianza-tinta)",
  negociacion: "var(--color-confianza-tinta)",
  documento: "var(--color-tinta-suave)",
  futuro: "var(--color-tinta-suave)",
};

// ── Geometría del sendero, en píxeles CSS ─────────────────────────────────────
/**
 * El lienzo mide siempre lo mismo, y por eso el sendero solo se sirve a partir de `xl`: la
 * sección vive dentro de un `max-w-6xl px-5`, que deja 1112 px útiles. Con 1024 sobra sitio
 * a 1280 px de ventana, que es donde arranca `xl`. Escalarlo a la ventana obligaría a medir
 * en cliente, y medir significa un salto de maquetación en la primera pintura.
 */
const ANCHO = 1024;
const MARGEN = 10;
/**
 * Ficha: mismo ancho abierta que cerrada.
 *
 * Antes crecía al abrirse. Ya no cabe: la ficha de la columna izquierda tiene el borde derecho
 * clavado en su brazo, así que crecer solo puede hacerlo hacia la izquierda, y a la izquierda
 * quedan 10 px. A cambio la ficha en reposo pasa de 300 a 370 px, que es más de lo que medía
 * abierta antes: se gana sitio donde importa, en el titular.
 */
const FICHA = 370;
/**
 * Alto de la ficha en reposo, y es un compromiso, no una medida: cabe la fecha, el inventario
 * y dos líneas de titular. El titular se recorta a esas dos líneas (`line-clamp-2`) porque de
 * ese tope depende que las filas no se toquen; entero se lee al abrir.
 */
const FICHA_ALTO = 96;
/** Brazo que va del nodo al borde de la ficha. */
const BRAZO = 44;
/** El brazo entra en la ficha a esta distancia de su borde superior, abierta o cerrada. */
const ANCLA = 48;

/** Las dos columnas de fichas. No comparten ni un píxel de `x`, y de ahí sale la garantía. */
const COL_IZQ = MARGEN; //                       10 … 380
const COL_DER = ANCHO - MARGEN - FICHA; //      644 … 1014
/** Los dos carriles del camino, en el pasillo que queda entre columnas. */
const XA = COL_IZQ + FICHA + BRAZO; //          424
const XB = COL_DER - BRAZO; //                  600

/**
 * Desfase vertical entre los dos hitos de una fila.
 *
 * Con los dos a la misma altura, el camino tendría que ir y volver en horizontal para
 * visitarlos, y eso se lee como un zigzag, no como un recorrido. Bajando en diagonal el trazo
 * describe una S por fila y el orden se sigue solo.
 */
const DESFASE = 62;
/**
 * Separación entre filas. Dos fichas de una misma columna van una `FILA` aparte, así que este
 * número menos el alto de ficha (~98) es el hueco entre ellas: con 124 quedan ~26 px, apretado
 * pero sin rozarse. Bajó de 140 a 124 para compactar más el conjunto (petición del 11-ago).
 */
const FILA = 124;
/** Cuánto estira la fila cada día de calendario transcurrido, y su tope. */
const DIA_PX = 4;
const ESTIRON = 44;
const AIRE_ARRIBA = 64;
/**
 * Aire de sobra al final: ahí cabe abierta la última ficha, y el camino sigue punteado. Con la
 * última ficha abierta medía 129 px de holgura sobre 300, así que baja a 220 —margen ~50—.
 */
const AIRE_ABAJO = 220;

const t = (x: Texto, lang: string) => x[lang] ?? x.es;
const dias = (a: number, b: number) => Math.max(0, (b - a) / 86400000);

type Nodo = { x: number; y: number; izq: boolean; futuro: boolean; color: string };

/**
 * Coloca los hitos y devuelve, además, los tramos de curva que los unen.
 *
 * Par → columna izquierda, impar → columna derecha, y el impar además baja `DESFASE`. Con eso
 * la `y` crece siempre con el orden del hito —el desfase (62) nunca alcanza a la fila (≥140)—,
 * que es lo que permite interpolar fechas más abajo sin más cuidados.
 *
 * Cada tramo es una cúbica con los tiradores en vertical: el camino entra y sale de cada hito
 * recto y el bamboleo queda en medio. En los tramos de dentro de una fila el desnivel es corto,
 * así que el tirador tiene un mínimo; si no, la curva se aplana y parece un codo.
 */
function trazar(hitos: Hito[], hoy: number) {
  const nodos: Nodo[] = [];
  let base = AIRE_ARRIBA;

  hitos.forEach((h, i) => {
    const izq = i % 2 === 0;
    // Fila nueva: el estirón lo marca el salto entre el primer hito de esta fila y el de la
    // anterior, que son los dos que ocupan la misma columna.
    if (izq && i > 0) {
      const salto = dias(Date.parse(hitos[i - 2].fecha), Date.parse(h.fecha));
      base += FILA + Math.min(ESTIRON, salto * DIA_PX);
    }
    nodos.push({
      x: izq ? XA : XB,
      y: izq ? base : base + DESFASE,
      izq,
      futuro: Date.parse(h.fecha) > hoy,
      color: COLOR[h.tipo] ?? "var(--color-tinta-suave)",
    });
  });

  const tramos = nodos.slice(1).map((n, i) => {
    const p = nodos[i];
    const k = Math.max((n.y - p.y) * 0.55, 34);
    return { d: `M ${p.x} ${p.y} C ${p.x} ${p.y + k} ${n.x} ${n.y - k} ${n.x} ${n.y}`, hasta: i + 1 };
  });

  return { nodos, tramos, alto: (nodos.at(-1)?.y ?? 0) + AIRE_ABAJO };
}

/** `y` de una fecha cualquiera, interpolando entre los hitos que la rodean. */
function yDeFecha(iso: string, hitos: Hito[], nodos: Nodo[]) {
  const t1 = Date.parse(iso);
  if (!nodos.length) return 0;
  if (t1 <= Date.parse(hitos[0].fecha)) return nodos[0].y;
  for (let i = 1; i < hitos.length; i++) {
    const a = Date.parse(hitos[i - 1].fecha);
    const b = Date.parse(hitos[i].fecha);
    if (t1 <= b) {
      const p = b === a ? 1 : (t1 - a) / (b - a);
      return nodos[i - 1].y + (nodos[i].y - nodos[i - 1].y) * p;
    }
  }
  return nodos[nodos.length - 1].y;
}

/** Primeros de mes que cruza el recorrido, para no perder de vista el calendario. */
function meses(hitos: Hito[], nodos: Nodo[], lang: string) {
  if (!hitos.length) return [];
  const nombre = (d: Date) =>
    new Intl.DateTimeFormat(lang, { month: "long", timeZone: "UTC" }).format(d);
  const fin = Date.parse(hitos[hitos.length - 1].fecha);
  const out: { y: number; etiqueta: string; primero: boolean }[] = [];

  const d0 = new Date(Date.parse(hitos[0].fecha));
  out.push({ y: nodos[0].y, etiqueta: nombre(d0), primero: true });

  const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
  while (d.getTime() <= fin) {
    out.push({
      y: yDeFecha(d.toISOString().slice(0, 10), hitos, nodos),
      etiqueta: nombre(d),
      primero: false,
    });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export function SenderoCronologia({
  hitos,
  hoyISO,
  lang,
  s,
}: {
  hitos: Hito[];
  /** «Hoy» lo calcula el servidor: si lo hiciera el cliente, no casaría al hidratar. */
  hoyISO: string;
  lang: string;
  s: SenderoStrings;
}) {
  const [abierto, setAbierto] = React.useState<number | null>(null);
  const [motor, setMotor] = React.useState(false);
  const [visto, setVisto] = React.useState<Set<number>>(new Set());
  const caja = React.useRef<HTMLDivElement>(null);
  const filas = React.useRef<(HTMLLIElement | null)[]>([]);

  const hoy = Date.parse(hoyISO);
  const { nodos, tramos, alto } = React.useMemo(() => trazar(hitos, hoy), [hitos, hoy]);
  const escala = React.useMemo(() => meses(hitos, nodos, lang), [hitos, nodos, lang]);
  const yHoy = yDeFecha(hoyISO, hitos, nodos);
  const hoyDentro = hoy >= Date.parse(hitos[0]?.fecha ?? hoyISO);

  // ── El sendero se dibuja al bajar ───────────────────────────────────────────
  // Fallar del lado seguro es aquí más importante que la animación: si algo va mal, lo que
  // debe quedar es la cronología entera, nunca una sección en blanco. Por eso el motor no se
  // enciende «al montar», sino dentro del propio observador, en su primera entrega —esa que
  // el navegador manda siempre, para todos los objetivos, intersequen o no—. Mientras no
  // llegue, `motor` sigue apagado y todo se ve: sin JavaScript, sin `IntersectionObserver`,
  // con el movimiento reducido o en una pestaña que no compone, la salida es la misma.
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let primera = true;
    const obs = new IntersectionObserver(
      (entradas) => {
        // Apagar y encender en el mismo commit: los hitos que ya están en pantalla no
        // llegan a parpadear.
        if (primera) {
          primera = false;
          setMotor(true);
        }
        const dentro = entradas.filter((e) => e.isIntersecting);
        if (!dentro.length) return;
        setVisto((v) => {
          const s2 = new Set(v);
          dentro.forEach((e) => s2.add(Number((e.target as HTMLElement).dataset.i)));
          return s2;
        });
        dentro.forEach((e) => obs.unobserve(e.target));
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    filas.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Cerrar al tocar fuera o con Escape: en táctil no hay «salir del hito».
  React.useEffect(() => {
    if (abierto == null) return;
    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(null);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const dibujado = (i: number) => !motor || visto.has(i);

  return (
    <div className="mt-10 hidden xl:block">
      <Sprite />
      <p className="mb-6 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {s.instruccion}
      </p>

      <div ref={caja} className="relative mx-auto" style={{ width: ANCHO, height: alto }}>
        {/* ── El camino, la escala y los brazos ──
            Un solo lienzo detrás de las fichas. No recibe puntero: lo que se pulsa son los
            botones, no el dibujo. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={ANCHO}
          height={alto}
          viewBox={`0 0 ${ANCHO} ${alto}`}
          aria-hidden="true"
        >
          {/* Entrada al recorrido */}
          <path
            d={`M ${nodos[0]?.x ?? XA} ${AIRE_ARRIBA - 44} L ${nodos[0]?.x ?? XA} ${nodos[0]?.y ?? AIRE_ARRIBA}`}
            fill="none"
            stroke="var(--color-acento-tinta)"
            strokeWidth={2}
          />

          {/* Tramos de camino. `pathLength=1` deja el trazo normalizado: se dibuja con
              dashoffset sin tener que medirlo. */}
          {tramos.map((tr) => {
            const futuro = nodos[tr.hasta].futuro;
            return (
              <path
                key={tr.hasta}
                d={tr.d}
                fill="none"
                stroke={futuro ? "var(--color-tinta-suave)" : "var(--color-acento-tinta)"}
                strokeWidth={2}
                strokeDasharray={futuro ? "6 6" : undefined}
                pathLength={futuro ? undefined : 1}
                style={
                  futuro
                    ? { opacity: dibujado(tr.hasta) ? 0.5 : 0, transition: "opacity .5s ease" }
                    : {
                        strokeDasharray: 1,
                        strokeDashoffset: dibujado(tr.hasta) ? 0 : 1,
                        transition: "stroke-dashoffset .7s cubic-bezier(.22,.61,.36,1)",
                      }
                }
              />
            );
          })}

          {/* Meses y HOY.
              Van DESPUÉS del camino y antes de los nodos, con un recuadro del color del
              fondo detrás del texto: la etiqueta cae en el pasillo central, que es justo por
              donde baja el trazo, y sin ese recuadro el camino la cruzaría por la mitad.
              Tampoco pueden ir al margen, como antes: ahí ahora hay ficha. */}
          {escala.map((m) => (
            <g key={`${m.etiqueta}-${m.y}`}>
              <line x1={MARGEN} x2={ANCHO - MARGEN} y1={m.y} y2={m.y} stroke="var(--color-linea)" strokeDasharray="2 7" />
              <EtiquetaEje y={m.y} texto={m.etiqueta} color="var(--color-tinta-suave)" />
            </g>
          ))}
          {hoyDentro ? (
            <g>
              <line x1={MARGEN} x2={ANCHO - MARGEN} y1={yHoy} y2={yHoy} stroke="var(--color-tinta)" strokeWidth={1} opacity={0.35} />
              <EtiquetaEje y={yHoy} texto={s.hoy} color="var(--color-tinta)" />
            </g>
          ) : null}

          {/* Brazo del nodo a la ficha, y nodo.
              El brazo apunta hacia FUERA, a su columna: el camino baja por el pasillo
              central y las fichas cuelgan a los lados. */}
          {nodos.map((n, i) => {
            const activo = abierto === i;
            const xFin = n.izq ? n.x - BRAZO : n.x + BRAZO;
            return (
              <g
                key={i}
                style={{ opacity: dibujado(i) ? 1 : 0, transition: "opacity .45s ease .15s" }}
              >
                <line
                  x1={n.x}
                  x2={xFin}
                  y1={n.y}
                  y2={n.y}
                  stroke={activo ? "var(--color-tinta)" : "var(--color-linea)"}
                  strokeWidth={activo ? 2 : 1}
                />
                <circle
                  cx={xFin}
                  cy={n.y}
                  r={activo ? 3 : 2}
                  fill={activo ? "var(--color-tinta)" : "var(--color-linea)"}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={5.5}
                  fill={n.futuro ? "var(--color-fondo)" : n.color}
                  stroke={n.futuro ? n.color : "var(--color-fondo)"}
                  strokeWidth={2}
                />
                {activo ? (
                  <circle cx={n.x} cy={n.y} r={11} fill="none" stroke={n.color} strokeWidth={1} opacity={0.5} />
                ) : null}
              </g>
            );
          })}

          {/* Salida: el recorrido no termina, sigue */}
          <path
            d={`M ${nodos.at(-1)?.x ?? XA} ${nodos.at(-1)?.y ?? 0} L ${nodos.at(-1)?.x ?? XA} ${alto - 56}`}
            fill="none"
            stroke="var(--color-tinta-suave)"
            strokeWidth={2}
            strokeDasharray="6 6"
            opacity={0.5}
          />
        </svg>

        {/* ── Fichas ── */}
        <ol className="absolute inset-0">
          {hitos.map((h, i) => {
            const n = nodos[i];
            const activo = abierto === i;
            const izquierda = n.izq ? COL_IZQ : COL_DER;
            const nDocs = h.docs?.length ?? 0;
            const nPrensa = h.prensa?.length ?? 0;

            return (
              <li
                key={`${h.fecha}-${i}`}
                ref={(el) => {
                  filas.current[i] = el;
                }}
                data-i={i}
                className="absolute"
                style={{
                  top: n.y - ANCLA,
                  left: izquierda,
                  width: FICHA,
                  zIndex: activo ? 30 : 10,
                  opacity: dibujado(i) ? 1 : 0,
                  // Cada ficha entra desde su propio lado, como si el camino la depositara.
                  transform: dibujado(i) ? "none" : `translateX(${n.izq ? -14 : 14}px)`,
                  transition: "opacity .45s ease .15s, transform .45s ease .15s",
                }}
                onPointerEnter={(e) => e.pointerType === "mouse" && setAbierto(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setAbierto((v) => (v === i ? null : v))}
              >
                {/* La ficha NO es un botón: botón es solo su cabecera.
                    Dentro del panel abierto hay enlaces —documentos y ahora también artículos
                    de prensa—, y un enlace dentro de un `<button>` es HTML inválido: los
                    lectores de pantalla presentan el conjunto como un único control y los
                    enlaces dejan de existir para quien no usa ratón. Con el patrón de
                    revelación —cabecera pulsable + panel de contenido— cada cosa es lo que
                    dice ser y se recorre entera con el tabulador. */}
                <div
                  className={`rounded-lg border bg-[var(--color-fondo)] p-4 transition-[border-color,box-shadow] duration-200 ${
                    activo
                      ? "border-[var(--color-tinta)] shadow-[0_14px_40px_var(--sombra-media)]"
                      : "border-[var(--color-linea)] hover:border-[var(--color-tinta-suave)]"
                  }`}
                  style={{ minHeight: FICHA_ALTO }}
                >
                  <button
                    type="button"
                    aria-expanded={activo}
                    onClick={() => setAbierto((v) => (v === i ? null : i))}
                    onFocus={() => setAbierto(i)}
                    className="block w-full text-left"
                  >
                  {/* Fecha e inventario comparten renglón: cada línea de más en reposo es una
                      línea que hay que descontar de la separación entre filas. */}
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: n.futuro ? "transparent" : n.color,
                          boxShadow: n.futuro ? `inset 0 0 0 2px ${n.color}` : undefined,
                        }}
                      />
                      <span className="truncate font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                        {fechaES(h.fecha, lang, { day: "numeric", month: "short" })}
                        {n.futuro ? ` · ${s.futuro}` : ""}
                      </span>
                    </span>

                    {/* El inventario de lo que cuelga del hito. Ni la foto ni los documentos
                        se enseñan recortados para caber en la ficha: se anuncian. */}
                    {h.imagen || nDocs || nPrensa ? (
                      <span className="flex shrink-0 items-center gap-2.5 font-[family-name:var(--ff-mono)] text-[10px] text-[var(--color-tinta-suave)]">
                        {h.imagen ? (
                          <span className="flex items-center gap-1">
                            <Icono de="foto" />1
                          </span>
                        ) : null}
                        {nDocs ? (
                          <span className="flex items-center gap-1">
                            <Icono de="doc" />
                            {nDocs}
                          </span>
                        ) : null}
                        {nPrensa ? (
                          <span className="flex items-center gap-1">
                            <Icono de="prensa" />
                            {nPrensa}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={`mt-2 block font-[family-name:var(--ff-display)] text-[15px] font-bold leading-snug text-[var(--color-tinta)] ${
                      activo ? "" : "line-clamp-2"
                    }`}
                  >
                    {t(h.titulo, lang)}
                  </span>
                  </button>

                  {/* Abierta: todo lo que sostiene el hito, enhebrado por una costilla que
                      arranca del brazo. La línea no es adorno: dice de dónde cuelga cada cosa. */}
                  {activo ? (
                    <div className="mt-3 border-l border-[var(--color-linea)] pl-4">
                      <p className="text-[13px] leading-relaxed text-[var(--color-tinta-suave)]">
                        {t(h.texto, lang)}
                      </p>

                      {h.imagen ? (
                        <figure className="mt-3">
                          <Image
                            src={h.imagen.src}
                            alt={t(h.imagen.alt, lang)}
                            width={h.imagen.w}
                            height={h.imagen.h}
                            sizes={`${FICHA}px`}
                            className="block h-auto w-full rounded border border-[var(--color-linea)]"
                          />
                          {h.imagen.pie ? (
                            <figcaption className="mt-2 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">
                              {t(h.imagen.pie, lang)}
                            </figcaption>
                          ) : null}
                        </figure>
                      ) : null}

                      {nDocs ? (
                        <div className="mt-3">
                          <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                            {s.documentos}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {h.docs?.map((d) => (
                              <a
                                key={d.pdf}
                                href={d.pdf}
                                download
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-tinta)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
                              >
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="M10 3v10m0 0 4-4m-4 4-4-4M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {t(d.titulo, lang)}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {h.prensa?.length ? (
                        <PrensaHito prensa={h.prensa} etiqueta={s.prensa} className="mt-3 text-[10px]" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/**
 * Los tres iconos del inventario, dibujados una sola vez.
 *
 * Van como `<symbol>` y no como componente porque se repiten en casi las treinta fichas, y
 * cada icono dibujado a pelo son cinco elementos de DOM. Aquí cada uso son dos (`svg` + `use`),
 * y el peso del trazado se paga una vez. En una sección que ya es la más cara de la portada,
 * esos ~150 elementos ahorrados importan.
 */
const SPRITE = {
  foto: "sendero-i-foto",
  doc: "sendero-i-doc",
  prensa: "sendero-i-prensa",
} as const;

const Sprite = () => (
  <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
    <symbol id={SPRITE.foto} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" />
      <circle cx="10" cy="10.5" r="3" />
      <path d="M7 5l1-2h4l1 2" strokeLinecap="round" strokeLinejoin="round" />
    </symbol>
    <symbol id={SPRITE.doc} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 2.5h6l4 4v11H5z" strokeLinejoin="round" />
      <path d="M11 2.5v4h4" strokeLinejoin="round" />
    </symbol>
    <symbol id={SPRITE.prensa} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="4.5" width="12" height="12" rx="1.5" />
      <path d="M14.5 8h3v6.5a2 2 0 0 1-2 2h-1" strokeLinejoin="round" />
      <path d="M5.5 8h6M5.5 11h6M5.5 13.5h4" strokeLinecap="round" />
    </symbol>
  </svg>
);

/**
 * Etiqueta del eje (un mes, o «hoy»), centrada en el pasillo entre columnas.
 *
 * El recuadro de detrás no es decorativo: por ahí baja el camino, y el texto sin fondo se
 * leería tachado. Se dibuja con el color de la superficie de la sección, así que recorta el
 * trazo justo donde hace falta y en ningún sitio más. El ancho sale del número de caracteres
 * porque en SVG no hay forma de medir el texto sin pintarlo antes.
 */
const EtiquetaEje = ({ y, texto, color }: { y: number; texto: string; color: string }) => {
  const ancho = texto.length * 6.4 + 16;
  return (
    <>
      <rect
        x={(COL_IZQ + FICHA + COL_DER) / 2 - ancho / 2}
        y={y - 20}
        width={ancho}
        height={15}
        fill="var(--color-superficie)"
      />
      <text
        x={(COL_IZQ + FICHA + COL_DER) / 2}
        y={y - 9}
        textAnchor="middle"
        fill={color}
        className="font-[family-name:var(--ff-mono)] text-[10px] uppercase"
        style={{ letterSpacing: "0.12em" }}
      >
        {texto}
      </text>
    </>
  );
};

const Icono = ({ de }: { de: keyof typeof SPRITE }) => (
  <svg width="11" height="11" aria-hidden="true" focusable="false">
    <use href={`#${SPRITE[de]}`} />
  </svg>
);
