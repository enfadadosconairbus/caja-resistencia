"use client";
import * as React from "react";

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
  /** Cola descriptiva. Se cae por debajo de `sm`: ver más abajo por qué. */
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

/**
 * Chapa de arranque de la huelga, anclada arriba del todo.
 *
 * No se puede cerrar y no hace falta tocarla: se reescribe sola según el día
 * (cuenta atrás → mañana → hoy → en curso, 24 h sin fecha de fin). Quien la cerrase el
 * día 20 no la vería el 24, que es justo el día que importa.
 *
 * La portada se genera estática, así que la fecha del servidor es la del build: el estado
 * se calcula otra vez en el cliente al montar, y se revisa cada minuto para que a quien
 * deje la pestaña abierta le cambie al pasar la medianoche. El primer render usa `hoyISO`
 * del servidor, que es lo que evita el desajuste de hidratación.
 *
 * El punto de estado NO parpadea: SC 2.2.2, y la urgencia de esto no la pone una animación.
 */
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
        {/* La cola descriptiva se cae en móvil. Con ella, la chapa ocupaba tres líneas y
            107 px de una pantalla de 812: una octava parte del alto para un aviso que no
            se puede cerrar. Lo que decide —cuánto falta y dónde mirar— se queda; el resto
            está a un toque, en la sección. */}
        <span className={`hidden sm:inline ${caliente ? "opacity-90" : ""}`}>{detalle}</span>
      </p>
    </div>
  );
}
