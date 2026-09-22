"use client";
import * as React from "react";
import { CAMISETA, DONACIONES, MAX_UNIDADES, SITES } from "@/config/pedidos";
import { Copiar } from "./copiar";

export type MerchStrings = {
  kicker: string;
  title: string;
  intro: string;
  producto: { nombre: string; desc: string; alt: string };
  desglose: string;
  costeLabel: string;
  cajaLabel: string;
  porcentaje: string;
  tallaLabel: string;
  tallaAviso: string;
  cantidadLabel: string;
  cantidadMas: string;
  cantidadMenos: string;
  guiaTallas: string;
  guiaAlt: string;
  guiaNota: string;
  donacionLabel: string;
  sinDonacion: string;
  donacionNota: string;
  totalLabel: string;
  nombreLabel: string;
  emailLabel: string;
  siteLabel: string;
  sitePlaceholder: string;
  entrega: string;
  legalNota: string;
  confirmar: string;
  enviando: string;
  exito: {
    titulo: string;
    intro: string;
    conceptoLabel: string;
    beneficiarioLabel: string;
    ibanLabel: string;
    totalLabel: string;
    copiar: string;
    copiado: string;
    pasos: string[];
    otro: string;
  };
};

type Respuesta = {
  ok: boolean;
  referencia?: string;
  beneficiario?: string;
  iban?: string;
  total?: number;
  concepto?: string;
  error?: string;
};

