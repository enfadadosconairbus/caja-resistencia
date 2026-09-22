import { SAME_SKY, idiomasOrdenados, type Informe } from "@/config/informes";

/**
 * Informe propio del movimiento, en sus cuatro idiomas.
 *
 * Se pinta en dos sitios con la misma pieza: en «El conflicto» de la portada (variante
 * `compacto`, debajo de los PDF) y arriba del todo en Documentación (variante
 * `destacado`, antes de los plegables). Uno solo componente porque el contenido es el
 * mismo dato: duplicarlo garantiza que dentro de tres versiones uno de los dos quede
 * desactualizado, que es exactamente lo que le pasó a la lista de canales.
 *
 * El icono es el de ENLACE EXTERNO, no el de descarga de los PDF de al lado: el informe
 * se abre y se lee: no cae en la carpeta de Descargas. Que los dos botones no se
 * parezcan es la señal de que no hacen lo mismo.
 */

export type InformesStrings = {
  kicker: string;
  /** Subtítulo del informe. No se traduce el nombre; esto sí. */
  sameSkySub: string;
  sameSkyDesc: string;
  leerEn: string;
  /** Se añade al nombre accesible de cada enlace. Sin texto visible. */
  nuevaPestana: string;
  meta: string;
};

function Idiomas({
  informe,
  lang,
  s,
  tamano,
}: {
  informe: Informe;
  lang: string;
  s: InformesStrings;
  tamano: "sm" | "md";
}) {
  const md = tamano === "md";
  return (
    <>
      {idiomasOrdenados(informe, lang).map((i) => (
        <a
          key={i.lang}
          href={i.href}
          target="_blank"
          rel="noopener noreferrer"
          hrefLang={i.lang}
          aria-label={`${informe.titulo} — ${i.label} (${s.nuevaPestana})`}
          className={`inline-flex items-center gap-2 rounded-full border font-semibold transition-colors ${
            md ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-xs"
          } ${
            i.lang === lang
              ? "border-[var(--color-tinta)] text-[var(--color-tinta)] hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
              : "border-[var(--color-linea)] text-[var(--color-tinta-suave)] hover:border-[var(--color-tinta)] hover:text-[var(--color-tinta)]"
          }`}
        >
          <svg
            width={md ? 14 : 12}
            height={md ? 14 : 12}
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M5 3h6v6M11 3 3 11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {i.label}
        </a>
      ))}
    </>
  );
}

export function InformeDestacado({
  s,
  lang,
  variante,
  informe = SAME_SKY,
}: {
  s: InformesStrings;
  lang: string;
  variante: "compacto" | "destacado";
  informe?: Informe;
}) {
  const destacado = variante === "destacado";

  return (
    <div
      className={`rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] ${
        destacado ? "mt-10 p-6 md:p-8" : "mt-6 p-5"
      }`}
    >
      <p className="kicker">{s.kicker}</p>

      <h3
        className={`mt-3 font-[family-name:var(--ff-display)] font-bold leading-tight text-[var(--color-tinta)] ${
          destacado ? "text-2xl md:text-3xl" : "text-lg"
        }`}
      >
        {informe.titulo}{" "}
        <span className="font-normal text-[var(--color-tinta-suave)]">· {s.sameSkySub}</span>
      </h3>

      <p
        className={`mt-3 text-[var(--color-tinta-suave)] ${
          destacado ? "max-w-3xl" : "max-w-2xl text-sm"
        }`}
      >
        {s.sameSkyDesc}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
          {s.leerEn}
        </span>
        <Idiomas informe={informe} lang={lang} s={s} tamano={destacado ? "md" : "sm"} />
      </div>

      <p className="mt-4 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {s.meta}
      </p>
    </div>
  );
}
