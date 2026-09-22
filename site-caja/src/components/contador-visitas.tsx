"use client";
import * as React from "react";

/**
 * Contador de visitas del pie.
 *
 * Sobrio a propósito: la cifra en la mono de la casa y una línea que dice qué se cuenta y
 * qué no. En una web que presume de no rastrear, un contador vistoso levantaría justo la
 * sospecha que la web intenta desactivar.
 *
 * Suma la visita contra `/api/visitas` al montar — una vez por carga real, no una vez por
 * build. Si no hay almacén configurado, la ruta devuelve null y **aquí no se pinta nada**:
 * antes sin contador que con un número que no signifique nada.
 */
export function ContadorVisitas({ label, nota }: { label: string; nota: string }) {
  const [n, setN] = React.useState<number | null>(null);

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/visitas", { method: "POST" })
      .then((r) => (r.ok ? (r.json() as Promise<{ visitas?: number | null }>) : null))
      .then((j) => {
        if (vivo && typeof j?.visitas === "number") setN(j.visitas);
      })
      .catch(() => {
        /* el contador nunca puede romper la página */
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (n == null) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <p className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--ff-mono)] text-2xl font-medium tabular-nums text-[var(--color-tinta)]">
          {new Intl.NumberFormat("es-ES").format(n)}
        </span>
        <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {label}
        </span>
      </p>
      <p className="font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">
        {nota}
      </p>
    </div>
  );
}
