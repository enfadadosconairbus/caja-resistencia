"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Ilustración de la sección ÚLTIMAS NOTICIAS con clic-para-ampliar (lightbox) y descarga,
 * al modo de NegociacionHero/VotacionHero. Vive en la banda oscura (papel-fijo sobre
 * tinta-fija), así que los controles usan blancos translúcidos como el resto de la banda.
 */
type Props = {
  src: string;
  alt: string;
  descarga: string;
  ampliarLabel: string;
  descargarLabel: string;
  cerrarLabel: string;
};

export function UltimaHoraImagen({
  src,
  alt,
  descarga,
  ampliarLabel,
  descargarLabel,
  cerrarLabel,
}: Props) {
  const [ampliada, setAmpliada] = useState(false);

  return (
    <figure className="rise-in m-0 mt-10" style={{ animationDelay: "0.3s" }}>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        className="group block w-full cursor-zoom-in overflow-hidden rounded-xl border border-white/12"
        aria-label={ampliarLabel}
      >
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={900}
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="block h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
          priority
        />
      </button>

      <div className="mt-4">
        <a
          href={src}
          download={descarga}
          aria-label={descargarLabel}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-[family-name:var(--ff-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--color-papel-fijo)] transition-colors hover:border-white/30 hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {descargarLabel}
        </a>
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setAmpliada(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={() => setAmpliada(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label={cerrarLabel}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={900}
            className="max-h-[90vh] max-w-[95vw] cursor-zoom-out rounded-lg object-contain"
            onClick={() => setAmpliada(false)}
          />
        </div>
      )}
    </figure>
  );
}
