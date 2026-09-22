"use client";

import { useState } from "react";
import Image from "next/image";

type PanelStrings = {
  titulo: string;
  periodo: string;
  alt: string;
};

type NegociacionStrings = {
  kicker: string;
  title: string[];
  fuentesLabel: string;
  descargar: string;
  paneles: Record<string, PanelStrings>;
};

type Imagen = {
  id: string;
  src: string;
  w: number;
  h: number;
  descarga: string;
};

export function NegociacionHero({
  imagenes,
  fuentes,
  s,
}: {
  imagenes: Imagen[];
  fuentes: string;
  s: NegociacionStrings;
}) {
  // Guarda la imagen ampliada (o null). Cada panel abre la suya; el lightbox es único.
  const [ampliada, setAmpliada] = useState<(Imagen & PanelStrings) | null>(null);

  // Las columnas se reparten según la proporción de cada imagen, de modo que cada foto
  // llena su columna de borde a borde (sin marcos ni franjas negras) y, aun teniendo
  // proporciones distintas, las dos acaban a la misma altura. Ver comentario abajo.
  const gridCols = imagenes.map((img) => `${(img.w / img.h).toFixed(4)}fr`).join(" ");

  return (
    <section
      id="negociacion"
      className="border-b border-[var(--color-linea)] bg-[var(--color-tinta-fija)] text-[var(--color-papel-fijo)]"
    >
      {/* Título */}
      <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
        <p className="kicker !text-[var(--color-acento-tinta)]">{s.kicker}</p>
        <h2 className="mt-4 font-[family-name:var(--ff-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
          {s.title.map((line, i) => (
            <span
              key={i}
              className="mask-rise block"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {line}
            </span>
          ))}
        </h2>
      </div>

      {/* Dos paneles: estado de la negociación + propuesta de acuerdo.
          En pantalla ancha, cada columna toma un `fr` igual a la proporción (ancho/alto) de
          su imagen. Como cada imagen llena su columna (`w-full h-auto`), la altura resultante
          es la misma para las dos —anchoColumna / proporción— y no hay franjas negras. */}
      <div className="mx-auto max-w-6xl px-5 pb-14 pt-10 md:pb-20">
        {/* En < lg es una sola columna (apiladas); en lg+ el media query aplica las columnas
            proporcionales derivadas de los datos, para que las dos fotos igualen su altura. */}
        <style>{`@media (min-width:1024px){#negociacion .neg-grid{grid-template-columns:${gridCols};}}`}</style>
        <div className="neg-grid grid gap-8 md:gap-10 lg:items-start">
          {imagenes.map((img, i) => {
            const p = s.paneles[img.id];
            if (!p) return null;
            return (
              <figure
                key={img.id}
                className="rise-in m-0 flex flex-col"
                style={{ animationDelay: `${0.25 + i * 0.1}s` }}
              >
                {/* Cabecera del panel */}
                <figcaption className="mb-4 lg:min-h-[3.5rem]">
                  <p className="font-[family-name:var(--ff-mono)] text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--color-papel-fijo)_55%,transparent)]">
                    {p.periodo}
                  </p>
                  <p className="mt-1 font-[family-name:var(--ff-display)] text-lg font-bold leading-snug md:text-xl">
                    {p.titulo}
                  </p>
                </figcaption>

                {/* Imagen a sangre: llena la columna, sin caja ni marco. Clic para ampliar. */}
                <button
                  type="button"
                  onClick={() => setAmpliada({ ...img, ...p })}
                  className="group block w-full cursor-zoom-in overflow-hidden rounded-lg"
                  aria-label={`${p.titulo} — ${s.descargar.toLowerCase()}`}
                >
                  <Image
                    src={img.src}
                    alt={p.alt}
                    width={img.w}
                    height={img.h}
                    sizes="(min-width: 1024px) 640px, 100vw"
                    className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    priority={i === 0}
                  />
                </button>

                {/* Descargar */}
                <div className="mt-4">
                  <a
                    href={img.src}
                    download={img.descarga}
                    aria-label={`${s.descargar}: ${p.titulo}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-[family-name:var(--ff-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--color-papel-fijo)] transition-colors hover:border-white/30 hover:bg-white/5"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {s.descargar}
                  </a>
                </div>
              </figure>
            );
          })}
        </div>

        {/* Fuentes */}
        <p className="rise-in mt-10 font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[color-mix(in_srgb,var(--color-papel-fijo)_50%,transparent)]" style={{ animationDelay: "0.5s" }}>
          <span className="font-semibold uppercase tracking-wider">{s.fuentesLabel}:</span>{" "}
          {fuentes}
        </p>
      </div>

      {/* Lightbox */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label={ampliada.titulo}
        >
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <Image
            src={ampliada.src}
            alt={ampliada.alt}
            width={ampliada.w}
            height={ampliada.h}
            className="max-h-[90vh] max-w-[95vw] cursor-zoom-out rounded-lg object-contain"
            onClick={() => setAmpliada(null)}
          />
        </div>
      )}
    </section>
  );
}
