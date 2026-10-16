"use client";
import * as React from "react";
import { APORTACION_ONLINE, FONDO, pasarelaActiva, type MetodoPago } from "@/config/fondo";
import { COMISION_STRIPE } from "@/config/pedidos";
import { Copiar } from "./copiar";

export type CanalesStrings = {
  transferencia: {
    t: string;
    d: string;
    labelTitular: string;
    labelBanco: string;
    labelIban: string;
    labelBic: string;
    labelConcepto: string;
    copiar: string;
    copiado: string;
    pendiente: string;
    /** Rótulo del grupo de importes sugeridos. */
    importeLabel: string;
    /** Rótulo accesible del campo de cantidad libre. */
    otra: string;
    /** Resumen bajo la escalera. `{importe}` se sustituye. */
    importeResumen: string;
    /** Lo que se lee cuando no hay importe elegido. */
    importeSinElegir: string;
    copiarConcepto: string;
    conceptoCopiado: string;
  };
  pasarela: {
    t: string;
    d: string;
    importeLabel: string;
    otra: string;
    /** `{importe}` se sustituye. */
    resumen: string;
    sinElegir: string;
    /** `{importe}` se sustituye. */
    cta: string;
    ctaSinImporte: string;
    enviando: string;
    metodosNota: string;
    /** Se añade a `metodosNota` mientras `FONDO.pasarela.bizumActivo` sea false. */
    bizumPausa: string;
    /** Solo para lectores de pantalla, tras el nombre del método apagado. */
    metodoPausado: string;
    /** `{tarifa}` se sustituye (1,25 % + 0,25 €). */
    comision: string;
    /** `{min}` y `{max}` se sustituyen. */
    limites: string;
    error: string;
    pendiente: string;
    ok: string;
    cancelado: string;
  };
  metodos: Record<MetodoPago, string>;
};

const CARD =
  "rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6 flex flex-col";

/** Escalón de importes sugeridos. El mismo en la transferencia y en el pago online. */
const IMPORTES = [20, 50, 100];

function Pendiente({ texto }: { texto: string }) {
  return (
    <p className="mt-auto rounded-lg border border-dashed border-[var(--color-linea)] bg-[var(--color-superficie)] px-4 py-3 font-[family-name:var(--ff-mono)] text-xs leading-relaxed text-[var(--color-tinta-suave)]">
      {texto}
    </p>
  );
}

function Fila({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-linea)] py-2 last:border-0">
      <dt className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {k}
      </dt>
      <dd
        className={
          mono
            ? "font-[family-name:var(--ff-mono)] text-sm tabular-nums text-[var(--color-tinta)]"
            : "text-sm text-[var(--color-tinta)]"
        }
      >
        {v}
      </dd>
    </div>
  );
}

/**
 * Escalera de importes sugeridos, en la tarjeta de TRANSFERENCIA.
 *
 * Sugerir importes es lo que sube la aportación media, así que la transferencia también
 * los tiene, aunque aquí no puedan viajar al banco.
 *
 * Lo que esta escalera NO hace, y conviene tenerlo claro: no puede rellenar la app del
 * banco. Nadie puede. Su trabajo es el ancla —ver 20/50/100 mueve la cifra que la gente
 * teclea— y dejar a mano lo que hay que copiar. Por eso no inventa un concepto con el
 * importe dentro: el importe ya viaja en la transferencia, y ensuciar el concepto le
 * complicaría la conciliación a Tesorería en vez de facilitársela.
 */
function EscaleraImportes({
  s,
  lang,
  concepto,
}: {
  s: CanalesStrings["transferencia"];
  lang: string;
  concepto: string | null;
}) {
  const [importe, setImporte] = React.useState<number | null>(null);
  const [otra, setOtra] = React.useState("");

  const eur = (v: number) =>
    new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);

  const valor = importe ?? (otra ? Number(otra.replace(",", ".")) : NaN);
  const valido = Number.isFinite(valor) && valor > 0;

  const chip = (activo: boolean) =>
    `rounded-full border px-4 py-2 font-[family-name:var(--ff-mono)] text-sm transition-colors ${
      activo
        ? "border-[var(--color-acento-tinta)] bg-[var(--color-acento)] text-white"
        : "border-[var(--color-linea)] bg-[var(--color-fondo)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
    }`;

  return (
    <div className="mb-5">
      <fieldset>
        <legend className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {s.importeLabel}
        </legend>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {IMPORTES.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={importe === v}
              onClick={() => {
                setImporte(v);
                setOtra("");
              }}
              className={chip(importe === v)}
            >
              {eur(v)}
            </button>
          ))}
          <label className={`flex items-center gap-2 ${chip(importe === null && valido)}`}>
            <span className="sr-only">{s.otra}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={otra}
              placeholder={s.otra}
              /* Ni `onFocus` que deseleccione ni `outline-none`: las dos cosas se
                 arreglaron en el selector de tarjeta el 26-sep-2026 y no se reintroducen
                 aquí. Tabular hasta este campo no puede borrarle el importe a nadie. */
              onChange={(e) => {
                setImporte(null);
                setOtra(e.target.value);
              }}
              className="w-16 bg-transparent font-[family-name:var(--ff-mono)] text-sm placeholder:text-[var(--color-tinta-suave)]"
            />
            <span aria-hidden="true">€</span>
          </label>
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 text-sm text-[var(--color-tinta-suave)]">
        {valido
          ? s.importeResumen.replace("{importe}", eur(valor)).replace("{concepto}", concepto ?? "")
          : s.importeSinElegir}
      </p>
    </div>
  );
}

