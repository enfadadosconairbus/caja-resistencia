import Link from "next/link";
import { getActas } from "@/lib/actas-source";
import { getDocumentos } from "@/lib/documentos-source";
import { MaskText, Rise } from "@/components/motion";
import type { DocumentacionStrings } from "@/components/documentacion";

/**
 * Avance de la documentación en la portada.
 *
 * Cuenta lo que hay y lleva a /documentacion, pero **no pinta ni un solo cuerpo de texto**:
 * ahí estaba el problema. La sección completa costaba 469 KB de HTML y 5.317 elementos de
 * DOM en la portada — LCP de 14,7 s en móvil, medido en producción. Los contadores son
 * reales (salen de las mismas fuentes), así que esto informa de verdad; lo que no hace es
 * cobrarle la biblioteca entera a quien entra a entender el conflicto o a aportar.
 */
export async function DocumentacionAvance({
  s,
  lang,
}: {
  s: DocumentacionStrings;
  lang: string;
}) {
  const [{ actas }, indice] = await Promise.all([getActas(), getDocumentos()]);
  const nf = new Intl.NumberFormat(lang);

  const cifras = [
    { n: actas.filter((a) => a.tipo === "acta").length, k: s.portadaActas },
    // Resúmenes del grupo de Telegram ocultos temporalmente
    { n: indice.total, k: s.portadaDocumentos },
  ].filter((c) => c.n > 0);

  return (
    <>
      <p className="kicker">{s.kicker}</p>
      <MaskText
        as="h2"
        lines={s.title}
        className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl"
      />
      <Rise>
        <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{s.intro}</p>
      </Rise>

      <Rise>
        <dl className="mt-10 grid gap-6 sm:grid-cols-3">
          {cifras.map((c) => (
            <div
              key={c.k}
              className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6"
            >
              <dd className="font-[family-name:var(--ff-mono)] text-4xl font-medium tabular-nums text-[var(--color-tinta)]">
                {nf.format(c.n)}
              </dd>
              <dt className="mt-2 text-sm text-[var(--color-tinta-suave)]">{c.k}</dt>
            </div>
          ))}
        </dl>
      </Rise>

      <Rise>
        {/* Junto al botón iba un «{n} se descargan desde aquí». Se quitó (10-ago-2026): las
            cifras que importan ya están en las tres tarjetas de arriba, y repetir una de
            ellas al lado del botón no añadía nada. */}
        <div className="mt-8">
          <Link
            href={`/${lang}/documentacion`}
            className="inline-flex items-center gap-3 rounded-full bg-[var(--color-confianza)] px-8 py-4 font-semibold text-white transition-colors hover:bg-[var(--color-tinta-fija)]"
          >
            {s.ctaVer}
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </Rise>
    </>
  );
}
