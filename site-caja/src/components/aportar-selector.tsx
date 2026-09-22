"use client";
import * as React from "react";
import { FONDO, pasarelaActiva } from "@/config/fondo";

export type SelectorStrings = {
  kicker: string;
  badge: string;
  importe: string;
  otra: string;
  otraPlaceholder: string;
  resumen: string;
  cta: string;
  bloqueado: string;
};

const IMPORTES = [20, 50, 100];

/**
 * PREVIEW del pago con tarjeta. Va DEBAJO de los canales que sí operan (transferencia y
 * Bizum): no es la vía principal, es un adelanto de cómo se elegirá el importe cuando la
 * pasarela esté activa. Mientras `pasarelaActiva` sea false, el botón está deshabilitado y
 * lo dice — nunca simula un cobro (D-11). El día que sea true, el CTA pasa a ser un enlace
 * con el importe ya puesto. Sin frecuencia: no se puede contratar una aportación recurrente,
 * así que no se ofrece «mensual» (era una promesa que la operativa no podía cumplir).
 */
export function AportarSelector({ s, lang }: { s: SelectorStrings; lang: string }) {
  const [importe, setImporte] = React.useState<number | null>(50);
  const [otra, setOtra] = React.useState("");

  const valor = importe ?? (otra ? Number(otra.replace(",", ".")) : NaN);
  const valido = Number.isFinite(valor) && valor > 0;
  const fmt = valido
    ? new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(valor)
    : "—";

  const chip = (activo: boolean) =>
    `rounded-full border px-5 py-2.5 font-[family-name:var(--ff-mono)] text-sm transition-colors ${
      activo
        ? "border-[var(--color-acento-tinta)] bg-[var(--color-acento)] text-white"
        : "border-[var(--color-linea)] bg-[var(--color-fondo)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
    }`;

  const destino =
    pasarelaActiva && FONDO.pasarela.checkoutUrl && valido
      ? `${FONDO.pasarela.checkoutUrl}?importe=${valor}`
      : null;

  return (
    <div className="rounded-xl border border-dashed border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="kicker !mb-0">{s.kicker}</p>
        {!pasarelaActiva ? (
          <span className="rounded-full border border-[var(--color-acento-tinta)] px-3 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-acento-tinta-fuerte)]">
            {s.badge}
          </span>
        ) : null}
      </div>

      <fieldset className="mt-5">
        <legend className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {s.importe}
        </legend>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {IMPORTES.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={importe === v}
              onClick={() => { setImporte(v); setOtra(""); }}
              className={chip(importe === v)}
            >
              {new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)}
            </button>
          ))}
          <label className={`flex items-center gap-2 ${chip(importe === null)}`}>
            <span className="sr-only">{s.otra}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={otra}
              placeholder={s.otra}
              onFocus={() => setImporte(null)}
              onChange={(e) => { setImporte(null); setOtra(e.target.value); }}
              className="w-20 bg-transparent font-[family-name:var(--ff-mono)] text-sm outline-none placeholder:text-current"
            />
            <span aria-hidden="true">{s.otraPlaceholder}</span>
          </label>
        </div>
      </fieldset>

      <p aria-live="polite" className="mt-6 text-sm text-[var(--color-tinta-suave)]">
        {s.resumen.replace("{importe}", fmt)}
      </p>

      <div className="mt-5">
        {destino ? (
          <a
            href={destino}
            className="inline-block rounded-full bg-[var(--color-acento)] px-8 py-4 font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
          >
            {s.cta.replace("{importe}", fmt)}
          </a>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full bg-[var(--color-acento)] px-8 py-4 font-semibold text-white opacity-45"
            >
              {s.cta.replace("{importe}", fmt)}
            </button>
            <p className="mt-3 font-[family-name:var(--ff-mono)] text-xs text-[var(--color-acento-tinta-fuerte)]">
              {s.bloqueado}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
