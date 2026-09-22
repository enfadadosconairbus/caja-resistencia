import { Plegable } from "@/components/plegable";
import type { CategoriaPublicada, DocumentoPublicado } from "@/lib/documentos-source";

/**
 * Índice de documentos del movimiento, por categorías.
 *
 * Lo cataloga a diario el Grupo Documentación en Telegram y se replica aquí SIN los
 * metadatos personales del original (quién subió cada documento, sus reacciones y la
 * puntuación de utilidad): son personas identificables dentro de un conflicto laboral.
 *
 * Dos clases de fila, y la diferencia es honesta:
 *   · con PDF publicado → descarga directa desde esta web
 *   · sin él → enlace al mensaje del grupo, que solo abre si eres miembro (se avisa)
 */

export type DocumentosLabels = {
  indiceHeading: string;
  indiceNota: string;
  descargar: string;
  descargables: string;
  verEnGrupo: string;
  soloGrupo: string;
  versiones: string;
};

function fechaCorta(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function Fila({ d, lang, l }: { d: DocumentoPublicado; lang: string; l: DocumentosLabels }) {
  const meta = [fechaCorta(d.fecha, lang), d.pdf ? d.meta : d.formato]
    .filter(Boolean)
    .join(" · ");

  const cuerpo = (
    <>
      <span className="block text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">
        {d.titulo}
      </span>
      {d.resumen ? (
        <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[var(--color-tinta-suave)]">
          {d.resumen}
        </span>
      ) : null}
      <span className="mt-1 block font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {meta}
        {d.versiones > 0 ? ` · ${l.versiones.replace("{n}", String(d.versiones))}` : ""}
      </span>
    </>
  );

  if (d.pdf) {
    return (
      <a
        href={d.pdf}
        download
        className="group flex items-start gap-3 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-4 py-3 transition-colors hover:border-[var(--color-tinta)] hover:bg-[var(--color-superficie)]"
      >
        <span className="min-w-0 flex-1">{cuerpo}</span>
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-acento-tinta)]"
          title={l.descargar}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 3v10m0 0 4-4m-4 4-4-4M3 16h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="sr-only">{l.descargar}</span>
      </a>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-[var(--color-linea)] px-4 py-3">
      <span className="min-w-0 flex-1">
        {cuerpo}
        {d.grupoUrl ? (
          <a
            href={d.grupoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)] underline underline-offset-2 hover:text-[var(--color-acento-tinta)]"
          >
            {l.verEnGrupo}
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 3h6v6M11 3 3 11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : null}
      </span>
    </div>
  );
}

export function DocumentosLista({
  categorias,
  labels,
  lang,
}: {
  categorias: CategoriaPublicada[];
  labels: DocumentosLabels;
  lang: string;
}) {
  return (
    <div className="space-y-1">
      {categorias.map((c) => (
        <Plegable
          key={c.slug}
          titulo={c.nombre}
          n={c.documentos.length}
          nivel="h4"
          // Lo normal es que se descarguen todos; solo se avisa cuando NO es así.
          nota={
            c.descargables === c.documentos.length
              ? undefined
              : c.descargables
                ? labels.descargables.replace("{n}", String(c.descargables))
                : labels.soloGrupo
          }
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
            {c.documentos.map((d, i) => (
              <Fila key={`${c.slug}-${d.msgId ?? i}`} d={d} lang={lang} l={labels} />
            ))}
          </div>
        </Plegable>
      ))}
    </div>
  );
}
