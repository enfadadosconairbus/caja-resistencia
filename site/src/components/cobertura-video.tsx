"use client";
import * as React from "react";

export type Corte = {
  id: string;
  medio: string;
  titulo: string;
  /** ISO YYYY-MM-DD. */
  fecha: string;
  duracion: string;
  idioma?: string;
  /** Presente → se embebe con facade youtube-nocookie. */
  youtubeId?: string;
  /** Ruta local de la carátula (solo para los de YouTube). */
  miniatura?: string;
  /** Vertical (Short): la caja del reproductor va en 9:16. */
  short?: boolean;
  /** Presente y sin youtubeId → tarjeta con enlace a la fuente (no embebible). */
  url?: string;
};

export type CoberturaStrings = {
  /** Prefijo accesible del botón de play: "Reproducir vídeo: {titulo}". */
  reproducir: string;
  /** Etiqueta del enlace externo cuando el vídeo no es embebible. */
  verEnWeb: string;
  /** Rótulo de los verticales. */
  short: string;
  /** Nota al pie: de dónde salen los vídeos. */
  fuente: string;
};

/** Fecha corta en el idioma de la página. Mediodía UTC para que el día no baile por huso. */
function fechaCorta(iso: string, lang: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/**
 * Una tarjeta de vídeo.
 *
 * Facade: mientras no se pulsa, es una imagen estática auto-alojada y CERO contacto con
 * Google — coherente con el resto del sitio, que no llama a terceros sin que el usuario lo
 * pida. Al pulsar, y solo entonces, se monta el iframe de `youtube-nocookie` con autoplay.
 * Los cortes sin `youtubeId` (p. ej. reproductor propio de la cadena) no se pueden embeber:
 * van como tarjeta con enlace a su origen.
 */
function TarjetaVideo({ c, lang, s }: { c: Corte; lang: string; s: CoberturaStrings }) {
  const [playing, setPlaying] = React.useState(false);

  const pie = (
    <div className="mt-3">
      <p className="flex flex-wrap items-center gap-x-2 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        <span className="font-semibold text-[var(--color-acento-tinta)]">{c.medio}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={c.fecha}>{fechaCorta(c.fecha, lang)}</time>
      </p>
      <p
        lang={c.idioma}
        className="mt-1 text-sm font-medium leading-snug text-[var(--color-tinta)]"
      >
        {c.titulo}
      </p>
    </div>
  );

  // Sin youtubeId: la fuente no permite embeber → enlace a su web.
  if (!c.youtubeId) {
    return (
      <article>
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${c.medio}: ${c.titulo} — ${s.verEnWeb}`}
          className="group relative block aspect-video overflow-hidden rounded-xl border border-[var(--color-linea)] bg-[var(--color-tinta-fija)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--color-acento)_35%,black)] to-black" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-[var(--color-papel-fijo)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-papel-fijo)]/15 ring-1 ring-[var(--color-papel-fijo)]/40 transition-transform group-hover:scale-110">
              <PlayIcon className="ml-0.5 h-6 w-6" />
            </span>
            <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider opacity-90">
              {s.verEnWeb}
            </span>
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] font-semibold tabular-nums text-white">
            {c.duracion}
          </span>
        </a>
        {pie}
      </article>
    );
  }

  return (
    <article>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--color-linea)] bg-[var(--color-tinta-fija)]">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${c.youtubeId}?autoplay=1&rel=0`}
            title={c.titulo}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${s.reproducir}: ${c.titulo} (${c.medio})`}
            className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.miniatura}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/25" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-acento)]/90 shadow-lg ring-1 ring-white/30 transition-transform group-hover:scale-110">
              <PlayIcon className="ml-1 h-7 w-7 text-white" />
            </span>
            {c.short ? (
              <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] font-semibold uppercase tracking-wider text-white">
                {s.short}
              </span>
            ) : null}
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] font-semibold tabular-nums text-white">
              {c.duracion}
            </span>
          </button>
        )}
      </div>
      {pie}
    </article>
  );
}

/**
 * Rejilla de cortes de informativos.
 *
 * Todas las cajas van en 16:9 aunque el corte sea vertical (Short): una caja 9:16 en una
 * columna de tres rompería la cuadrícula. El vertical se reproduce apaisado dentro de su
 * caja —YouTube lo sirve con bandas laterales— y el rótulo «Short» avisa del formato.
 */
export function CoberturaVideo({
  cortes,
  lang,
  s,
  columnas = 3,
}: {
  cortes: Corte[];
  lang: string;
  s: CoberturaStrings;
  columnas?: 2 | 3;
}) {
  if (!cortes.length) return null;
  const cols = columnas === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`mt-10 grid gap-6 ${cols}`}>
      {cortes.map((c) => (
        <TarjetaVideo key={c.id} c={c} lang={lang} s={s} />
      ))}
    </div>
  );
}
