import { Copiar } from "./copiar";
import { redactorGmail } from "@/lib/gmail";

export type BizumStrings = {
  badge: string;
  intro: string;
  codigoLabel: string;
  copiar: string;
  copiado: string;
  nombreLabel: string;
  /** Subtítulo bajo el nombre. `{cif}` se sustituye. */
  nombreSub: string;
  /** Cuatro pasos. `{codigo}` y `{nombre}` se sustituyen. */
  pasos: string[];
  /** Aviso de seguridad. `{nombre}` y `{email}` se sustituyen (el email va como enlace). */
  aviso: string;
};

/**
 * Bloque de donación por Bizum «Donación a ONG». Es INFORMATIVO: el pago ocurre entero
 * dentro de la app del banco; esta web no procesa nada ni ve datos bancarios (por eso no
 * necesita consentimiento ni pasarela). Réplica del bloque de la tienda estática.
 *
 * El teal es el color de marca de Bizum (ayuda a reconocer el método); se usa SOLO aquí.
 */
export function AportarBizum({
  s,
  codigo,
  nombre,
  cif,
  email,
}: {
  s: BizumStrings;
  codigo: string;
  nombre: string;
  cif: string;
  email: string;
}) {
  const [avisoAntes, avisoDespues] = s.aviso.replace("{nombre}", nombre).split("{email}");

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-linea)] border-l-4 border-l-[#0f766e] bg-[var(--color-fondo)] p-6">
      <span className="inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-4 py-1.5 font-[family-name:var(--ff-mono)] text-xs font-semibold uppercase tracking-wider text-white">
        {s.badge}
      </span>

      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <div>
          <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {s.codigoLabel}
          </p>
          <div className="mt-1 flex items-center gap-4">
            <span className="font-[family-name:var(--ff-mono)] text-4xl font-medium tabular-nums text-[var(--color-tinta)]">
              {codigo}
            </span>
            <Copiar valor={codigo} label={s.copiar} hecho={s.copiado} />
          </div>
        </div>
        <div className="sm:border-l sm:border-[var(--color-linea)] sm:pl-6">
          <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {s.nombreLabel}
          </p>
          <p className="mt-1 font-[family-name:var(--ff-display)] text-lg font-semibold leading-snug text-[var(--color-tinta)]">
            {nombre}
          </p>
          <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
            {s.nombreSub.replace("{cif}", cif)}
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-2.5">
        {s.pasos.map((paso, i) => (
          <li key={i} className="flex gap-3 text-sm text-[var(--color-tinta)]">
            <span className="font-[family-name:var(--ff-mono)] font-semibold text-[#0f766e]">
              {i + 1}.
            </span>
            <span>{paso.replace("{codigo}", codigo).replace("{nombre}", nombre)}</span>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-lg border border-[color-mix(in_srgb,#0f766e_25%,transparent)] bg-[color-mix(in_srgb,#0f766e_7%,transparent)] px-4 py-3 text-xs leading-relaxed text-[var(--color-tinta-suave)]">
        {avisoAntes}
        <a
          href={redactorGmail(email, s.badge)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-acento-tinta)] underline underline-offset-2"
        >
          {email}
        </a>
        {avisoDespues}
      </p>
    </div>
  );
}