function eur(v: number, lang: string) {
  return new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

const MONO = "font-[family-name:var(--ff-mono)]";
const LABEL = `${MONO} text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]`;

export function Merchandising({ s, lang }: { s: MerchStrings; lang: string }) {
  const [talla, setTalla] = React.useState<string>("");
  const [cantidad, setCantidad] = React.useState(1);
  const [donacion, setDonacion] = React.useState(0);
  const [nombre, setNombre] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [site, setSite] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<Respuesta | null>(null);

  const pctCaja = Math.round((CAMISETA.aLaCaja / CAMISETA.precio) * 100);
  const total = cantidad * CAMISETA.precio + donacion;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!talla) {
      setError(s.tallaAviso);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineas: [{ talla, cantidad }], donacion, nombre, email, site }),
      });
      const data = (await r.json()) as Respuesta;
      if (data.ok) setOk(data);
      else setError(data.error ?? "No se pudo registrar el pedido.");
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  // ── Pantalla de éxito: datos para transferir ──────────────────────────────
  if (ok && ok.referencia && ok.iban) {
    return (
      <div className="mt-12 max-w-2xl">
        <div className="rounded-2xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6 md:p-8">
          <p className="kicker !mb-0 text-[var(--color-confianza-tinta)]">{s.exito.titulo}</p>
          <p className="mt-3 text-[var(--color-tinta-suave)]">{s.exito.intro}</p>

          <dl className="mt-6 divide-y divide-[var(--color-linea)]">
            {[
              { k: s.exito.conceptoLabel, v: ok.concepto ?? ok.referencia, copiar: ok.concepto ?? ok.referencia },
              { k: s.exito.beneficiarioLabel, v: ok.beneficiario ?? "" },
              { k: s.exito.ibanLabel, v: ok.iban, copiar: ok.iban },
              { k: s.exito.totalLabel, v: eur(ok.total ?? total, lang) },
            ].map((row) => (
              <div key={row.k} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <dt className={LABEL}>{row.k}</dt>
                  <dd className={`mt-0.5 ${MONO} text-sm text-[var(--color-tinta)]`}>{row.v}</dd>
                </div>
                {"copiar" in row && row.copiar ? (
                  <Copiar valor={row.copiar} label={s.exito.copiar} hecho={s.exito.copiado} />
                ) : null}
              </div>
            ))}
          </dl>

          <ol className="mt-6 space-y-2">
            {s.exito.pasos.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm text-[var(--color-tinta-suave)]">
                <span className={`${MONO} font-semibold text-[var(--color-acento-tinta-fuerte)]`}>{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>

          <p className="mt-6 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-4 py-3 text-xs leading-relaxed text-[var(--color-tinta-suave)]">
            {s.entrega}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setOk(null);
            setCantidad(1);
            setDonacion(0);
          }}
          className={`mt-4 ${MONO} text-xs uppercase tracking-wider text-[var(--color-acento-tinta)] underline underline-offset-4`}
        >
          {s.exito.otro}
        </button>
      </div>
    );
  }

  // ── Ficha + pedido ────────────────────────────────────────────────────────
  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
      {/* Producto */}
      <div>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-linea)] bg-[var(--color-superficie)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tienda/camiseta.jpg"
            alt={s.producto.alt}
            width={1200}
            height={900}
            className="w-full"
            loading="lazy"
          />
        </div>
        <div className="mt-6 flex items-baseline justify-between gap-4">
          <h3 className="font-[family-name:var(--ff-display)] text-2xl font-bold">{s.producto.nombre}</h3>
          <p className={`${MONO} text-2xl font-semibold tabular-nums`}>{eur(CAMISETA.precio, lang)}</p>
        </div>
        <p className="mt-2 text-sm text-[var(--color-tinta-suave)]">{s.producto.desc}</p>

        {/* Desglose 5/5 */}
        <div className="mt-5 rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-4">
          <p className={LABEL}>{s.desglose}</p>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
            <span className="bg-[var(--color-tinta-suave)]" style={{ width: `${100 - pctCaja}%` }} />
            <span className="bg-[var(--color-acento)]" style={{ width: `${pctCaja}%` }} />
          </div>
          <dl className="mt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="flex items-center gap-2 text-xs text-[var(--color-tinta-suave)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-tinta-suave)]" />
                {s.costeLabel}
              </dt>
              <dd className={`${MONO} text-sm tabular-nums text-[var(--color-tinta-suave)]`}>
                {eur(CAMISETA.precio - CAMISETA.aLaCaja, lang)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="flex items-center gap-2 text-xs font-semibold text-[var(--color-acento-tinta-fuerte)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-acento)]" />
                {s.cajaLabel}
              </dt>
              <dd className={`${MONO} text-sm font-semibold tabular-nums text-[var(--color-acento-tinta-fuerte)]`}>
                {eur(CAMISETA.aLaCaja, lang)}
              </dd>
            </div>
          </dl>
          <p className={`mt-3 ${MONO} text-[10px] uppercase tracking-wider text-[var(--color-acento-tinta-fuerte)]`}>
            {s.porcentaje.replace("{pct}", String(pctCaja))}
          </p>
        </div>

        <details className="group mt-4">
          <summary className={`cursor-pointer list-none ${MONO} text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)] underline underline-offset-4 [&::-webkit-details-marker]:hidden`}>
            {s.guiaTallas}
          </summary>
          <figure className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tienda/guia-tallas.jpg"
              alt={s.guiaAlt}
              width={1080}
              height={810}
              className="w-full rounded-lg border border-[var(--color-linea)]"
              loading="lazy"
            />
            <figcaption className={`mt-2 ${MONO} text-[10px] leading-relaxed text-[var(--color-tinta-suave)]`}>
              {s.guiaNota}
            </figcaption>
          </figure>
        </details>
      </div>

      {/* Pedido */}
      <form onSubmit={enviar} className="rounded-2xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6 md:p-8">
        <fieldset>
          <legend className={LABEL}>{s.tallaLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CAMISETA.tallas.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={talla === t}
                onClick={() => setTalla(t)}
                className={`min-w-12 rounded-md border px-3 py-2 ${MONO} text-xs transition-colors ${
                  talla === t
                    ? "border-[var(--color-tinta)] bg-[var(--color-tinta)] text-[var(--color-fondo)]"
                    : "border-[var(--color-linea)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-end gap-6">
          <fieldset>
            <legend className={LABEL}>{s.cantidadLabel}</legend>
            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="grid h-11 w-11 place-items-center rounded-md border border-[var(--color-linea)] text-lg hover:border-[var(--color-tinta)]"
                aria-label={s.cantidadMenos}
              >
                −
              </button>
              <span
                className={`w-10 text-center ${MONO} text-lg tabular-nums`}
                aria-live="polite"
                aria-label={`${s.cantidadLabel}: ${cantidad}`}
              >
                {cantidad}
              </span>
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.min(MAX_UNIDADES, c + 1))}
                className="grid h-11 w-11 place-items-center rounded-md border border-[var(--color-linea)] text-lg hover:border-[var(--color-tinta)]"
                aria-label={s.cantidadMas}
              >
                +
              </button>
            </div>
          </fieldset>
        </div>

        <fieldset className="mt-6">
          <legend className={LABEL}>{s.donacionLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DONACIONES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={donacion === d}
                onClick={() => setDonacion(d)}
                className={`rounded-full border px-3 py-1.5 ${MONO} text-xs transition-colors ${
                  donacion === d
                    ? "border-[var(--color-acento)] bg-[var(--color-acento)] text-white"
                    : "border-[var(--color-linea)] text-[var(--color-tinta)] hover:border-[var(--color-acento)]"
                }`}
              >
                {d === 0 ? s.sinDonacion : `+${eur(d, lang)}`}
              </button>
            ))}
          </div>
          <p className={`mt-2 ${MONO} text-[10px] leading-relaxed text-[var(--color-tinta-suave)]`}>{s.donacionNota}</p>
        </fieldset>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>{s.nombreLabel}</span>
            <input
              required
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2 text-sm outline-none focus:border-[var(--color-tinta)]"
            />
          </label>
          <label className="block">
            <span className={LABEL}>{s.emailLabel}</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2 text-sm outline-none focus:border-[var(--color-tinta)]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>{s.siteLabel}</span>
            <select
              required
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2 text-sm outline-none focus:border-[var(--color-tinta)]"
            >
              <option value="" disabled>
                {s.sitePlaceholder}
              </option>
              {SITES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-baseline justify-between border-t border-[var(--color-linea)] pt-4">
          <span className={LABEL}>{s.totalLabel}</span>
          <span
            className={`${MONO} text-2xl font-semibold tabular-nums`}
            aria-live="polite"
            aria-label={`${s.totalLabel}: ${eur(total, lang)}`}
          >
            {eur(total, lang)}
          </span>
        </div>

        {error ? (
          <p role="alert" className={`mt-4 ${MONO} text-xs text-[var(--color-acento-tinta-fuerte)]`}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enviando}
          className="mt-5 w-full rounded-full bg-[var(--color-acento)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)] disabled:opacity-50"
        >
          {enviando ? s.enviando : s.confirmar}
        </button>

        <p className={`mt-4 ${MONO} text-[10px] leading-relaxed text-[var(--color-tinta-suave)]`}>{s.legalNota}</p>
        <p className={`mt-2 ${MONO} text-[10px] leading-relaxed text-[var(--color-tinta-suave)]`}>{s.entrega}</p>
      </form>
    </div>
  );
}
