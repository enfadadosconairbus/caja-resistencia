import * as React from "react";
import type { Prensa } from "@/components/linea-temporal";

/**
 * Los medios que publicaron un hito, con enlace al artículo cuando lo tenemos.
 *
 * Se comparte entre el sendero y el raíl para que la regla sea una sola: **el medio sin
 * artículo localizado se queda como nombre suelto**, sin subrayado y sin enlace. Que se note
 * a simple vista cuáles llevan artículo detrás y cuáles no; rellenar el hueco con «algo
 * parecido» convertiría una cita en una insinuación.
 *
 * El texto visible es el nombre del medio —en una ficha de 384 px no cabe el titular— y el
 * titular va en `aria-label`, precedido del medio para que la etiqueta accesible contenga el
 * texto visible y quien navega por voz pueda decir «pincha Expansión».
 */
export function PrensaHito({
  prensa,
  etiqueta,
  className = "",
}: {
  prensa: Prensa[];
  /** «Publicado por» — viene del diccionario. */
  etiqueta: string;
  className?: string;
}) {
  if (!prensa.length) return null;

  return (
    <p className={`font-[family-name:var(--ff-mono)] leading-relaxed text-[var(--color-tinta-suave)] ${className}`}>
      {etiqueta}:{" "}
      {prensa.map((p, i) => (
        <React.Fragment key={typeof p === "string" ? `${p}-${i}` : p.url}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          {typeof p === "string" ? (
            <span>{p}</span>
          ) : (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.medio}: ${p.titulo}`}
              title={p.titulo}
              className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-confianza-tinta)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
            >
              {p.medio}
              <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 3h6v6M11 3 3 11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </React.Fragment>
      ))}
    </p>
  );
}
