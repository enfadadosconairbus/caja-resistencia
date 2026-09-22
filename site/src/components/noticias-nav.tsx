"use client";
import * as React from "react";
import { Miniatura } from "@/components/miniatura";

export type Noticia = {
  titulo: string;
  medio: string;
  url: string;
  fecha: string | null;
  imagen?: string | null;
  sent?: string | null;
};

type PagStrings = { anterior: string; siguiente: string; pagina: string };

const PUNTO: Record<string, string> = {
  positivo: "var(--color-confianza-tinta)",
  neutro: "var(--color-tinta-suave)",
  negativo: "var(--color-acento-tinta)",
};

/**
 * Fecha y hora de la noticia, SIEMPRE en la hora peninsular.
 *
 * `timeZone` no es cosmético: este es un componente cliente, así que el servidor pinta la
 * hora en UTC y el navegador la repintaría en la zona del visitante. Cuando no coinciden,
 * el texto no casa y React rompe la hidratación (error #418 — medido en producción con
 * Lighthouse). Fijando la zona, servidor y cliente escriben lo mismo en todo el mundo.
 * Además es lo correcto editorialmente: el conflicto ocurre en España.
 */
function fechaCorta(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(d);
}

/**
 * Lista de noticias navegable por páginas — no scroll infinito.
 *
 * Solo se pinta la página actual (rendimiento y DOM ligero). Al cambiar de página el
 * foco va al primer titular, para que con teclado no te pierdas. Reduce-motion-safe:
 * sin animación de transición, solo cambia el contenido.
 */
export function NoticiasNav({
  items,
  porPagina = 6,
  conSentimiento = false,
  s,
  lang,
}: {
  items: Noticia[];
  porPagina?: number;
  conSentimiento?: boolean;
  s: PagStrings;
  lang: string;
}) {
  const [pagina, setPagina] = React.useState(0);
  const total = Math.ceil(items.length / porPagina);
  const listaRef = React.useRef<HTMLOListElement>(null);
  const interactuado = React.useRef(false);
  const inicio = pagina * porPagina;
  const visibles = items.slice(inicio, inicio + porPagina);

  // Tras cambiar de página (no en el montaje), lleva el foco al primer titular para
  // que con teclado no se pierda. El guard evita robar foco/scroll al cargar.
  React.useEffect(() => {
    if (!interactuado.current) return;
    listaRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [pagina]);

  const ir = (p: number) => {
    interactuado.current = true;
    setPagina(p);
  };

  return (
    // Columna flexible: si el contenedor le da más alto del que necesita —como en el
    // termómetro, donde comparte fila con una lista más larga—, el sobrante se lo queda el
    // hueco de antes del paginador y este acaba a ras del final de la columna vecina. Cuando
    // no sobra alto, `mt-auto` no hace nada y la lista se comporta como siempre.
    <div className="flex h-full flex-col">
      <ol ref={listaRef} className="divide-y divide-[var(--color-linea)] border-y border-[var(--color-linea)]" start={inicio + 1}>
        {visibles.map((t) => (
          <li key={t.url}>
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 py-3 transition-colors hover:bg-[var(--color-superficie)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)]"
            >
              <Miniatura src={t.imagen ?? null} medio={t.medio} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">
                  {t.titulo}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                  {conSentimiento ? (
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PUNTO[t.sent ?? "neutro"] ?? PUNTO.neutro }}
                    />
                  ) : null}
                  {t.medio}
                  {fechaCorta(t.fecha, lang) ? ` · ${fechaCorta(t.fecha, lang)}` : ""}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      {total > 1 ? (
        <div className="mt-auto flex items-center justify-between gap-4 pt-4">
          <button
            type="button"
            onClick={() => ir(Math.max(0, pagina - 1))}
            disabled={pagina === 0}
            className="rounded-full border border-[var(--color-linea)] px-4 py-2 text-xs font-semibold text-[var(--color-tinta)] transition-colors hover:border-[var(--color-tinta)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← {s.anterior}
          </button>
          <span aria-live="polite" className="font-[family-name:var(--ff-mono)] text-xs tabular-nums text-[var(--color-tinta-suave)]">
            {s.pagina.replace("{n}", String(pagina + 1)).replace("{t}", String(total))}
          </span>
          <button
            type="button"
            onClick={() => ir(Math.min(total - 1, pagina + 1))}
            disabled={pagina === total - 1}
            className="rounded-full border border-[var(--color-linea)] px-4 py-2 text-xs font-semibold text-[var(--color-tinta)] transition-colors hover:border-[var(--color-tinta)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.siguiente} →
          </button>
        </div>
      ) : null}
    </div>
  );
}
