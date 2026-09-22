"use client";
import * as React from "react";

/**
 * Chapa de estado de la huelga, anclada arriba del todo. Portada desde la Web A del
 * movimiento (site/) el 18-sep-2026: antes aquí había un cintillo de texto FIJO
 * (cintillo-huelga.tsx, retirado), que se quedaba desfasado. Esta se reescribe sola.
 *
 * Se maneja con `inicioISO` (arranque de la fase) + `pausaISO` (fecha de pausa, o null) +
 * `zona` (huso del conflicto). El estado va: cuenta atrás → mañana → hoy → en curso → en
 * pausa. Config en `@/config/arranque-huelga.json` (ESPEJO del de la Web A).
 */
export type ChapaStrings = {
  /** Etiqueta fija de la chapa. Va en versal, es lo primero que se lee. */
  etiqueta: string;
  /** Cuenta atrás. `{n}` = días que faltan (siempre 2 o más; el 1 tiene su propia línea). */
  faltan: string;
  manana: string;
  hoy: string;
  /** Del 25 en adelante: la huelga ya es de 24 h y no tiene fecha de fin. */
  curso: string;
  /** Desde la fecha de pausa: la huelga sigue vigente pero pausada en todos los centros. */
  pausada: string;
  /** Cola descriptiva. Se cae por debajo de `sm`. */
  detalle: string;
  detalleCurso: string;
  detallePausa: string;
};

type Estado = "previo" | "manana" | "hoy" | "curso" | "pausada";

/** Hoy en el huso del conflicto, en ISO. `en-CA` es el único locale que formatea YYYY-MM-DD. */
function hoyEn(zona: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dias(desdeISO: string, hastaISO: string): number {
  const ms = Date.parse(`${hastaISO}T00:00:00Z`) - Date.parse(`${desdeISO}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function estadoDe(hoyISO: string, inicioISO: string): Estado {
  const d = dias(hoyISO, inicioISO);
  if (d > 1) return "previo";
  if (d === 1) return "manana";
  if (d === 0) return "hoy";
  return "curso";
}

export function ChapaHuelga({
  s,
  hoyISO,
  inicioISO,
  pausaISO,
  zona,
}: {
  s: ChapaStrings;
  hoyISO: string;
  inicioISO: string;
  /** Fecha de pausa (ISO). Desde ella la huelga sigue vigente pero pausada. `null` = activa. */
  pausaISO?: string | null;
  zona: string;
}) {
  // La portada puede generarse estática (fecha del build), así que el estado se recalcula
  // en el cliente al montar y cada minuto, para que a quien deje la pestaña abierta le
  // cambie al pasar la medianoche. El primer render usa `hoyISO` del servidor: evita el
  // desajuste de hidratación.
  const [hoy, setHoy] = React.useState(hoyISO);

  React.useEffect(() => {
    const revisar = () => setHoy(hoyEn(zona));
    revisar();
    const t = setInterval(revisar, 60_000);
    return () => clearInterval(t);
  }, [zona]);

  // La pausa gana a «en curso»: una vez arrancada, si hay fecha de pausa y ya llegó, la
  // huelga sigue vigente pero pausada. Se reanuda poniendo `pausa` a null en el config.
  let estado = estadoDe(hoy, inicioISO);
  if (estado === "curso" && pausaISO && hoy >= pausaISO) estado = "pausada";

  const texto =
    estado === "previo"
      ? s.faltan.replace("{n}", String(dias(hoy, inicioISO)))
      : estado === "manana"
        ? s.manana
        : estado === "hoy"
          ? s.hoy
          : estado === "pausada"
            ? s.pausada
            : s.curso;
  const detalle =
    estado === "pausada" ? s.detallePausa : estado === "curso" ? s.detalleCurso : s.detalle;

  // En caliente (el 24 y a partir del 25) la chapa es de relleno rojo; antes —y también en
  // pausa— la banda teñida que usa el resto del sitio para avisos. El salto de intensidad es
  // la señal: en pausa la huelga sigue vigente, pero baja de intensidad porque no hay paro.
  const caliente = estado === "hoy" || estado === "curso";

  return (
    <div
      className={
        caliente
          ? "bg-[var(--color-acento)] text-[var(--color-papel-fijo)]"
          : "border-b border-[color-mix(in_srgb,var(--color-acento)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-acento)_8%,transparent)] text-[var(--color-acento-tinta-fuerte)]"
      }
    >
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2.5 text-center font-[family-name:var(--ff-mono)] text-xs leading-relaxed">
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            caliente ? "bg-[var(--color-papel-fijo)]" : "bg-[var(--color-acento)]"
          }`}
        />
        <span className="font-semibold uppercase tracking-wider">{s.etiqueta}</span>
        <span className={caliente ? "opacity-90" : ""}>{texto}</span>
        <span className={`hidden sm:inline ${caliente ? "opacity-90" : ""}`}>{detalle}</span>
      </p>
    </div>
  );
}
