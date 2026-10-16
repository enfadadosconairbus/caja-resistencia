/**
 * «Qué se ha conseguido», tema a tema: lo que había sobre la mesa ANTES de la huelga y lo que
 * hay DESPUÉS. Lo pidió la coordinación (1-oct-2026) con las dos listas en la mano; en párrafos, la
 * comparación se perdía.
 *
 * Es una tabla de verdad (`<table>`, con cada tema como cabecera de fila): un lector de pantalla
 * anuncia «Teletrabajo, Antes de la huelga…» en vez de leer tres bloques sueltos. En móvil no
 * caben tres columnas, así que cada fila se apila como una ficha y lleva su propio rótulo; esos
 * rótulos se ocultan en escritorio, donde los da la cabecera.
 *
 * Sin estado ni eventos: se pinta entera en el servidor.
 */

export type Comparativa = {
  tema: string;
  antes: string;
  despues: string;
  filas: { tema: string; antes: string; despues: string }[];
  ademasTitulo: string;
  ademas: string[];
};

const ROTULO = "font-[family-name:var(--ff-mono)] text-[11px] uppercase tracking-wider";

export function ComparativaHuelga({ c }: { c: Comparativa }) {
  return (
    <div className="mt-10 max-w-5xl">
      <table className="w-full border-collapse text-left">
        <thead className="hidden md:table-header-group">
          <tr>
            <th scope="col" className="w-48 pb-3 pr-6 align-bottom">
              <span className="sr-only">{c.tema}</span>
            </th>
            <th scope="col" className={`pb-3 pr-6 align-bottom font-normal text-[var(--color-tinta-suave)] ${ROTULO}`}>
              {c.antes}
            </th>
            <th scope="col" className={`pb-3 align-bottom font-normal text-[var(--color-acento-tinta)] ${ROTULO}`}>
              {c.despues}
            </th>
          </tr>
        </thead>
        <tbody>
          {c.filas.map((f) => (
            <tr key={f.tema} className="block border-t border-[var(--color-linea)] py-5 md:table-row md:py-0">
              <th
                scope="row"
                className="block pb-3 text-left align-top font-[family-name:var(--ff-display)] text-lg font-bold leading-snug text-[var(--color-tinta)] md:table-cell md:w-48 md:py-5 md:pr-6"
              >
                {f.tema}
              </th>
              <td className="block pb-4 align-top text-base leading-relaxed text-[var(--color-tinta-suave)] md:table-cell md:py-5 md:pr-6">
                <span className={`mb-1 block ${ROTULO} md:hidden`}>{c.antes}</span>
                {f.antes}
              </td>
              <td className="block align-top text-base leading-relaxed text-[var(--color-tinta)] md:table-cell md:py-5">
                <span className={`mb-1 block text-[var(--color-acento-tinta)] ${ROTULO} md:hidden`}>{c.despues}</span>
                {f.despues}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-12 font-[family-name:var(--ff-display)] text-xl font-bold text-[var(--color-tinta)]">
        {c.ademasTitulo}
      </h3>
      <ul className="mt-4 max-w-3xl space-y-3">
        {c.ademas.map((a) => (
          <li key={a} className="flex gap-3 text-base leading-relaxed text-[var(--color-tinta)]">
            <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-acento-tinta)]" />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
