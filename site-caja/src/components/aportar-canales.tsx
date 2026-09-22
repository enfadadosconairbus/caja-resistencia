import { FONDO, type MetodoPago } from "@/config/fondo";
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
  };
  pasarela: {
    t: string;
    d: string;
    cta: string;
    pendiente: string;
  };
  metodos: Record<MetodoPago, string>;
};

const CARD =
  "rounded-xl border border-[var(--color-linea)] bg-[var(--color-fondo)] p-6 flex flex-col";

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

export function AportarCanales({ s }: { s: CanalesStrings }) {
  const { titular, banco, iban, bic, concepto } = FONDO.cuenta;
  const { proveedor, metodos, checkoutUrl } = FONDO.pasarela;

  // Narrowing local: sin IBAN y sin titular no hay nada que publicar, y no se rellena.
  const transferencia = iban && titular ? { iban, titular, banco, bic, concepto } : null;
  const pasarela =
    FONDO.pasarela.estado === "activa" && checkoutUrl && FONDO.titular.cif
      ? { checkoutUrl, proveedor, metodos }
      : null;

  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <section className={CARD}>
        <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-confianza-tinta)]">
          {s.transferencia.t}
        </h3>
        <p className="mb-5 mt-2 text-sm text-[var(--color-tinta-suave)]">{s.transferencia.d}</p>

        {transferencia ? (
          <>
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
            <div className="mt-auto">
              <Copiar
                valor={transferencia.iban}
                label={s.transferencia.copiar}
                hecho={s.transferencia.copiado}
              />
            </div>
          </>
        ) : (
          <Pendiente texto={s.transferencia.pendiente} />
        )}
      </section>

      <section className={CARD}>
        <h3 className="font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-confianza-tinta)]">
          {s.pasarela.t}
        </h3>
        <p className="mb-5 mt-2 text-sm text-[var(--color-tinta-suave)]">{s.pasarela.d}</p>

        <ul className="mb-5 flex flex-wrap gap-2">
          {(["tarjeta", "apple-pay", "google-pay", "paypal"] as MetodoPago[]).map((m) => {
            const vivo = pasarela?.metodos.includes(m) ?? false;
            return (
              <li
                key={m}
                className={
                  vivo
                    ? "rounded-full border border-[var(--color-linea)] bg-[var(--color-superficie)] px-3 py-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta)]"
                    : "rounded-full border border-dashed border-[var(--color-linea)] px-3 py-1.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]"
                }
              >
                {s.metodos[m]}
              </li>
            );
          })}
        </ul>

        {pasarela ? (
          <div className="mt-auto">
            <a
              href={pasarela.checkoutUrl}
              className="inline-block rounded-full bg-[var(--color-acento)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)]"
            >
              {s.pasarela.cta}
            </a>
          </div>
        ) : (
          <Pendiente texto={s.pasarela.pendiente} />
        )}
      </section>
    </div>
  );
}
