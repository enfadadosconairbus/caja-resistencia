import { getActas } from "@/lib/actas-source";
import { getDocumentos } from "@/lib/documentos-source";
import { ActasLista } from "@/components/actas-lista";
import { DocumentosLista, type DocumentosLabels } from "@/components/documentos-lista";
import { Plegable } from "@/components/plegable";
import { InformeDestacado, type InformesStrings } from "@/components/informe-destacado";

/**
 * DOCUMENTACIÓN (antes «Actualizaciones»). Tres bloques plegables, todos cerrados de
 * salida: actas por centro, resúmenes diarios del grupo e índice de documentos.
 *
 * De dónde sale cada cosa:
 *   · actas y resúmenes → src/config/actas.json, que alimenta el userbot desde Telegram
 *     (los resúmenes, del topic «Resúmenes»).
 *   · índice de documentos → el que publica a diario el Grupo Documentación en telegra.ph,
 *     leído en vivo por el servidor con fallback al snapshot del repo.
 */

export type DocumentacionStrings = {
  kicker: string;
  title: string;
  intro: string;
  ejemploTag: string;
  grupoHeading: string;
  grupoNota: string;
  sitesHeading: string;
  grupoLabel: string;
  sinActas: string;
  indiceHeading: string;
  indiceNota: string;
  indiceResumen: string;
  indiceActualizado: string;
  indiceFuente: string;
  descargar: string;
  /** «{n} se descargan desde aquí» — aviso de categoría en la página de documentación,
   *  solo cuando NO se descargan todos. Ya no se usa en la portada (documentacion-avance). */
  descargables: string;
  verEnGrupo: string;
  soloGrupo: string;
  versiones: string;
  /* Página propia y avance en la portada (ver documentacion-avance.tsx). */
  metaTitle: string;
  metaDescription: string;
  volver: string;
  ctaVer: string;
  portadaActas: string;
  portadaResumenes: string;
  portadaDocumentos: string;
  notaActas: string;
};

/** Poner a false para reactivar las descargas una vez terminada la auditoría. */
const AUDITORIA_EN_CURSO = false;

const BANNER_AUDITORIA: Record<string, string> = {
  es: "Auditoría jurídico-editorial en curso. Las descargas están temporalmente deshabilitadas y se habilitarán de nuevo en las próximas horas.",
  en: "Legal and editorial audit in progress. Downloads are temporarily disabled and will be re-enabled within the next few hours.",
  fr: "Audit juridique et éditorial en cours. Les téléchargements sont temporairement désactivés et seront réactivés dans les prochaines heures.",
  de: "Rechtliche und redaktionelle Prüfung läuft. Downloads sind vorübergehend deaktiviert und werden in den nächsten Stunden wieder aktiviert.",
};

export async function Documentacion({
  s,
  informes,
  lang,
  titulo = "h2",
}: {
  s: DocumentacionStrings;
  /** Textos del informe destacado, que se pinta antes de los plegables. */
  informes: InformesStrings;
  lang: string;
  /** h1 cuando es la página de documentación; h2 cuando va dentro de otra. */
  titulo?: "h1" | "h2";
}) {
  const [{ actas, ejemplo }, indice] = await Promise.all([getActas(), getDocumentos()]);
  const Titulo = titulo;

  // Auditoría: se retiran de la web los documentos descargables (PDF); permanecen
  // los que solo se consultan en el grupo. La sección y su aviso siguen visibles.
  const catsDoc = AUDITORIA_EN_CURSO
    ? indice.categorias
        .map((c) => ({ ...c, documentos: c.documentos.filter((d) => !d.pdf), descargables: 0 }))
        .filter((c) => c.documentos.length > 0)
    : indice.categorias;
  const totalDoc = AUDITORIA_EN_CURSO
    ? catsDoc.reduce((n, c) => n + c.documentos.length, 0)
    : indice.total;

  const labelsDocs: DocumentosLabels = {
    indiceHeading: s.indiceHeading,
    indiceNota: s.indiceNota,
    descargar: s.descargar,
    descargables: s.descargables,
    verEnGrupo: s.verEnGrupo,
    soloGrupo: s.soloGrupo,
    versiones: s.versiones,
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="kicker">{s.kicker}</p>
        {ejemplo ? (
          <span className="rounded bg-[color-mix(in_srgb,var(--color-confianza)_12%,transparent)] px-2 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)]">
            {s.ejemploTag}
          </span>
        ) : null}
      </div>
      <Titulo className="mt-4 font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">
        {s.title}
      </Titulo>
      <p className="mt-6 text-[var(--color-tinta-suave)]">{s.intro}</p>

      {/* Antes de los plegables: lo de abajo es un volcado automático de 85 documentos, y
          un informe editorial metido ahí dentro no lo encuentra nadie. */}
      <InformeDestacado s={informes} lang={lang} variante="destacado" />

      {actas.length === 0 && indice.categorias.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-[var(--color-linea)] bg-[var(--color-fondo)] px-5 py-4 font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
          {s.sinActas}
        </p>
      ) : (
        <div className="mt-10">
          {actas.length > 0 ? (
            <p className="mb-6 rounded-lg border border-[var(--color-linea)] bg-[var(--color-superficie)] px-4 py-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
              {s.notaActas}
            </p>
          ) : null}
          {actas.length > 0 ? (
            <ActasLista
              actas={actas}
              labels={{
                grupoHeading: s.grupoHeading,
                grupoNota: s.grupoNota,
                sitesHeading: s.sitesHeading,
                grupoLabel: s.grupoLabel,
              }}
              lang={lang}
              auditoria={AUDITORIA_EN_CURSO}
            />
          ) : null}

          {indice.categorias.length > 0 ? (
            <Plegable titulo={s.indiceHeading} n={totalDoc}>
              {AUDITORIA_EN_CURSO ? (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-[var(--color-acento)] bg-[color-mix(in_srgb,var(--color-acento)_8%,transparent)] px-4 py-3">
                  <svg aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-acento-tinta)]" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M10 7v4M10 13h.01" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm leading-relaxed text-[var(--color-tinta)]">
                    {BANNER_AUDITORIA[lang] ?? BANNER_AUDITORIA.es}
                  </p>
                </div>
              ) : null}
              {!AUDITORIA_EN_CURSO ? (
                <p className="mb-5 max-w-3xl text-sm text-[var(--color-tinta-suave)]">
                  {s.indiceResumen
                    .replace("{n}", String(indice.total))
                    .replace("{c}", String(indice.categorias.length))
                    .replace("{d}", String(indice.descargables))}
                </p>
              ) : null}
              {catsDoc.length > 0 ? (
                <DocumentosLista categorias={catsDoc} labels={labelsDocs} lang={lang} />
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {indice.actualizado ? (
                  <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
                    {s.indiceActualizado.replace("{fecha}", indice.actualizado)}
                  </span>
                ) : null}
                <a
                  href={indice.fuente}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)] underline underline-offset-2 hover:text-[var(--color-acento-tinta)]"
                >
                  {s.indiceFuente}
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M5 3h6v6M11 3 3 11" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
              <p className="mt-3 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">
                {s.indiceNota}
              </p>
            </Plegable>
          ) : null}
        </div>
      )}
    </>
  );
}