export function AportarCanales({ s, lang }: { s: CanalesStrings; lang: string }) {
  const { titular, banco, iban, bic, concepto } = FONDO.cuenta;
  // Narrowing local: sin IBAN y sin titular no hay nada que publicar, y no se rellena.
  const transferencia = iban && titular ? { iban, titular, banco, bic, concepto } : null;
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      {/* La vía online va primero: es la más rápida y admite casi cualquier método. */}
      <PagoOnline s={s.pasarela} metodos={s.metodos} lang={lang} />
      <section className={CARD}>
        <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-confianza-tinta)]">
          {s.transferencia.t}
        </h3>
        <p className="mb-5 mt-2 text-sm text-[var(--color-tinta-suave)]">{s.transferencia.d}</p>

        {transferencia ? (
          <>
            <EscaleraImportes
              s={s.transferencia}
              lang={lang}
              concepto={transferencia.concepto}
            />
            <dl className="mb-5">
              <Fila k={s.transferencia.labelTitular} v={transferencia.titular} />
              {transferencia.banco ? (
                <Fila k={s.transferencia.labelBanco} v={transferencia.banco} />
              ) : null}
              <Fila k={s.transferencia.labelIban} v={transferencia.iban} mono />
              {transferencia.bic ? (
                <Fila k={s.transferencia.labelBic} v={transferencia.bic} mono />
              ) : null}
              {transferencia.concepto ? (
                <Fila k={s.transferencia.labelConcepto} v={transferencia.concepto} />
              ) : null}
            </dl>
            <div className="mt-auto flex flex-wrap gap-2">
              <Copiar
                valor={transferencia.iban}
                label={s.transferencia.copiar}
                hecho={s.transferencia.copiado}
              />
              {/* El concepto se copia aparte: es el segundo campo que hay que teclear en
                  la app del banco, y es lo que permite a Tesorería reconocer el ingreso. */}
              {transferencia.concepto ? (
                <Copiar
                  valor={transferencia.concepto}
                  label={s.transferencia.copiarConcepto}
                  hecho={s.transferencia.conceptoCopiado}
                />
              ) : null}
            </div>
          </>
        ) : (
          <Pendiente texto={s.transferencia.pendiente} />
        )}
      </section>

    </div>
  );
}

/**
 * PAGO ONLINE (Stripe). Se elige el importe aquí y se paga en la página alojada de Stripe,
 * que muestra los métodos activados en la cuenta y admitidos para una donación (tarjeta,
 * Apple Pay, Google Pay, Bizum…). La web nunca ve datos de tarjeta ni decide el cobro: manda
 * el importe a `/api/donacion`, que lo valida y crea la sesión.
 *
 * La vuelta de Stripe trae `?aporte=ok` o `?aporte=cancelado`; se lee en el cliente para no
 * volver dinámica toda la página de La caja por un aviso.
 */
