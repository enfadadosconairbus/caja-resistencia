import type { Horquilla as Datos } from "@/lib/dashboard-parse";
import { GraficaHorquilla } from "@/components/horquilla-grafica";
import { eurosCorto, fechaES } from "@/lib/formato";

/**
 * Horquilla mín–máx del impacto acumulado a la empresa — el "punto de ruptura".
 *
 * Dos columnas: a la izquierda se explica cómo se construye la banda y qué significa; a la
 * derecha, las cifras y el gráfico. La explicación no es adorno: una banda que va de 38 a
 * 300 M€ sin contexto parece un dato inventado, y con contexto se entiende que son dos
 * escenarios distintos, no un margen de error.
 *
 * **El último apartado de la explicación baja a la columna derecha.** El gráfico y sus pies
 * ocupan bastante menos que los cuatro apartados, así que la derecha terminaba a media altura
 * y dejaba un hueco en blanco del tamaño de media sección. Moviendo el último bloque debajo
 * del gráfico las dos columnas acaban casi a la misma altura, y además cae donde toca: es el
 * apartado que dice qué mirar para saber por dónde va la curva que se acaba de ver.
 *
 * Es una ESTIMACIÓN POR ESCENARIOS de un seguimiento independiente, no una cifra oficial
 * de Airbus, y el pie lo dice siempre.
 */

export type HorquillaStrings = {
  label: string;
  intro: string;
  hoyLabel: string;
  diarioLabel: string;
  finLabel: string;
  leyenda: string;
  leyendaProy: string;
  cotaMin: string;
  cotaMax: string;
  nota: string;
  hoy: string;
  ejeAria: string;
  /** Explicación de la izquierda: pares de titular + cuerpo. */
  comoTitulo: string;
  como: { t: string; d: string }[];
  /** Aviso de análisis viejo. {fecha} = fecha del análisis. */
  desactualizado: string;
};

/** Días desde el análisis a partir de los cuales se avisa de que está viejo. */
const DIAS_PARA_AVISAR = 21;

/**
 * ¿Hay que avisar de que el análisis está viejo?
 *
 * Se compara la fecha del ANÁLISIS (los supuestos por planta, que el tercero escribe a mano
 * en el título de su tarjeta) con el último día de la serie, que se alarga sola cada día.
 * En cuanto el tercero rehaga el análisis, la distancia se acorta y **el aviso desaparece
 * solo**: no hay que acordarse de quitarlo.
 */
function analisisViejo(datos: Datos): boolean {
  const ultimo = datos.serie[datos.serie.length - 1]?.dia;
  if (!datos.analisis || !ultimo) return false;
  const dias = (Date.parse(ultimo) - Date.parse(datos.analisis)) / 86400000;
  return Number.isFinite(dias) && dias > DIAS_PARA_AVISAR;
}

export function Horquilla({ datos, s, lang }: { datos: Datos | null; s: HorquillaStrings; lang: string }) {
  if (!datos?.hoy || datos.serie.length < 2) return null;
  const { hoy, fin } = datos;
  const rango = (a: number, b: number) => `${eurosCorto(a, lang)}–${eurosCorto(b, lang)}`;

  // Mientras la huelga está parada, la fuente no proyecta: el último día observado y el
  // final de la serie son el mismo punto, y repetir la cifra parecería un fallo.
  const hayProyeccion = Boolean(fin && fin.dia !== hoy.dia);
  const viejo = analisisViejo(datos);

  const kpis = [
    { k: rango(hoy.minAcum, hoy.maxAcum), sub: s.hoyLabel },
    { k: rango(hoy.minDia, hoy.maxDia), sub: s.diarioLabel },
    hayProyeccion && fin ? { k: rango(fin.minAcum, fin.maxAcum), sub: s.finLabel } : null,
  ].filter(Boolean) as { k: string; sub: string }[];

  // El reparto solo tiene sentido si queda explicación de sobra en la izquierda: con dos
  // apartados o menos, mover uno desequilibra en vez de cuadrar.
  const partir = s.como.length >= 3;
  const explicacion = partir ? s.como.slice(0, -1) : s.como;
  const bajoElGrafico = partir ? s.como[s.como.length - 1] : null;

  return (
    <div className="mt-10 rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
      <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {s.label}
      </p>

      {viejo && datos.analisis ? (
        <p className="mt-3 rounded-lg border border-[var(--color-riesgo-ambar)] bg-[color-mix(in_srgb,var(--color-riesgo-ambar)_8%,transparent)] px-4 py-3 font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[var(--color-riesgo-ambar-fuerte)]">
          {s.desactualizado.replace("{fecha}", fechaES(datos.analisis, lang, { day: "numeric", month: "long", year: "numeric" }))}
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* ── Izquierda: cómo se construye y qué significa ── */}
        <div>
          <h3 className="font-[family-name:var(--ff-display)] text-lg font-bold text-[var(--color-tinta)]">
            {s.comoTitulo}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-tinta-suave)]">{s.intro}</p>
          <dl className="mt-5 space-y-4">
            {explicacion.map((p) => (
              <div key={p.t} className="border-l-2 border-[var(--color-acento-tinta)] pl-4">
                <dt className="text-sm font-semibold text-[var(--color-tinta)]">{p.t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--color-tinta-suave)]">{p.d}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Derecha: cifras y gráfico ── */}
        <div>
          <dl className={`grid gap-4 ${hayProyeccion ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {kpis.map((t) => (
              <div key={t.sub} className="rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] p-4">
                <dd className="font-[family-name:var(--ff-mono)] text-lg font-medium tabular-nums text-[var(--color-tinta)] sm:text-xl">
                  {t.k}
                </dd>
                <dt className="mt-1 text-xs text-[var(--color-tinta-suave)]">{t.sub}</dt>
              </div>
            ))}
          </dl>

          <GraficaHorquilla datos={datos} lang={lang} etiquetaHoy={s.hoy} ejeAria={s.ejeAria} />

          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-center gap-2 font-[family-name:var(--ff-mono)] text-[10px] text-[var(--color-tinta-suave)]">
              <span aria-hidden="true" className="inline-block h-2 w-4 rounded-sm bg-[var(--color-acento)] opacity-40" />
              {s.leyenda}
              {hayProyeccion ? ` · ${s.leyendaProy}` : ""}
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">
            {s.cotaMin} · {s.cotaMax}
          </p>

          {bajoElGrafico ? (
            <dl className="mt-6">
              <div className="border-l-2 border-[var(--color-acento-tinta)] pl-4">
                <dt className="text-sm font-semibold text-[var(--color-tinta)]">{bajoElGrafico.t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--color-tinta-suave)]">
                  {bajoElGrafico.d}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>

      <p className="mt-6 rounded-lg border border-dashed border-[var(--color-linea)] px-4 py-3 font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[var(--color-tinta-suave)]">
        {s.nota}
      </p>
    </div>
  );
}
