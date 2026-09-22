import * as React from "react";

/**
 * Bloque plegable de la sección Documentación. `<details>` nativo: funciona con teclado
 * y sin JavaScript, y el contenido se renderiza en servidor (el buscador lo ve aunque
 * esté cerrado). Todo llega cerrado: el visitante abre solo lo que quiere leer.
 */
export function Plegable({
  titulo,
  n,
  nota,
  abierto = false,
  nivel = "h3",
  children,
}: {
  titulo: string;
  n?: number;
  nota?: string;
  abierto?: boolean;
  nivel?: "h3" | "h4";
  children: React.ReactNode;
}) {
  const grande = nivel === "h3";
  const Titulo = nivel;

  return (
    <details
      open={abierto}
      className="group border-b border-[var(--color-linea)] first:border-t open:bg-[color-mix(in_srgb,var(--color-fondo)_55%,transparent)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 py-4 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-confianza-tinta)] [&::-webkit-details-marker]:hidden">
        <Titulo
          className={
            grande
              ? "font-[family-name:var(--ff-display)] text-xl font-bold text-[var(--color-tinta)] md:text-2xl"
              : "font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta)]"
          }
        >
          {titulo}
          {n != null ? (
            <span className="ml-2 font-normal text-[var(--color-tinta-suave)]">· {n}</span>
          ) : null}
        </Titulo>
        {nota ? (
          <span className="ml-auto hidden font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)] md:inline">
            {nota}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className={`shrink-0 text-[var(--color-acento-tinta)] transition-transform duration-200 group-open:rotate-45 ${nota ? "" : "ml-auto"}`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      {/* `content-visibility` deja que el navegador se salte el layout y el pintado de lo
          que está cerrado o fuera de pantalla. Con 150 bloques desplegables en la página,
          es la diferencia entre maquetarlo todo de golpe y maquetar solo lo que se ve. */}
      <div
        className={grande ? "pb-8 pt-1" : "pb-6 pt-1"}
        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}
      >
        {children}
      </div>
    </details>
  );
}
