export type MockStrings = {
  kicker: string;
  title: string;
  aviso: string;
  pagarCon: string;
  oTarjeta: string;
  numero: string;
  caducidad: string;
  cvc: string;
  titular: string;
  boton: string;
  seguro: string;
};

/**
 * Mock-up de la pasarela: cómo se vería el pago cuando exista.
 *
 * ⚠️ DECISIÓN DELIBERADA: aquí NO hay ni un solo <input>, ni <form>, ni handler. Los
 * "campos" son <div> con texto de ejemplo. Un checkout realista en una web que no puede
 * cobrar es un cebo perfecto para que alguien teclee su tarjeta; que sea físicamente
 * imposible vale más que un aviso. El aviso está igualmente, y `aria-hidden` mantiene
 * el teatro fuera del lector de pantalla: lo que se anuncia es que es una simulación.
 */
function Campo({ label, valor, className = "" }: { label: string; valor: string; className?: string }) {
  return (
    <div className={className}>
      <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {label}
      </p>
      <div className="mt-1.5 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2.5 font-[family-name:var(--ff-mono)] text-sm text-[var(--color-tinta-suave)]">
        {valor}
      </div>
    </div>
  );
}

export function PasarelaMock({ s, importe }: { s: MockStrings; importe: string }) {
  return (
    <figure className="mt-10">
      <figcaption className="mb-4">
        <p className="kicker !mb-0">{s.kicker}</p>
        <p className="mt-2 font-[family-name:var(--ff-display)] text-xl font-bold text-[var(--color-tinta)]">
          {s.title}
        </p>
        <p className="mt-3 max-w-2xl rounded-lg border border-dashed border-[var(--color-acento-tinta)] bg-[color-mix(in_srgb,var(--color-acento)_6%,transparent)] px-4 py-3 font-[family-name:var(--ff-mono)] text-xs leading-relaxed text-[var(--color-acento-tinta-fuerte)]">
          {s.aviso}
        </p>
      </figcaption>

      {/* Teatro puro: sin inputs, sin form, sin handlers. Inerte por construcción. */}
      <div
        aria-hidden="true"
        className="mx-auto max-w-sm select-none rounded-2xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6 shadow-[0_12px_40px_var(--sombra-sutil)]"
      >
        <p className="text-center font-[family-name:var(--ff-display)] text-3xl font-extrabold text-[var(--color-tinta)]">
          {importe}
        </p>

        <p className="mt-6 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
          {s.pagarCon}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Apple Pay", "G Pay", "PayPal"].map((m) => (
            <div
              key={m}
              className="rounded-lg border border-[var(--color-tinta)] bg-[var(--color-tinta)] px-2 py-2.5 text-center text-xs font-semibold text-[var(--color-fondo)]"
            >
              {m}
            </div>
          ))}
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--color-linea)]" />
          <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {s.oTarjeta}
          </span>
          <span className="h-px flex-1 bg-[var(--color-linea)]" />
        </div>

        <div className="space-y-3">
          <Campo label={s.numero} valor="•••• •••• •••• 4242" />
          <div className="grid grid-cols-2 gap-3">
            <Campo label={s.caducidad} valor="09 / 29" />
            <Campo label={s.cvc} valor="•••" />
          </div>
          <Campo label={s.titular} valor="—" />
        </div>

        <div className="mt-5 rounded-full bg-[var(--color-acento)] px-6 py-3.5 text-center font-semibold text-white">
          {s.boton.replace("{importe}", importe)}
        </div>
        <p className="mt-3 text-center font-[family-name:var(--ff-mono)] text-[10px] text-[var(--color-tinta-suave)]">
          {s.seguro}
        </p>
      </div>
    </figure>
  );
}
