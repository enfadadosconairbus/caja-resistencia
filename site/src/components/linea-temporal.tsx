"use client";
import * as React from "react";
import Image from "next/image";
import { fechaES } from "@/lib/formato";
import { PrensaHito } from "@/components/prensa-hito";

/**
 * Cronología del conflicto — raíl vertical para pantalla estrecha.
 *
 * Es la versión estrecha del sendero (`sendero-cronologia.tsx`): el mismo relato, pero con
 * el camino recto. Serpentear necesita dos carriles separados, y por debajo de `xl` eso no
 * es un recorrido, es una lista torcida.
 *
 * El raíl es el eje: baja por la izquierda, con su tramo recorrido en color y el que queda
 * punteado, y de cada nodo sale un brazo horizontal hasta la ficha. Igual que en el sendero,
 * la conexión entre el hito y su documentación se ve dibujada, no se supone.
 *
 * La ficha del hito crece al pasar por encima y se encoge al salir. En táctil no hay hover,
 * así que se abre al tocar y se cierra al tocar fuera o pulsar Escape; y como los hitos son
 * botones, funciona igual con el teclado. Sin JavaScript la lista se ve entera, con sus
 * fechas y sus descargas: la interacción mejora la lectura, no la sustituye.
 */

/** Texto por idioma. El español es obligatorio: es la lengua en la que se redactan. */
export type Texto = { es: string } & Partial<Record<string, string>>;

/**
 * Un medio que publicó el hito. Los dos casos conviven a propósito:
 *
 * - `string` — solo el nombre del medio. Es lo que había, y sigue siendo lo correcto cuando
 *   sabemos que un medio lo publicó pero no tenemos el artículo localizado.
 * - objeto — el nombre **y el artículo**, enlazado. La URL nunca se escribe a mano: la pone
 *   `scripts/prensa-cronologia.mjs` resolviéndola contra el snapshot del termómetro, que es
 *   captura real de un panel de terceros. Un enlace inventado en una cronología documental es
 *   peor que no tener enlace.
 *
 * No se rellena el hueco: un medio sin artículo se queda como nombre suelto y se ve que no
 * lleva enlace. Antes que enlazar «algo parecido», nada.
 */
export type Prensa = string | { medio: string; titulo: string; url: string; fecha?: string };

/** El nombre del medio, venga como cadena suelta o dentro del artículo enlazado. */
export const medioDe = (p: Prensa) => (typeof p === "string" ? p : p.medio);

export type Hito = {
  fecha: string;
  tipo: string;
  titulo: Texto;
  texto: Texto;
  docs?: { titulo: Texto; pdf: string }[];
  prensa?: Prensa[];
  /**
   * Foto de apoyo. Solo en los hitos que la merecen —las marchas y las asambleas—, y con el
   * criterio de encuadre de `scripts/bajar-fotos.py`: son trabajadores identificables en un
   * conflicto abierto y ninguno ha autorizado saltar de un grupo privado a una web pública.
   *
   * `pie` es el pie de foto, y no es decorativo ni intercambiable con `alt`. El `alt`
   * describe lo que se ve, para quien no puede verlo; el `pie` dice **qué representa la
   * foto**, que aquí no siempre coincide con el día en que se hizo: las asambleas se
   * celebran a diario y una sola foto vale por todas. Sin ese pie, colgar una foto del 15 de
   * julio de un hito del 15 de julio insinúa que la asamblea fue *ese* día y no antes.
   *
   * `w`/`h` son las medidas REALES del WebP publicado, y las escribe
   * `scripts/fotos-cronologia.mjs` al convertir. No son opcionales ni un valor de plantilla:
   * estas fotos van de 20:9 a vertical 3:4, así que declarar una proporción fija a ojo
   * reservaría un hueco que no es el de la foto y la ficha daría un salto al cargarla.
   */
  imagen?: { src: string; w: number; h: number; alt: Texto; pie?: Texto };
  /** Lo publicó sola la tarea diaria: es factual, sin la lectura del movimiento. */
  auto?: boolean;
};

/**
 * Elige el idioma del visitante y cae al español si falta.
 *
 * La vuelta al español no es un descuido: los hitos los redacta el movimiento en español y
 * se traducen después, así que un hito recién añadido debe verse —en español— antes que
 * desaparecer de las otras tres versiones de la web.
 */
const t = (x: Texto, lang: string) => x[lang] ?? x.es;

export type LineaTemporalStrings = {
  hoy: string;
  futuro: string;
  documentos: string;
  prensa: string;
  cerrar: string;
  instruccion: string;
};

/** Color por tipo de hito. El rojo se reserva para lo que marca un antes y un después. */
const COLOR: Record<string, string> = {
  huelga: "var(--color-acento-tinta)",
  ruptura: "var(--color-acento-tinta)",
  movilizacion: "var(--color-acento-tinta)",
  votacion: "var(--color-confianza-tinta)",
  negociacion: "var(--color-confianza-tinta)",
  documento: "var(--color-tinta-suave)",
  futuro: "var(--color-tinta-suave)",
};

