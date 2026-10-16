"use client";

import { useState } from "react";

/**
 * Guía interactiva de la propuesta sometida a referéndum: los puntos de la propuesta,
 * agrupados por categoría, cada uno desplegable en cuatro bloques (qué plantea, qué falta
 * concretar, por qué importa y la clave). Tono informativo-reivindicativo suavizado: plantea
 * preguntas, no pide el voto. Filtro por categoría en cliente; el detalle usa <details>
 * nativo para que funcione con teclado y sin JS.
 *
 * NOTA DE AUTORÍA: contenido reescrito con voz propia del movimiento a partir de la
 * documentación pública de la propuesta. No reproduce el texto de la guía de un tercero.
 */
export type PuntoGuia = {
  id: string;
  categoria: string;
  titulo: string;
  pregunta: string;
  propuesta: string;
  falta: string;
  importa: string;
  clave: string;
};

export type GuiaStrings = {
  todos: string;
  categorias: Record<string, string>;
  mostrando: string;
  puntosLabel: string;
  bloques: { propuesta: string; falta: string; importa: string; clave: string };
};

// Orden fijo de las categorías en la botonera de filtros.
const ORDEN_CATEGORIAS = ["garantias", "salario", "puestos", "tiempo", "continuidad", "servicios"];

export function GuiaReferendum({ puntos, s }: { puntos: PuntoGuia[]; s: GuiaStrings }) {
  const [cat, setCat] = useState<string>("todos");
  const visibles = cat === "todos" ? puntos : puntos.filter((p) => p.categoria === cat);

  const chips = ["todos", ...ORDEN_CATEGORIAS.filter((c) => puntos.some((p) => p.categoria === c))];

  return (
    <div>
      {/* Filtros por categoría */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const on = cat === c;
          const label = c === "todos" ? s.todos : s.categorias[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={on}
              className={`rounded-full border px-4 py-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider transition-colors ${
                on
                  ? "border-[var(--color-acento)] bg-[var(--color-acento)] text-white"
                  : "border-[var(--color-linea)] text-[var(--color-tinta-suave)] hover:border-[var(--color-tinta)] hover:text-[var(--color-tinta)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 font-[family-name:var(--ff-mono)] text-[11px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {s.mostrando} {visibles.length} / {puntos.length} {s.puntosLabel}
      </p>

      {/* Lista de puntos */}
      <div className="mt-6 grid gap-4">
        {visibles.map((p) => (
          <details
            key={p.id}
            className="group overflow-hidden rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)]"
          >
            <summary className="flex cursor-pointer list-none items-start gap-4 p-5 marker:content-none [&::-webkit-details-marker]:hidden md:p-6">
              <span className="mt-0.5 font-[family-name:var(--ff-mono)] text-sm font-semibold tabular-nums text-[var(--color-acento-tinta)]">
                {p.id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                  {s.categorias[p.categoria] ?? p.categoria}
                </span>
                <span className="mt-1 block font-[family-name:var(--ff-display)] text-lg font-bold leading-snug text-[var(--color-tinta)]">
                  {p.titulo}
                </span>
                <span className="mt-1 block text-sm text-[var(--color-tinta-suave)]">{p.pregunta}</span>
              </span>
              <span
                aria-hidden="true"
                className="mt-1 shrink-0 text-[var(--color-acento-tinta)] transition-transform duration-200 group-open:rotate-45"
              >
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </span>
            </summary>

            <div className="border-t border-[var(--color-linea)] px-5 pb-6 pt-5 md:px-6 md:pl-16">
              {/* Cuatro cuadrantes con color semántico (paleta same-sky):
                  propuesta = cielo · falta = ámbar · importa = coral · clave = verde. */}
              <dl className="grid gap-4 sm:grid-cols-2">
                <Bloque etiqueta={s.bloques.propuesta} texto={p.propuesta} color="#4EA3FF" />
                <Bloque etiqueta={s.bloques.falta} texto={p.falta} color="#FFC24D" />
                <Bloque etiqueta={s.bloques.importa} texto={p.importa} color="#FF4D5E" />
                <Bloque etiqueta={s.bloques.clave} texto={p.clave} color="#3DDC97" />
              </dl>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Bloque({ etiqueta, texto, color }: { etiqueta: string; texto: string; color: string }) {
  return (
    // Barra de acento a la izquierda + fondo tenue del mismo tono: distingue el cuadrante
    // sin comprometer la lectura del texto (que se mantiene en blanco).
    <div
      className="rounded-lg border-l-2 py-3 pl-4 pr-3"
      style={{ borderColor: color, backgroundColor: `${color}12` }}
    >
      <dt
        className="font-[family-name:var(--ff-mono)] text-[10px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {etiqueta}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-[var(--color-tinta)]">{texto}</dd>
    </div>
  );
}

/**
 * Acciones al pie: compartir (Web Share con copia de enlace de reserva) e imprimir/guardar
 * PDF. Cliente porque tocan `navigator` y `window.print`.
 */
export function AccionesGuia({ compartir, copiado, imprimir }: { compartir: string; copiado: string; imprimir: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  async function onCompartir() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg(copiado);
      setTimeout(() => setMsg(null), 2500);
    } catch {
      /* cancelado por el usuario o sin permiso: no hacemos nada */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onCompartir}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-acento)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {msg ?? compartir}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-tinta)] px-6 py-3 text-sm font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
        </svg>
        {imprimir}
      </button>
    </div>
  );
}
