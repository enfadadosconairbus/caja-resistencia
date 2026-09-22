import { Stagger, StaggerItem } from "@/components/motion";

export type PuntoConflicto = {
  n: string;
  t: string;
  d: string;
  /** Contexto del manifiesto. Vacío cuando el manifiesto no da ninguno (punto 07). */
  detalle: string;
  exige: string[];
};

/**
 * Reivindicaciones del manifiesto, plegadas.
 *
 * `<details>` nativo como en el FAQ: abre por teclado sin JS y respeta reduced-motion
 * sin que haya que programarlo. La tarjeta cerrada es el resumen; abierta añade el
 * contexto y lo que se exige, literal del manifiesto.
 *
 * Retícula con borde por tarjeta, NO con el truco de `gap-px` sobre fondo gris: con 7
 * puntos en 2 columnas, ese truco dejaba ver el fondo en la 8ª celda y parecía que
 * faltaba un punto.
 */
export function ConflictoCards({
  points,
  exigeLabel,
  masDetalle,
}: {
  points: PuntoConflicto[];
  exigeLabel: string;
  masDetalle: string;
}) {
  return (
    <Stagger className="mt-12 grid items-start gap-4 md:grid-cols-2">
      {points.map((p) => (
        <StaggerItem key={p.n}>
          <details className="group h-full rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] transition-colors open:bg-[var(--color-superficie)]">
            <summary className="cursor-pointer list-none p-6 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)] [&::-webkit-details-marker]:hidden">
              <div className="flex items-baseline gap-3">
                <span className="font-[family-name:var(--ff-mono)] text-sm text-[var(--color-acento-tinta)]">
                  {p.n}
                </span>
                <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold">
                  {p.t}
                </h3>
                <span
                  aria-hidden="true"
                  className="ml-auto shrink-0 self-center text-[var(--color-acento-tinta)] transition-transform duration-200 group-open:rotate-45"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-tinta-suave)]">{p.d}</p>
              <span className="mt-3 inline-block font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)] group-open:hidden">
                {masDetalle}
              </span>
            </summary>

            <div className="border-t border-[var(--color-linea)] px-6 pb-6 pt-5">
              {p.detalle ? (
                <p className="text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {p.detalle}
                </p>
              ) : null}
              <p
                className={`font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)] ${
                  p.detalle ? "mt-5" : ""
                }`}
              >
                {exigeLabel}
              </p>
              <ul className="mt-3 space-y-2.5">
                {p.exige.map((e) => (
                  <li key={e} className="flex items-start gap-3">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-acento)]" />
                    <span className="text-sm leading-relaxed text-[var(--color-tinta)]">{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