function PagoOnline({
  s,
  metodos,
  lang,
}: {
  s: CanalesStrings["pasarela"];
  metodos: CanalesStrings["metodos"];
  lang: string;
}) {
  const [importe, setImporte] = React.useState<number | null>(50);
  const [otra, setOtra] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // En el servidor no hay URL que leer (null); en el cliente, la de la vuelta de Stripe.
  const vuelta = React.useSyncExternalStore(
    () => () => {},
    () => {
      const v = new URLSearchParams(window.location.search).get("aporte");
      return v === "ok" || v === "cancelado" ? v : null;
    },
    () => null,
  );

  const eur = (v: number, decimales = false) =>
    new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimales && !Number.isInteger(v) ? 2 : 0,
      maximumFractionDigits: decimales ? 2 : 0,
    }).format(v);

  const valor = importe ?? (otra ? Number(otra.replace(",", ".")) : NaN);
  const valido =
    Number.isFinite(valor) && valor >= APORTACION_ONLINE.min && valor <= APORTACION_ONLINE.max;
  const fuera = Number.isFinite(valor) && valor > 0 && !valido;
  const porcentaje = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 2 });
  const tarifa = `${porcentaje.format(COMISION_STRIPE.pct)} + ${eur(COMISION_STRIPE.fijo, true)}`;

  const chip = (activo: boolean) =>
    `rounded-full border px-4 py-2 font-[family-name:var(--ff-mono)] text-sm transition-colors ${
      activo
        ? "border-[var(--color-acento-tinta)] bg-[var(--color-acento)] text-white"
        : "border-[var(--color-linea)] bg-[var(--color-fondo)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
    }`;

  async function aportar() {
    if (!valido || !FONDO.pasarela.checkoutUrl) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch(FONDO.pasarela.checkoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importe: Math.round(valor * 100) / 100, lang }),
      });
      const data = (await r.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(s.error);
    } catch {
      setError(s.error);
    }
    setEnviando(false);
  }

  return (
    <section className={CARD}>
      <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-confianza-tinta)]">
        {s.t}
      </h3>
      <p className="mb-5 mt-2 text-sm text-[var(--color-tinta-suave)]">{s.d}</p>

      {vuelta ? (
        <p
          role="status"
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            vuelta === "ok"
              ? "border-[var(--color-senal)] bg-[color-mix(in_srgb,var(--color-senal)_10%,transparent)] text-[var(--color-tinta)]"
              : "border-[var(--color-linea)] bg-[var(--color-fondo)] text-[var(--color-tinta-suave)]"
          }`}
        >
          {vuelta === "ok" ? s.ok : s.cancelado}
        </p>
      ) : null}

      <ul className="mb-2 flex flex-wrap gap-2">
        {FONDO.pasarela.metodos.map((m) => {
          // Bizum entre campañas: se queda a la vista, apagado, para que quien lo busque
          // lea justo debajo por qué no está (quitarlo sin más parecería un fallo).
          const pausado = m === "bizum" && !FONDO.pasarela.bizumActivo;
          return (
            <li
              key={m}
              className={`rounded-full border bg-[var(--color-fondo)] px-3 py-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider ${
                pausado
                  ? "border-dashed border-[var(--color-linea)] text-[var(--color-tinta-suave)]"
                  : "border-[var(--color-linea)] text-[var(--color-tinta)]"
              }`}
            >
              {metodos[m]}
              {pausado ? <span className="sr-only"> ({s.metodoPausado})</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="mb-5 text-xs text-[var(--color-tinta-suave)]">
        {s.metodosNota}
        {FONDO.pasarela.bizumActivo ? null : <> {s.bizumPausa}</>}
      </p>

      {pasarelaActiva ? (
        <>
          <fieldset>
            <legend className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
              {s.importeLabel}
            </legend>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {IMPORTES.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={importe === v}
                  onClick={() => {
                    setImporte(v);
                    setOtra("");
                  }}
                  className={chip(importe === v)}
                >
                  {eur(v)}
                </button>
              ))}
              <label className={`flex items-center gap-2 ${chip(importe === null && valido)}`}>
                <span className="sr-only">{s.otra}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={APORTACION_ONLINE.min}
                  max={APORTACION_ONLINE.max}
                  step="0.01"
                  value={otra}
                  placeholder={s.otra}
                  /* Igual que en la transferencia: ni `onFocus` que deseleccione ni
                     `outline-none` (arreglos del 26-sep-2026). */
                  onChange={(e) => {
                    setImporte(null);
                    setOtra(e.target.value);
                  }}
                  className="w-16 bg-transparent font-[family-name:var(--ff-mono)] text-sm placeholder:text-[var(--color-tinta-suave)]"
                />
                <span aria-hidden="true">€</span>
              </label>
            </div>
          </fieldset>

          <p aria-live="polite" className="mt-3 text-sm text-[var(--color-tinta-suave)]">
            {valido
              ? s.resumen.replace("{importe}", eur(valor, true))
              : fuera
                ? s.limites
                    .replace("{min}", eur(APORTACION_ONLINE.min))
                    .replace("{max}", eur(APORTACION_ONLINE.max))
                : s.sinElegir}
          </p>

          <div className="mt-auto pt-5">
            <button
              type="button"
              onClick={aportar}
              disabled={!valido || enviando}
              className="inline-block rounded-full bg-[var(--color-acento)] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {enviando
                ? s.enviando
                : valido
                  ? s.cta.replace("{importe}", eur(valor, true))
                  : s.ctaSinImporte}
            </button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-[var(--color-acento-tinta-fuerte)]">
                {error}
              </p>
            ) : null}
            <p className="mt-4 text-xs text-[var(--color-tinta-suave)]">
              {s.comision.replace("{tarifa}", tarifa)}
            </p>
          </div>
        </>
      ) : (
        <Pendiente texto={s.pendiente} />
      )}
    </section>
  );
}