export function LineaTemporal({
  hitos,
  hoyISO,
  lang,
  s,
}: {
  hitos: Hito[];
  /** «Hoy» lo calcula el servidor: si lo hiciera el cliente, no casaría al hidratar. */
  hoyISO: string;
  lang: string;
  s: LineaTemporalStrings;
}) {
  const [abierto, setAbierto] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const hoy = Date.parse(hoyISO);

  // Cerrar al tocar fuera o con Escape: en táctil no hay «salir del hito».
  React.useEffect(() => {
    if (abierto == null) return;
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(null);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const ultimo = hitos.length - 1;

  return (
    <div ref={ref} className="mt-10">
      <p className="mb-6 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {s.instruccion}
      </p>

      {/* ── Raíl ──
          El eje ya no es una barra aparte: es la propia columna de la que cuelgan las fichas.
          Cada hito pinta su tramo de raíl (sólido si ya pasó, punteado si no) y su brazo. */}
      <ol className="relative">
        {hitos.map((h, i) => {
          const futuro = Date.parse(h.fecha) > hoy;
          const activo = abierto === i;
          const color = COLOR[h.tipo] ?? "var(--color-tinta-suave)";
          const primerFuturo = futuro && !hitosPasados(hitos, hoy, i);
          return (
            <li
              key={`${h.fecha}-${i}`}
              className="relative pb-3 pl-10"
              onPointerEnter={(e) => e.pointerType === "mouse" && setAbierto(i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setAbierto((v) => (v === i ? null : v))}
            >
              {/* Tramo de raíl de esta fila. El último se corta en su nodo: el recorrido
                  termina en el hito, no en el aire. */}
              <span
                aria-hidden="true"
                className={`absolute left-[7px] top-0 w-0 border-l ${
                  futuro ? "border-dashed border-[var(--color-tinta-suave)]" : "border-[var(--color-acento-tinta)]"
                }`}
                style={{ height: i === ultimo ? 22 : "100%", opacity: futuro ? 0.5 : 1 }}
              />
              {/* Brazo del raíl a la ficha */}
              <span
                aria-hidden="true"
                className="absolute top-[22px] h-px"
                // De 8 (el borde del nodo) a 40 (`pl-10`, donde empieza la ficha): el brazo
                // tiene que *tocar* la ficha, o no une nada.
                style={{
                  left: 8,
                  width: 32,
                  background: activo ? "var(--color-tinta)" : "var(--color-linea)",
                }}
              />
              {/* Nodo */}
              <span
                aria-hidden="true"
                className="absolute left-[2px] top-[17px] block h-[11px] w-[11px] rounded-full"
                style={{
                  background: futuro ? "var(--color-fondo)" : color,
                  boxShadow: `0 0 0 2px ${futuro ? color : "var(--color-fondo)"}`,
                }}
              />
              {/* Marca de HOY: cae justo antes del primer hito que aún no ha pasado. */}
              {primerFuturo ? (
                <span className="absolute -top-1 left-10 font-[family-name:var(--ff-mono)] text-[9px] uppercase tracking-wider text-[var(--color-tinta)]">
                  {s.hoy}
                </span>
              ) : null}

              {/* Igual que en el sendero: botón es solo la cabecera, no la ficha entera. Dentro
                  del panel abierto hay enlaces (documentos y artículos de prensa), y anidarlos
                  en un `<button>` es HTML inválido: dejarían de existir para quien no usa
                  ratón. Ver `sendero-cronologia.tsx`. */}
              <div
                className={`rounded-lg border bg-[var(--color-fondo)] p-4 transition-[border-color,box-shadow] ${
                  activo
                    ? "border-[var(--color-tinta)] shadow-[0_6px_20px_var(--sombra-sutil)]"
                    : "border-[var(--color-linea)] hover:border-[var(--color-tinta-suave)]"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={activo}
                  onClick={() => setAbierto((v) => (v === i ? null : i))}
                  onFocus={() => setAbierto(i)}
                  className="block w-full text-left"
                >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: futuro ? "transparent" : color, boxShadow: futuro ? `inset 0 0 0 2px ${color}` : undefined }}
                  />
                  <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                    {fechaES(h.fecha, lang, { day: "numeric", month: "short" })}
                    {futuro ? ` · ${s.futuro}` : ""}
                  </span>
                </span>
                <span className="mt-2 block font-[family-name:var(--ff-display)] text-base font-bold leading-tight text-[var(--color-tinta)]">
                  {t(h.titulo, lang)}
                </span>

                {/* El cuerpo está SIEMPRE en el HTML; al abrir solo deja de estar recortado,
                    para que sin JavaScript o con un buscador se lea igual. */}
                <span
                  className={`mt-2 block text-sm leading-relaxed text-[var(--color-tinta-suave)] ${
                    activo ? "" : "line-clamp-2"
                  }`}
                >
                  {t(h.texto, lang)}
                </span>
                </button>

                {activo ? (
                  <div className="mt-4 border-l border-[var(--color-linea)] pl-4">
                    {h.imagen ? (
                      <figure className="mb-4">
                        <Image
                          src={h.imagen.src}
                          alt={t(h.imagen.alt, lang)}
                          width={h.imagen.w}
                          height={h.imagen.h}
                          sizes="(min-width: 640px) 560px, 100vw"
                          className="block h-auto w-full rounded border border-[var(--color-linea)]"
                        />
                        {h.imagen.pie ? (
                          <figcaption className="mt-2 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">
                            {t(h.imagen.pie, lang)}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    {h.docs?.length ? (
                      <div>
                        <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                          {s.documentos}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {h.docs.map((d) => (
                            <a
                              key={d.pdf}
                              href={d.pdf}
                              download
                              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-tinta)] px-4 py-2 text-xs font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
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
  );
}

/** ¿Hay algún hito anterior a `i` que tampoco haya pasado? Sirve para poner la marca de HOY
 *  una sola vez, en la frontera entre lo ocurrido y lo convocado. */
function hitosPasados(hitos: Hito[], hoy: number, i: number) {
  return hitos.slice(0, i).some((h) => Date.parse(h.fecha) > hoy);
}
