import * as React from "react";
import { SITES, type Acta } from "@/lib/actas-source";
import { Rise } from "@/components/motion";
import { Plegable } from "@/components/plegable";

export type ActasLabels = {
  grupoHeading: string;
  grupoNota: string;
  sitesHeading: string;
  grupoLabel: string;
};

function fechaLarga(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Fecha corta para la fila-miniatura: "17 jul 2026". */
function fechaCorta(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/**
 * Reproduce el formato del post de Telegram sin `dangerouslySetInnerHTML`: todo el texto
 * va en nodos de React (auto-escapados), y solo se envuelven negritas/cursivas en
 * <strong>/<em>. Seguro por construcción frente a texto de terceros.
 */
function inline(s: string, kb: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Además de negritas/cursivas, se admiten enlaces markdown [texto](https://…) para
  // poder citar fuentes de prensa dentro del cuerpo de un acta (auditoría 2026-08).
  const re = /(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+?\*|__[^_\n]+__|_[^_\n]+?_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(tok);
    if (link) {
      out.push(
        <a
          key={kb + i}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-[var(--color-confianza-tinta)] hover:text-[var(--color-acento-tinta)]"
        >
          {link[1]}
        </a>,
      );
    } else {
      const inner = tok.replace(/^[*_]+|[*_]+$/g, "");
      out.push(
        tok.startsWith("*") ? <strong key={kb + i}>{inner}</strong> : <em key={kb + i}>{inner}</em>,
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function renderCuerpo(texto: string): React.ReactNode {
  return texto.split(/\r?\n/).map((line, i) => {
    const b = line.match(/^\s*[*•]\s+(.*)$/);
    if (b) {
      return (
        <div key={i} className="flex gap-2">
          <span aria-hidden="true" className="mt-px shrink-0 text-[var(--color-acento-tinta)]">
            •
          </span>
          <span>{inline(b[1], `${i}-`)}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" aria-hidden="true" />;
    return <p key={i}>{inline(line, `${i}-`)}</p>;
  });
}

/** Primera línea limpia (sin viñeta/asteriscos) para el adelanto de la tarjeta cerrada. */
const adelanto = (cuerpo: string) =>
  (cuerpo.split(/\r?\n/).find((l) => l.trim()) ?? "").replace(/^[\s*•_]+/, "").replace(/[*_]/g, "");

function pillClase(tipo: Acta["tipo"]): string {
  if (tipo === "otros") return "bg-[var(--color-superficie)] text-[var(--color-tinta-suave)]";
  if (tipo === "acta" || !tipo)
    return "bg-[color-mix(in_srgb,var(--color-acento)_12%,transparent)] text-[var(--color-acento-tinta-fuerte)]";
  // grupo · comunicado · soporte
  return "bg-[color-mix(in_srgb,var(--color-confianza)_12%,transparent)] text-[var(--color-confianza-tinta)]";
}

function badgeTexto(a: Acta, l: ActasLabels): string {
  return a.tipo === "grupo" ? l.grupoLabel : (a.site ?? "");
}

/** Título y cuerpo en el idioma de la página, con caída al español si no hay traducción. */
function textoActa(a: Acta, lang: string): { titulo: string; cuerpo: string } {
  const tr = lang !== "es" ? a.i18n?.[lang as "en" | "fr" | "de"] : undefined;
  return { titulo: tr?.titulo ?? a.titulo, cuerpo: tr?.cuerpo ?? a.cuerpo };
}

const BANNER_AUDITORIA: Record<string, string> = {
  es: "Auditoría jurídico-editorial en curso. Las descargas están temporalmente deshabilitadas y se habilitarán de nuevo en las próximas horas.",
  en: "Legal and editorial audit in progress. Downloads are temporarily disabled and will be re-enabled within the next few hours.",
  fr: "Audit juridique et éditorial en cours. Les téléchargements sont temporairement désactivés et seront réactivés dans les prochaines heures.",
  de: "Rechtliche und redaktionelle Prüfung läuft. Downloads sind vorübergehend deaktiviert und werden in den nächsten Stunden wieder aktiviert.",
};

/** Una tarjeta: descarga (si trae `pdf`) o miniatura desplegable (`<details>` nativo). */
function Tarjeta({ a, lang, labels }: { a: Acta; lang: string; labels: ActasLabels }) {
  const badge = badgeTexto(a, labels);
  const { titulo, cuerpo } = textoActa(a, lang);
  const pill = (
    <span
      className={`shrink-0 rounded px-2 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider ${pillClase(a.tipo)}`}
    >
      {badge}
    </span>
  );

  if (a.pdf) {
    return (
      <a
        href={a.pdf}
        download
        className="group flex items-center gap-3 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-4 py-3 transition-colors hover:border-[var(--color-tinta)] hover:bg-[var(--color-superficie)]"
      >
        {pill}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">
          {titulo}
        </span>
        {fechaCorta(a.fecha, lang) ? (
          <span className="hidden shrink-0 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)] sm:inline">
            {fechaCorta(a.fecha, lang)}
          </span>
        ) : null}
        {a.meta ? (
          <span className="hidden shrink-0 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)] md:inline">
            {a.meta}
          </span>
        ) : null}
        <span aria-hidden="true" className="shrink-0 text-[var(--color-acento-tinta)]">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 3v10m0 0 4-4m-4 4-4-4M3 16h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </a>
    );
  }

  return (
    <details className="group rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] transition-colors open:col-span-full open:bg-[var(--color-superficie)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)] [&::-webkit-details-marker]:hidden">
        {pill}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--color-tinta)]">{titulo}</span>
          <span className="block truncate text-xs text-[var(--color-tinta-suave)] group-open:hidden">{adelanto(cuerpo)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider">
          {fechaCorta(a.fecha, lang) ? (
            <span className="hidden text-[var(--color-tinta-suave)] sm:inline">{fechaCorta(a.fecha, lang)}</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-[var(--color-acento-tinta)] transition-transform duration-200 group-open:rotate-45">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="space-y-1 border-t border-[var(--color-linea)] px-4 pb-5 pt-4 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
        <p className="mb-3 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {[badge, fechaLarga(a.fecha, lang)].filter(Boolean).join(" · ")}
        </p>
        {renderCuerpo(cuerpo)}
      </div>
    </details>
  );
}

/** Rejilla de tarjetas a 2 columnas (una tarjeta abierta ocupa el ancho completo). */
function Rejilla({ items, lang, labels, kb }: { items: Acta[]; lang: string; labels: ActasLabels; kb: string }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
      {items.map((a, i) => (
        <Tarjeta key={`${kb}-${a.titulo}-${i}`} a={a} lang={lang} labels={labels} />
      ))}
    </div>
  );
}

/**
 * Actas y resúmenes, en dos bloques plegables:
 *   1) Actas por centro (a su vez, un plegable por sede) · 2) Resúmenes diarios del grupo.
 *
 * Los comunicados y la "otra documentación" ya no viven aquí: los cubre el índice de
 * documentos del grupo (ver documentos-lista.tsx), que es la fuente que se mantiene sola.
 *
 * Todo se renderiza en servidor; el acordeón usa `<details>` nativo (teclado sin JS).
 */
export function ActasLista({ actas, labels, lang, auditoria }: { actas: Acta[]; labels: ActasLabels; lang: string; auditoria?: boolean }) {
  const grupo = actas.filter((a) => a.tipo === "grupo");
  // Durante la auditoría se retiran de la web los ficheros descargables (PDF);
  // los resúmenes en texto plano (sin PDF) se mantienen tal cual.
  const porCentro = SITES.map((s) => ({
    site: s,
    items: actas.filter((a) => a.tipo === "acta" && a.site === s && (!auditoria || !a.pdf)),
  })).filter((g) => g.items.length > 0);
  const nActas = porCentro.reduce((n, g) => n + g.items.length, 0);

  return (
    <Rise>
      <div>
        {nActas > 0 && (
          <Plegable titulo={labels.sitesHeading} n={nActas}>
            {auditoria ? (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--color-acento)] bg-[color-mix(in_srgb,var(--color-acento)_8%,transparent)] px-4 py-3">
                <svg aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-acento-tinta)]" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 7v4M10 13h.01" strokeLinecap="round" />
                </svg>
                <p className="text-sm leading-relaxed text-[var(--color-tinta)]">
                  {BANNER_AUDITORIA[lang] ?? BANNER_AUDITORIA.es}
                </p>
              </div>
            ) : null}
            <div className="space-y-1">
              {porCentro.map((g) => (
                <Plegable key={g.site} titulo={g.site} n={g.items.length} nivel="h4">
                  <Rejilla items={g.items} lang={lang} labels={labels} kb={`site-${g.site}`} />
                </Plegable>
              ))}
            </div>
          </Plegable>
        )}

        {/* Resúmenes del grupo de Telegram ocultos temporalmente */}
      </div>
    </Rise>
  );
}
