import Link from "next/link";
import { costeCampana, eurosExacto, type Campana, type EstadoCampana } from "@/config/fondo";

/**
 * Piezas compartidas por el índice de Campañas y la ficha de una campaña.
 *
 * La regla de esta sección, y conviene tenerla a mano al tocarla: una campaña cuenta lo que
 * COSTÓ, no lo que recaudó. Los ingresos de la caja son acumulados y no se atribuyen a una
 * lucha —quien transfiere no dice a cuál van—, mientras que un gasto sí sabe de dónde
 * viene. El porqué largo está en `config/fondo.ts`, sobre `interface Campana`.
 */

export type CampanaStrings = {
  estados: Record<EstadoCampana, string>;
  coste: string;
  costeCerrada: string;
  desglose: string;
  conseguidoLabel: string;
  desde: string;
  hasta: string;
  abierta: string;
  sinFecha: string;
  sinGastos: string;
  ver: string;
  volver: string;
  relato: string;
  relatoCta: string;
  fichas: Record<string, { nombre: string; lema: string; conseguido: string }>;
};

/** Chapita de estado. La prevista va en tinta suave: no se le da el color de lo que existe. */
export function EstadoChapa({ estado, s }: { estado: EstadoCampana; s: CampanaStrings }) {
  const vivo = estado === "en-curso";
  const previsto = estado === "prevista";
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider ${
        vivo
          ? "border-[var(--color-acento-tinta)] bg-[color-mix(in_srgb,var(--color-acento)_10%,transparent)] text-[var(--color-acento-tinta)]"
          : previsto
            ? "border-dashed border-[var(--color-linea)] text-[var(--color-tinta-suave)]"
            : "border-[var(--color-linea)] text-[var(--color-tinta-suave)]"
      }`}
    >
      {s.estados[estado]}
    </span>
  );
}

/** «1 jul 2026 — sigue abierta». Una prevista no tiene fechas y lo dice. */
export function periodo(c: Campana, s: CampanaStrings, lang: string): string {
  if (!c.desde) return s.sinFecha;
  const f = (iso: string) =>
    new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  return `${f(c.desde)} — ${c.hasta ? f(c.hasta) : s.abierta}`;
}

/**
 * Tarjeta del índice. Las que tienen `slug` enlazan a su ficha; las previstas no, porque
 * todavía no hay nada que contar y una página vacía es peor que ninguna.
 */
export function TarjetaCampana({
  c,
  s,
  lang,
  etiquetasGasto,
}: {
  c: Campana;
  s: CampanaStrings;
  lang: string;
  etiquetasGasto: Record<string, string>;
}) {
  const ficha = s.fichas[c.clave];
  const coste = costeCampana(c);
  const cuerpo = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <EstadoChapa estado={c.estado} s={s} />
        <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {periodo(c, s, lang)}
        </span>
      </div>
      <h3 className="mt-4 font-[family-name:var(--ff-display)] text-2xl font-bold leading-tight text-[var(--color-tinta)]">
        {ficha.nombre}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">{ficha.lema}</p>

      {c.gastos.length ? (
        <dl className="mt-5 border-t border-[var(--color-linea)] pt-4">
          <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {c.estado === "cerrada" ? s.costeCerrada : s.coste}
          </dt>
          <dd className="mt-1 font-[family-name:var(--ff-mono)] text-3xl font-medium tabular-nums text-[var(--color-tinta)]">
            {eurosExacto(coste, lang)}
          </dd>
          <dd className="mt-2 text-xs text-[var(--color-tinta-suave)]">
            {c.gastos
              .filter((g) => g.importe !== null)
              .map((g) => etiquetasGasto[g.clave] ?? g.clave)
              .join(" · ")}
          </dd>
        </dl>
      ) : null}
    </>
  );

  const clase =
    "flex h-full flex-col rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-7";

  if (!c.slug) {
    return <div className={clase}>{cuerpo}</div>;
  }
  return (
    <Link href={`/${lang}/campanas/${c.slug}`} className={`${clase} group transition-colors hover:border-[var(--color-tinta)]`}>
      {cuerpo}
      <span className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-acento-tinta)]">
        {s.ver}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1"
        >
          <path d="M5.5 3 9.5 7l-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
