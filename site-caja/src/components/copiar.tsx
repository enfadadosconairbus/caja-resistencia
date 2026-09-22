"use client";
import * as React from "react";

export function Copiar({
  valor,
  label,
  hecho,
}: {
  valor: string;
  label: string;
  hecho: string;
}) {
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
          } catch {
            /* sin portapapeles: el IBAN sigue visible y seleccionable */
          }
        }}
        className="rounded-full border border-[var(--color-linea)] px-4 py-2 font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
      >
        {copiado ? hecho : label}
      </button>
      <span aria-live="polite" className="sr-only">
        {copiado ? hecho : ""}
      </span>
    </>
  );
}
