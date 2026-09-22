"use client";

import { useState } from "react";
import Image from "next/image";

type UltimasNoticiasStrings = {
  kicker: string;
};

export function VotacionHero({ s }: { s: UltimasNoticiasStrings }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      id="ultimas-noticias"
      className="border-b border-[var(--color-linea)] bg-[var(--color-tinta-fija)] text-[var(--color-papel-fijo)]"
    >
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-4 md:pt-20">
        <p className="kicker !text-[var(--color-acento-tinta)]">{s.kicker}</p>
      </div>

      {/* Infografía a ancho completo */}
      <div className="rise-in">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group block w-full cursor-zoom-in"
        >
          <Image
            src="/img/infografia-votacion.webp"
            alt="Resultados de la votación del 31 de agosto de 2026 — 81,2 % no pausar la huelga, 16,4 % pausar, 2,4 % abstención"
            width={1600}
            height={900}
            className="w-full transition-transform duration-300 group-hover:scale-[1.01]"
            priority
          />
        </button>
      </div>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Resultados de la votación ampliados"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <Image
            src="/img/infografia-votacion.webp"
            alt="Resultados de la votación del 31 de agosto de 2026 — 81,2 % no pausar la huelga, 16,4 % pausar, 2,4 % abstención"
            width={1600}
            height={900}
            className="max-h-[90vh] max-w-[95vw] cursor-zoom-out rounded-lg object-contain"
            onClick={() => setExpanded(false)}
          />
        </div>
      )}
    </section>
  );
}
