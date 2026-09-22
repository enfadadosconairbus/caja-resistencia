import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { verificarAccess, CABECERA_ACCESS } from "@/lib/access";
import type { EstadoPedido } from "@/config/pedidos";

// Datos en vivo desde D1: nunca cacheado, nunca prerenderizado.
export const dynamic = "force-dynamic";

type FilaPedido = {
  referencia: string;
  creado: string;
  nombre: string;
  email: string;
  site: string | null;
  lineas: string;
  unidades: number;
  donacion: number;
  total: number;
  estado: EstadoPedido;
};

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const fecha = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function resumenLineas(json: string): string {
  try {
    const arr = JSON.parse(json) as { talla: string; cantidad: number }[];
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    return arr.map((l) => `${l.talla}×${l.cantidad}`).join(", ");
  } catch {
    return "—";
  }
}

const BADGE: Record<EstadoPedido, string> = {
  pendiente: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  pagado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  anulado: "bg-neutral-200 text-neutral-600 line-through dark:bg-neutral-800 dark:text-neutral-400",
};

const ETIQUETA: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  anulado: "Anulado",
};

/** Botón que cambia el estado de un pedido (form POST → /panel/accion → redirige de vuelta). */
function AccionEstado({ referencia, estado, texto }: { referencia: string; estado: EstadoPedido; texto: string }) {
  return (
    <form action="/panel/accion" method="post" className="inline">
      <input type="hidden" name="referencia" value={referencia} />
      <input type="hidden" name="estado" value={estado} />
      <button
        type="submit"
        className="rounded-md border border-[var(--color-borde,#d4d4d4)] px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]"
      >
        {texto}
      </button>
    </form>
  );
}

export default async function PanelPagina() {
  const h = await headers();
  const identidad = await verificarAccess(h.get(CABECERA_ACCESS));

  if (!identidad) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-[family-name:var(--ff-display)] text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-3 text-[var(--color-tinta-suave)]">
          Este panel es solo para Tesorería. Entra a través de Cloudflare Access con la cuenta autorizada.
        </p>
      </main>
    );
  }

  const { results } = await env.PEDIDOS_DB.prepare(
    `SELECT referencia, creado, nombre, email, site, lineas, unidades, donacion, total, estado
     FROM pedidos ORDER BY creado DESC`,
  ).all<FilaPedido>();
  const pedidos = results ?? [];

  const pendientes = pedidos.filter((p) => p.estado === "pendiente");
  const pagados = pedidos.filter((p) => p.estado === "pagado");
  const totalPagado = pagados.reduce((a, p) => a + p.total, 0);
  const totalPendiente = pendientes.reduce((a, p) => a + p.total, 0);
  const unidadesPagadas = pagados.reduce((a, p) => a + p.unidades, 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-borde,#e5e5e5)] pb-6">
        <div>
          <p className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-widest text-[var(--color-tinta-suave)]">
            Caja de resistencia · Tesorería
          </p>
          <h1 className="mt-1 font-[family-name:var(--ff-display)] text-3xl font-extrabold">Pedidos de merchandising</h1>
          <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
            Sesión: <span className="font-[family-name:var(--ff-mono)]">{identidad.email || "autenticado"}</span>
          </p>
        </div>
        <a
          href="/panel/export"
          className="rounded-lg bg-[var(--color-tinta)] px-4 py-2 text-sm font-semibold text-[var(--color-fondo)] transition-opacity hover:opacity-90"
        >
          Exportar CSV
        </a>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica etiqueta="Pedidos" valor={String(pedidos.length)} />
        <Metrica etiqueta="Pendientes" valor={`${pendientes.length} · ${eur.format(totalPendiente)}`} />
        <Metrica etiqueta="Confirmado (pagado)" valor={eur.format(totalPagado)} acento />
        <Metrica etiqueta="Camisetas pagadas" valor={String(unidadesPagadas)} />
      </section>

      {pedidos.length === 0 ? (
        <p className="mt-16 text-center text-[var(--color-tinta-suave)]">Aún no hay pedidos registrados.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-borde,#e5e5e5)] text-left font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]">
                <th className="py-2 pr-3">Referencia</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Camisetas</th>
                <th className="py-2 pr-3 text-right">Donación</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.referencia} className="border-b border-[var(--color-borde,#efefef)] align-top">
                  <td className="py-3 pr-3 font-[family-name:var(--ff-mono)] font-semibold">{p.referencia}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-[var(--color-tinta-suave)]">
                    {fecha.format(new Date(p.creado))}
                  </td>
                  <td className="py-3 pr-3">
                    <div>{p.nombre}</div>
                    <a href={`mailto:${p.email}`} className="text-xs text-[var(--color-tinta-suave)] underline">
                      {p.email}
                    </a>
                  </td>
                  <td className="py-3 pr-3">{p.site ?? "—"}</td>
                  <td className="py-3 pr-3 font-[family-name:var(--ff-mono)]">{resumenLineas(p.lineas)}</td>
                  <td className="py-3 pr-3 text-right">{p.donacion ? eur.format(p.donacion) : "—"}</td>
                  <td className="py-3 pr-3 text-right font-semibold">{eur.format(p.total)}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[p.estado]}`}>
                      {ETIQUETA[p.estado]}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {p.estado !== "pagado" && <AccionEstado referencia={p.referencia} estado="pagado" texto="Marcar pagado" />}
                      {p.estado !== "pendiente" && <AccionEstado referencia={p.referencia} estado="pendiente" texto="Pendiente" />}
                      {p.estado !== "anulado" && <AccionEstado referencia={p.referencia} estado="anulado" texto="Anular" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Metrica({ etiqueta, valor, acento }: { etiqueta: string; valor: string; acento?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-borde,#e5e5e5)] p-4">
      <div className="font-[family-name:var(--ff-mono)] text-xs uppercase tracking-wider text-[var(--color-tinta-suave)]">
        {etiqueta}
      </div>
      <div
        className={`mt-1 text-xl font-bold ${acento ? "text-[var(--color-acento-tinta,var(--color-acento))]" : ""}`}
      >
        {valor}
      </div>
    </div>
  );
}
