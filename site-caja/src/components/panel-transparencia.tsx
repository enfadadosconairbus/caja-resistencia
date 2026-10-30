"use client";
import * as React from "react";

/**
 * Panel de transparencia de /la-caja: el dinero de la caja como un informe interactivo.
 *
 * Una fila de filtros (campaña, tipo de gasto, periodo) gobierna TODO lo de debajo: las
 * tarjetas, los cuatro gráficos y la tabla de movimientos, así que las cifras siempre
 * cuadran entre sí. Los gráficos además filtran a los demás («cross-filter»): arrastrar sobre
 * la evolución elige un periodo, pulsar un concepto filtra por su tipo y pulsar un día lo
 * aísla.
 *
 * SVG a mano, sin librería de gráficos: son cuatro gráficos sencillos y una librería
 * pesaría más que toda la página. Se pinta también en el servidor (con un ancho por
 * defecto), así que sin JavaScript se leen las cifras, los gráficos y la tabla.
 *
 * Colores (validados con el validador de dataviz contra la tarjeta clara #fff y la oscura
 * #1a3050): entra = azul, sale = naranja, saldo = verde agua. Un gasto es siempre naranja, sea
 * del concepto que sea: el concepto lo dice la etiqueta, no el color.
 *
 * Privacidad: la recaudación llega AGREGADA por día (`config/recaudacion.json`), sin nombres.
 * Aun así, el número de aportaciones de un día solo se enseña si son 5 o más.
 */

export type TipoGasto = "material" | "desplazamientos" | "infraestructura" | "comisiones";

export type DiaRecaudacion = { fecha: string; importe: number; aportaciones: number; via: string };
export type Movimiento = { fecha: string; importe: number; campana: string; concepto: string; tipo: TipoGasto };

export type TextosPanel = {
  filtros: string;
  campana: string;
  todasCampanas: string;
  tipo: string;
  periodo: string;
  todo: string;
  restablecer: string;
  corte: string;
  kpi: {
    recaudado: string;
    gastado: string;
    saldo: string;
    saldoCierre: string;
    aportaciones: string;
    media: string;
    pctGastado: string;
    notaCampana: string;
  };
  evolucion: { titulo: string; sub: string; recaudado: string; gastos: string; saldo: string; elegido: string };
  conceptos: { titulo: string; sub: string };
  cascada: { titulo: string; sub: string; recaudado: string; saldo: string; neto: string };
  diario: { titulo: string; sub: string; aportaciones: string; pocas: string; otros: string };
  tabla: {
    titulo: string;
    fecha: string;
    concepto: string;
    tipo: string;
    campana: string;
    importe: string;
    total: string;
    vacio: string;
    csv: string;
    sub: string;
    ultimoPago: string;
    pagos: string;
    unPago: string;
    verPagos: string;
    verDiario: string;
    dia: string;
    recaudado: string;
    nAport: string;
  };
  tipos: Record<TipoGasto, string>;
};

const TIPOS: TipoGasto[] = ["material", "desplazamientos", "infraestructura", "comisiones"];
const MIN_APORT_VISIBLE = 5;

/* ───────────────────────────── utilidades ───────────────────────────── */

const DIA_MS = 86_400_000;
const aFecha = (iso: string) => new Date(`${iso}T12:00:00Z`);
const sumarDias = (iso: string, n: number) => new Date(aFecha(iso).getTime() + n * DIA_MS).toISOString().slice(0, 10);
const cent = (v: number) => Math.round(v * 100) / 100;

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
}

/** Una semana de lunes a domingo, recortada al eje (`desde`–`hasta`). */
type Semana = { lunes: string; desde: string; hasta: string };

/** Las semanas (lunes a domingo) que cubren el eje, recortadas a su primer y último día. */
function semanasDe(ejeDias: string[]): Semana[] {
  const out: Semana[] = [];
  for (const d of ejeDias) {
    const lunes = sumarDias(d, -((aFecha(d).getUTCDay() + 6) % 7));
    const ultima = out[out.length - 1];
    if (ultima?.lunes === lunes) ultima.hasta = d;
    else out.push({ lunes, desde: d, hasta: d });
  }
  return out;
}

type TotalSemana = Semana & { total: number; n: number; otros: number };

/** Suma la recaudación de cada semana. Las aportaciones solo cuentan las transferencias. */
function porSemana(semanas: Semana[], dias: DiaRecaudacion[]): TotalSemana[] {
  return semanas.map((s) => {
    const del = dias.filter((x) => x.fecha >= s.desde && x.fecha <= s.hasta);
    return {
      ...s,
      total: cent(del.reduce((a, x) => a + x.importe, 0)),
      n: del.filter((x) => x.via === "transferencia").reduce((a, x) => a + x.aportaciones, 0),
      otros: cent(del.filter((x) => x.via !== "transferencia").reduce((a, x) => a + x.importe, 0)),
    };
  });
}

/** Ticks redondos para un eje que empieza en 0. */
function ticks(max: number, n = 4): number[] {
  if (max <= 0) return [0];
  const bruto = max / n;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const out: number[] = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + paso);
  return out;
}

/** Parte un texto en, como mucho, `maxLineas` líneas de unos `porLinea` caracteres. */
function partir(texto: string, porLinea: number, maxLineas = 2): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (prueba.length > porLinea && actual) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const resto = lineas.slice(maxLineas - 1).join(" ");
    lineas.length = maxLineas - 1;
    lineas.push(resto.length > porLinea ? `${resto.slice(0, porLinea - 1)}…` : resto);
  }
  return lineas;
}

function useAncho<T extends HTMLElement>(inicial: number) {
  const ref = React.useRef<T>(null);
  const [ancho, setAncho] = React.useState(inicial);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

function useFormatos(lang: string) {
  return React.useMemo(() => {
    const eur = new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    const eur2 = new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const compacto = new Intl.NumberFormat(lang, {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 0,
    });
    const num = new Intl.NumberFormat(lang);
    const pct = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
    const corta = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" });
    const larga = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const mes = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" });
    return {
      eur: (v: number) => eur.format(v),
      eur2: (v: number) => eur2.format(v),
      compacto: (v: number) => compacto.format(v),
      num: (v: number) => num.format(v),
      pct: (v: number) => pct.format(v),
      corta: (iso: string) => corta.format(aFecha(iso)),
      larga: (iso: string) => larga.format(aFecha(iso)),
      mes: (iso: string) => mes.format(aFecha(iso)),
    };
  }, [lang]);
}

type Formatos = ReturnType<typeof useFormatos>;

/* ───────────────────────────── piezas comunes ───────────────────────────── */

type Tip = { x: number; y: number; filas: { color?: string; valor: string; etiqueta: string }[]; titulo: string } | null;

/** Un solo tooltip por gráfico. El texto va como texto (React lo escapa): nunca HTML. */
function Tooltip({ tip, ancho }: { tip: Tip; ancho: number }) {
  if (!tip) return null;
  const izquierda = tip.x > ancho - 190;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg border border-[var(--color-linea)] bg-[var(--color-superficie)] px-3 py-2 text-xs shadow-lg"
      style={{
        left: izquierda ? undefined : tip.x + 14,
        right: izquierda ? ancho - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 10),
      }}
    >
      <p className="mb-1 text-[var(--color-tinta-suave)]">{tip.titulo}</p>
      {tip.filas.map((f) => (
        <p key={f.etiqueta} className="flex items-center gap-2">
          {f.color ? <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: f.color }} /> : null}
          <strong className="font-[family-name:var(--ff-mono)] text-[var(--color-tinta)]">{f.valor}</strong>
          <span className="text-[var(--color-tinta-suave)]">{f.etiqueta}</span>
        </p>
      ))}
    </div>
  );
}

function Tarjeta({
  titulo,
  sub,
  children,
  className = "",
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={`rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-5 ${className}`}>
      <figcaption>
        <p className="text-sm font-semibold text-[var(--color-tinta)]">{titulo}</p>
        {sub ? <p className="mt-0.5 text-xs text-[var(--color-tinta-suave)]">{sub}</p> : null}
      </figcaption>
      <div className="mt-4">{children}</div>
    </figure>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        activo
          ? "border-[var(--color-tinta)] bg-[var(--color-tinta)] text-[var(--color-fondo)]"
          : "border-[var(--color-linea)] bg-[var(--color-superficie)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
      }`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────────── el panel ───────────────────────────── */

export function PanelTransparencia({
  lang,
  corte,
  dias,
  movimientos,
  campanas,
  conceptos,
  t,
}: {
  lang: string;
  /** Fecha del corte (ISO). Fin del eje temporal. */
  corte: string;
  dias: DiaRecaudacion[];
  movimientos: Movimiento[];
  campanas: { clave: string; nombre: string }[];
  /** Etiqueta de cada concepto (clave de gasto). */
  conceptos: Record<string, string>;
  t: TextosPanel;
}) {
  const f = useFormatos(lang);

  // Eje temporal: del día 1 del mes del primer movimiento hasta el corte.
  const primero = [...dias.map((d) => d.fecha), ...movimientos.map((m) => m.fecha)].sort()[0] ?? corte;
  const inicio = `${primero.slice(0, 7)}-01`;
  const ejeDias = React.useMemo(() => diasEntre(inicio, corte), [inicio, corte]);
  const semanas = React.useMemo(() => semanasDe(ejeDias), [ejeDias]);
  const meses = [...new Set(ejeDias.map((d) => d.slice(0, 7)))];

  const [campana, setCampana] = React.useState<string>("todas");
  const [tipos, setTipos] = React.useState<Set<TipoGasto>>(new Set());
  const [rango, setRango] = React.useState<{ desde: string; hasta: string } | null>(null);

  const desde = rango?.desde ?? inicio;
  const hasta = rango?.hasta ?? corte;
  const enRango = (iso: string) => iso >= desde && iso <= hasta;
  const pasaTipo = (tp: TipoGasto) => tipos.size === 0 || tipos.has(tp);
  const pasaCampana = (c: string) => campana === "todas" || c === campana;
  const hayFiltros = campana !== "todas" || tipos.size > 0 || rango !== null;

  const toggleTipo = (tp: TipoGasto) =>
    setTipos((prev) => {
      const s = new Set(prev);
      if (s.has(tp)) s.delete(tp);
      else s.add(tp);
      return s.size === TIPOS.length ? new Set() : s;
    });

  // ── cifras ──
  const movsFiltrados = movimientos.filter((m) => pasaCampana(m.campana) && pasaTipo(m.tipo) && enRango(m.fecha));
  const diasRango = dias.filter((d) => enRango(d.fecha));
  const recaudado = cent(diasRango.reduce((a, d) => a + d.importe, 0));
  const aportaciones = diasRango.filter((d) => d.via === "transferencia").reduce((a, d) => a + d.aportaciones, 0);
  const recTransf = diasRango.filter((d) => d.via === "transferencia").reduce((a, d) => a + d.importe, 0);
  const gastado = cent(movsFiltrados.reduce((a, m) => a + m.importe, 0));
  const recHasta = dias.filter((d) => d.fecha <= hasta).reduce((a, d) => a + d.importe, 0);
  const gasHasta = movimientos.filter((m) => m.fecha <= hasta).reduce((a, m) => a + m.importe, 0);
  const saldo = cent(recHasta - gasHasta);

  const nombreCampana = (c: string) => campanas.find((x) => x.clave === c)?.nombre ?? c;

  return (
    <div className="panel-viz mt-12">
      {/* ── FILTROS: una fila, encima de todo lo que filtran ── */}
      <div
        role="group"
        aria-label={t.filtros}
        className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-4"
      >
        <label className="flex flex-col gap-1 text-xs text-[var(--color-tinta-suave)]">
          {t.campana}
          <select
            value={campana}
            onChange={(e) => setCampana(e.target.value)}
            className="rounded-md border border-[var(--color-linea)] bg-[var(--color-fondo)] px-2 py-1.5 text-sm text-[var(--color-tinta)]"
          >
            <option value="todas">{t.todasCampanas}</option>
            {campanas.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-tinta-suave)]">{t.tipo}</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((tp) => (
              <Chip key={tp} activo={tipos.has(tp)} onClick={() => toggleTipo(tp)}>
                {t.tipos[tp]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-tinta-suave)]">{t.periodo}</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip activo={rango === null} onClick={() => setRango(null)}>
              {t.todo}
            </Chip>
            {meses.map((m) => {
              const d = `${m}-01`;
              const h = diasEntre(d, sumarDias(d, 31)).filter((x) => x.startsWith(m)).pop() ?? d;
              const r = { desde: d < inicio ? inicio : d, hasta: h > corte ? corte : h };
              const activo = rango?.desde === r.desde && rango?.hasta === r.hasta;
              return (
                <Chip key={m} activo={activo} onClick={() => setRango(activo ? null : r)}>
                  {f.mes(d)}
                </Chip>
              );
            })}
            {rango && !meses.some((m) => rango.desde.startsWith(m) && rango.desde.endsWith("-01")) ? (
              <Chip activo onClick={() => setRango(null)}>
                {f.corta(rango.desde)}
                {rango.hasta !== rango.desde ? ` – ${f.corta(rango.hasta)}` : ""} ✕
              </Chip>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">
            {t.corte.replace("{fecha}", f.larga(corte))}
          </span>
          {hayFiltros ? (
            <button
              type="button"
              onClick={() => {
                setCampana("todas");
                setTipos(new Set());
                setRango(null);
              }}
              className="text-xs text-[var(--color-acento-tinta)] underline underline-offset-4"
            >
              {t.restablecer}
            </button>
          ) : null}
        </div>
      </div>

      {/* ── TARJETAS ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi etiqueta={t.kpi.recaudado} valor={f.eur(recaudado)} color="var(--viz-entra)" />
        <Kpi
          etiqueta={t.kpi.gastado}
          valor={f.eur(gastado)}
          color="var(--viz-sale)"
          pie={recHasta > 0 ? t.kpi.pctGastado.replace("{v}", f.pct(gastado / recHasta)) : undefined}
          medidor={recHasta > 0 ? gastado / recHasta : undefined}
        />
        <Kpi
          etiqueta={rango ? t.kpi.saldoCierre : t.kpi.saldo}
          valor={f.eur(saldo)}
          color="var(--viz-saldo)"
          senal
        />
        <Kpi
          etiqueta={t.kpi.aportaciones}
          valor={f.num(aportaciones)}
          color="var(--viz-entra)"
          pie={aportaciones > 0 ? t.kpi.media.replace("{v}", f.eur2(recTransf / aportaciones)) : undefined}
        />
      </div>
      {campana !== "todas" ? <p className="mt-2 text-xs text-[var(--color-tinta-suave)]">{t.kpi.notaCampana}</p> : null}

      {/* ── GRÁFICOS ── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={t.evolucion.titulo} sub={t.evolucion.sub} className="lg:col-span-2">
          <Evolucion
            ejeDias={ejeDias}
            dias={dias}
            movimientos={movimientos.filter((m) => pasaCampana(m.campana) && pasaTipo(m.tipo))}
            todosMovimientos={movimientos}
            rango={rango}
            onRango={setRango}
            f={f}
            t={t}
          />
        </Tarjeta>
        <Tarjeta titulo={t.conceptos.titulo} sub={t.conceptos.sub}>
          <Conceptos
            movimientos={movimientos.filter((m) => pasaCampana(m.campana) && enRango(m.fecha))}
            conceptos={conceptos}
            pasaTipo={pasaTipo}
            onTipo={toggleTipo}
            tipos={t.tipos}
            f={f}
          />
        </Tarjeta>
        <Tarjeta titulo={t.cascada.titulo} sub={t.cascada.sub}>
          <Cascada recaudado={recaudado} movimientos={movsFiltrados} rango={rango !== null} f={f} t={t} />
        </Tarjeta>
        <Tarjeta titulo={t.diario.titulo} sub={t.diario.sub} className="lg:col-span-2">
          <Semanal semanas={semanas} dias={dias} rango={rango} onRango={setRango} f={f} t={t} />
        </Tarjeta>
      </div>

      {/* ── TABLA (la vista sin gráficos de todo lo anterior) ── */}
      <Tabla
        movimientos={movsFiltrados}
        semanas={semanas}
        dias={diasRango}
        conceptos={conceptos}
        nombreCampana={nombreCampana}
        lang={lang}
        f={f}
        t={t}
      />
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  color,
  pie,
  medidor,
  senal = false,
}: {
  etiqueta: string;
  valor: string;
  color: string;
  pie?: string;
  medidor?: number;
  senal?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <p className="text-sm text-[var(--color-tinta-suave)]">{etiqueta}</p>
      <p
        className={`mt-1 font-[family-name:var(--ff-mono)] text-3xl font-medium transition-opacity ${
          senal ? "text-[var(--color-senal)]" : "text-[var(--color-tinta)]"
        }`}
        aria-live="polite"
      >
        {valor}
      </p>
      {medidor !== undefined ? (
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--viz-pista)]">
          <div
            className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.min(100, medidor * 100)}%`, background: color }}
          />
        </div>
      ) : null}
      {pie ? <p className="mt-2 text-xs text-[var(--color-tinta-suave)]">{pie}</p> : null}
    </div>
  );
}

/* ───────────────────────── 1 · Evolución (líneas acumuladas) ───────────────────────── */

function Evolucion({
  ejeDias,
  dias,
  movimientos,
  todosMovimientos,
  rango,
  onRango,
  f,
  t,
}: {
  ejeDias: string[];
  dias: DiaRecaudacion[];
  movimientos: Movimiento[];
  todosMovimientos: Movimiento[];
  rango: { desde: string; hasta: string } | null;
  onRango: (r: { desde: string; hasta: string } | null) => void;
  f: Formatos;
  t: TextosPanel;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>(900);
  const alto = 260;
  const m = { t: 14, r: 64, b: 28, l: 52 };
  const W = ancho - m.l - m.r;
  const H = alto - m.t - m.b;

  // Acumulados día a día. Lo recaudado y el saldo son de toda la caja; lo gastado sigue
  // a los filtros de campaña y tipo (el periodo lo marca la franja, no recorta el eje).
  const serie = React.useMemo(() => {
    const suma = <T extends { fecha: string; importe: number }>(xs: T[], d: string) =>
      xs.filter((x) => x.fecha <= d).reduce((a, x) => a + x.importe, 0);
    return ejeDias.map((d) => {
      const r = suma(dias, d);
      return { d, r: cent(r), g: cent(suma(movimientos, d)), s: cent(r - suma(todosMovimientos, d)) };
    });
  }, [ejeDias, dias, movimientos, todosMovimientos]);

  const max = Math.max(1, ...serie.map((p) => Math.max(p.r, p.g, p.s)));
  const yt = ticks(max);
  const yMax = yt[yt.length - 1];
  const x = (i: number) => m.l + (ejeDias.length > 1 ? (i * W) / (ejeDias.length - 1) : 0);
  const y = (v: number) => m.t + H - (v / yMax) * H;
  const linea = (k: "r" | "g" | "s") => serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area = `${linea("r")}L${x(serie.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  const [hover, setHover] = React.useState<number | null>(null);
  const [arrastre, setArrastreEstado] = React.useState<{ a: number; b: number } | null>(null);
  // El arrastre vive también en una ref: los eventos de puntero pueden llegar antes de que
  // React repinte, y leerlo del estado daría el valor de la pintura anterior.
  const arrastreRef = React.useRef<{ a: number; b: number } | null>(null);
  const setArrastre = (v: { a: number; b: number } | null) => {
    arrastreRef.current = v;
    setArrastreEstado(v);
  };
  const indice = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * ancho;
    return Math.max(0, Math.min(ejeDias.length - 1, Math.round(((px - m.l) / W) * (ejeDias.length - 1))));
  };

  const iRango = rango ? [ejeDias.indexOf(rango.desde), ejeDias.indexOf(rango.hasta)] : null;
  const franja = arrastre ? [Math.min(arrastre.a, arrastre.b), Math.max(arrastre.a, arrastre.b)] : iRango;
  const pasos = Math.max(1, Math.round(ejeDias.length / Math.max(2, Math.floor(W / 70))));

  const series = [
    { k: "r" as const, nombre: t.evolucion.recaudado, color: "var(--viz-entra)" },
    { k: "g" as const, nombre: t.evolucion.gastos, color: "var(--viz-sale)" },
    { k: "s" as const, nombre: t.evolucion.saldo, color: "var(--viz-saldo)" },
  ];
  const ultimo = serie[serie.length - 1];
  const tip: Tip =
    hover !== null && !arrastre
      ? {
          x: x(hover),
          y: m.t,
          titulo: f.larga(serie[hover].d),
          filas: series.map((s) => ({ color: s.color, valor: f.eur(serie[hover][s.k]), etiqueta: s.nombre })),
        }
      : null;

  // Etiquetas al final de cada línea; si chocan, se apartan lo justo.
  const finales = series
    .map((s) => ({ ...s, yy: y(ultimo?.[s.k] ?? 0) }))
    .sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < finales.length; i++) if (finales[i].yy - finales[i - 1].yy < 13) finales[i].yy = finales[i - 1].yy + 13;

  return (
    <div ref={ref} className="relative">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-tinta-suave)]">
        {series.map((s) => (
          <li key={s.k} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.nombre}
          </li>
        ))}
      </ul>
      <svg
        width={ancho}
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label={`${t.evolucion.titulo}: ${series.map((s) => `${s.nombre} ${f.eur(ultimo?.[s.k] ?? 0)}`).join(", ")}`}
        className="block max-w-full cursor-crosshair select-none"
        style={{ touchAction: "pan-y" }}
        onPointerMove={(e) => {
          const i = indice(e.clientX, e.currentTarget);
          setHover(i);
          if (arrastreRef.current) setArrastre({ ...arrastreRef.current, b: i });
        }}
        onPointerLeave={() => {
          setHover(null);
          if (!arrastreRef.current) return;
          setArrastre(null);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* sin captura: el arrastre funciona igual mientras no se salga del gráfico */
          }
          const i = indice(e.clientX, e.currentTarget);
          setArrastre({ a: i, b: i });
        }}
        onPointerUp={(e) => {
          const ar = arrastreRef.current;
          if (ar) {
            const fin = indice(e.clientX, e.currentTarget);
            const [a, b] = [Math.min(ar.a, fin), Math.max(ar.a, fin)];
            if (a !== b) onRango({ desde: ejeDias[a], hasta: ejeDias[b] });
          }
          setArrastre(null);
        }}
        onPointerCancel={() => setArrastre(null)}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + W} y1={y(v)} y2={y(v)} stroke="var(--viz-rejilla)" strokeWidth={1} />
            <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--color-tinta-suave)] text-[10px] tabular-nums">
              {f.compacto(v)}
            </text>
          </g>
        ))}
        {ejeDias.map((d, i) =>
          i % pasos === 0 ? (
            <text key={d} x={x(i)} y={alto - 8} textAnchor="middle" className="fill-[var(--color-tinta-suave)] text-[10px]">
              {f.corta(d)}
            </text>
          ) : null,
        )}
        {franja ? (
          <>
            <rect x={m.l} y={m.t} width={Math.max(0, x(franja[0]) - m.l)} height={H} fill="var(--viz-velo)" />
            <rect x={x(franja[1])} y={m.t} width={Math.max(0, m.l + W - x(franja[1]))} height={H} fill="var(--viz-velo)" />
            <line x1={x(franja[0])} x2={x(franja[0])} y1={m.t} y2={m.t + H} stroke="var(--color-tinta-suave)" strokeWidth={1} />
            <line x1={x(franja[1])} x2={x(franja[1])} y1={m.t} y2={m.t + H} stroke="var(--color-tinta-suave)" strokeWidth={1} />
          </>
        ) : null}
        <path d={area} fill="var(--viz-entra)" opacity={0.1} />
        {series.map((s) => (
          <path key={s.k} d={linea(s.k)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {finales.map((s) => (
          <g key={s.k}>
            <circle cx={x(serie.length - 1)} cy={y(ultimo?.[s.k] ?? 0)} r={4} fill={s.color} stroke="var(--color-superficie)" strokeWidth={2} />
            <text x={x(serie.length - 1) + 8} y={s.yy} dy="0.32em" className="fill-[var(--color-tinta)] text-[10px] font-medium">
              {f.compacto(ultimo?.[s.k] ?? 0)}
            </text>
          </g>
        ))}
        {hover !== null && !arrastre ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + H} stroke="var(--color-tinta-suave)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.k} cx={x(hover)} cy={y(serie[hover][s.k])} r={4} fill={s.color} stroke="var(--color-superficie)" strokeWidth={2} />
            ))}
          </g>
        ) : null}
      </svg>
      <Tooltip tip={tip} ancho={ancho} />
    </div>
  );
}

/* ───────────────────────── 2 · Gastos por concepto (barras) ───────────────────────── */

function Conceptos({
  movimientos,
  conceptos,
  pasaTipo,
  onTipo,
  tipos,
  f,
}: {
  movimientos: Movimiento[];
  conceptos: Record<string, string>;
  pasaTipo: (t: TipoGasto) => boolean;
  onTipo: (t: TipoGasto) => void;
  tipos: Record<TipoGasto, string>;
  f: Formatos;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>(440);
  const filas = Object.values(
    movimientos.reduce<Record<string, { concepto: string; tipo: TipoGasto; total: number }>>((acc, m) => {
      acc[m.concepto] ??= { concepto: m.concepto, tipo: m.tipo, total: 0 };
      acc[m.concepto].total = cent(acc[m.concepto].total + m.importe);
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...filas.map((r) => r.total));
  const valorAncho = 70;
  const barraMax = Math.max(40, ancho - valorAncho);
  const fila = 50;
  const conTipo = ancho >= 560;
  const caben = Math.floor(ancho / 6.4) - (conTipo ? 24 : 0);
  const [tip, setTip] = React.useState<Tip>(null);

  if (!filas.length) return <p className="text-sm text-[var(--color-tinta-suave)]">—</p>;
  return (
    <div ref={ref} className="relative">
      <svg width={ancho} height={filas.length * fila} viewBox={`0 0 ${ancho} ${filas.length * fila}`} className="block max-w-full" role="list">
        {filas.map((r, i) => {
          const activo = pasaTipo(r.tipo);
          const w = Math.max(2, (r.total / max) * barraMax);
          const y0 = i * fila;
          const nombre = conceptos[r.concepto] ?? r.concepto;
          return (
            <g
              key={r.concepto}
              role="listitem"
              tabIndex={0}
              aria-label={`${nombre} (${tipos[r.tipo]}): ${f.eur2(r.total)}`}
              className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--color-tinta)]"
              onClick={() => onTipo(r.tipo)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTipo(r.tipo);
                }
              }}
              onPointerMove={(e) => {
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - b.left,
                  y: e.clientY - b.top,
                  titulo: nombre,
                  filas: [{ color: "var(--viz-sale)", valor: f.eur2(r.total), etiqueta: tipos[r.tipo] }],
                });
              }}
              onPointerLeave={() => setTip(null)}
            >
              <rect x={0} y={i * fila} width={ancho} height={fila} fill="transparent" stroke="transparent" rx={6} />
              <text x={0} y={y0 + 14} className="fill-[var(--color-tinta)] text-[11px]">
                {nombre.length > caben ? `${nombre.slice(0, caben - 1)}…` : nombre}
                {/* En pantallas estrechas el tipo no cabe en la misma línea: queda en el
                    tooltip, en el nombre accesible y en la tabla. */}
                {conTipo ? (
                  <tspan className="fill-[var(--color-tinta-suave)] text-[9px] uppercase tracking-wider"> · {tipos[r.tipo]}</tspan>
                ) : null}
              </text>
              <rect
                x={0}
                y={y0 + 22}
                width={w}
                height={18}
                rx={4}
                fill={activo ? "var(--viz-sale)" : "var(--viz-apagado)"}
                className="transition-[width,fill] duration-300 motion-reduce:transition-none"
              />
              <text x={w + 6} y={y0 + 31} dy="0.32em" className="fill-[var(--color-tinta)] text-[11px] tabular-nums">
                {f.eur(r.total)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} ancho={ancho} />
    </div>
  );
}

/* ───────────────────────── 3 · Cascada (de lo recaudado al saldo) ───────────────────────── */

function Cascada({
  recaudado,
  movimientos,
  rango,
  f,
  t,
}: {
  recaudado: number;
  movimientos: Movimiento[];
  rango: boolean;
  f: Formatos;
  t: TextosPanel;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>(440);
  const alto = 240;
  const m = { t: 22, r: 8, b: 44, l: 8 };
  const porTipo = TIPOS.map((tp) => ({ tp, v: cent(movimientos.filter((x) => x.tipo === tp).reduce((a, x) => a + x.importe, 0)) })).filter(
    (x) => x.v > 0,
  );
  const final = cent(recaudado - porTipo.reduce((a, x) => a + x.v, 0));
  type Paso = { nombre: string; desde: number; hasta: number; color: string; valor: number };
  const pasos: Paso[] = [{ nombre: t.cascada.recaudado, desde: 0, hasta: recaudado, color: "var(--viz-entra)", valor: recaudado }];
  let nivel = recaudado;
  for (const p of porTipo) {
    pasos.push({ nombre: t.tipos[p.tp], desde: nivel, hasta: nivel - p.v, color: "var(--viz-sale)", valor: -p.v });
    nivel -= p.v;
  }
  pasos.push({ nombre: rango ? t.cascada.neto : t.cascada.saldo, desde: 0, hasta: final, color: "var(--viz-saldo)", valor: final });

  const max = Math.max(1, recaudado, ...pasos.map((p) => Math.max(p.desde, p.hasta)));
  const min = Math.min(0, ...pasos.map((p) => Math.min(p.desde, p.hasta)));
  const W = ancho - m.l - m.r;
  const H = alto - m.t - m.b;
  const y = (v: number) => m.t + ((max - v) / (max - min)) * H;
  const banda = W / pasos.length;
  const barra = Math.min(48, banda * 0.6);
  const [tip, setTip] = React.useState<Tip>(null);

  return (
    <div ref={ref} className="relative">
      <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="block max-w-full" role="img"
        aria-label={`${t.cascada.titulo}: ${pasos.map((p) => `${p.nombre} ${f.eur(p.valor)}`).join(", ")}`}>
        <line x1={m.l} x2={m.l + W} y1={y(0)} y2={y(0)} stroke="var(--viz-rejilla)" />
        {pasos.map((p, i) => {
          const cx = m.l + banda * i + banda / 2;
          const top = y(Math.max(p.desde, p.hasta));
          const h = Math.max(2, Math.abs(y(p.desde) - y(p.hasta)));
          const siguiente = pasos[i + 1];
          return (
            <g
              key={p.nombre}
              onPointerMove={(e) => {
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - b.left, y: e.clientY - b.top, titulo: p.nombre, filas: [{ color: p.color, valor: f.eur2(p.valor), etiqueta: "" }] });
              }}
              onPointerLeave={() => setTip(null)}
            >
              <rect x={cx - banda / 2} y={m.t} width={banda} height={H} fill="transparent" />
              <rect x={cx - barra / 2} y={top} width={barra} height={h} rx={3} fill={p.color} className="transition-all duration-300 motion-reduce:transition-none" />
              {siguiente && i > 0 && i < pasos.length - 2 ? (
                <line x1={cx + barra / 2} x2={cx + banda - barra / 2} y1={y(p.hasta)} y2={y(p.hasta)} stroke="var(--color-tinta-suave)" strokeWidth={1} />
              ) : null}
              {i === 0 && siguiente ? (
                <line x1={cx + barra / 2} x2={cx + banda - barra / 2} y1={y(p.hasta)} y2={y(p.hasta)} stroke="var(--color-tinta-suave)" strokeWidth={1} />
              ) : null}
              <text x={cx} y={top - 6} textAnchor="middle" className="fill-[var(--color-tinta)] text-[10px] tabular-nums">
                {p.valor < 0 ? `−${f.compacto(-p.valor)}` : f.compacto(p.valor)}
              </text>
              <text x={cx} y={alto - m.b + 16} textAnchor="middle" className="fill-[var(--color-tinta-suave)] text-[10px]">
                {partir(p.nombre, Math.max(6, Math.floor(banda / 5.8))).map((l, j) => (
                  <tspan key={j} x={cx} dy={j ? 12 : 0}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} ancho={ancho} />
    </div>
  );
}

/* ───────────────────────── 4 · Aportaciones por semana (columnas) ───────────────────────── */

/**
 * Por semana y no por día (decisión de la coordinación, 21-oct-2026): se lee mejor —la
 * recaudación se concentra en los primeros días y el resto eran barras casi invisibles— y
 * deja menos al descubierto lo que aporta cada cual en los días con pocas aportaciones.
 */
function Semanal({
  semanas,
  dias,
  rango,
  onRango,
  f,
  t,
}: {
  semanas: Semana[];
  dias: DiaRecaudacion[];
  rango: { desde: string; hasta: string } | null;
  onRango: (r: { desde: string; hasta: string } | null) => void;
  f: Formatos;
  t: TextosPanel;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>(900);
  const alto = 200;
  const m = { t: 18, r: 8, b: 28, l: 52 };
  const W = ancho - m.l - m.r;
  const H = alto - m.t - m.b;
  const datos = porSemana(semanas, dias);
  const max = Math.max(1, ...datos.map((p) => p.total));
  const yt = ticks(max, 3);
  const yMax = yt[yt.length - 1];
  const banda = W / Math.max(1, datos.length);
  const barra = Math.max(4, Math.min(48, banda * 0.6));
  const y = (v: number) => m.t + H - (v / yMax) * H;
  const pasos = Math.max(1, Math.ceil(datos.length / Math.max(2, Math.floor(W / 64))));
  const pico = datos.reduce((a, p) => (p.total > a.total ? p : a), datos[0]);
  const [tip, setTip] = React.useState<Tip>(null);
  const tramo = (s: Semana) => (s.desde === s.hasta ? f.corta(s.desde) : `${f.corta(s.desde)} – ${f.corta(s.hasta)}`);

  return (
    <div ref={ref} className="relative">
      <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="block max-w-full" role="list">
        {yt.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + W} y1={y(v)} y2={y(v)} stroke="var(--viz-rejilla)" />
            <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--color-tinta-suave)] text-[10px] tabular-nums">
              {f.compacto(v)}
            </text>
          </g>
        ))}
        {datos.map((p, i) => {
          const cx = m.l + banda * i + banda / 2;
          const dentro = !rango || (p.hasta >= rango.desde && p.desde <= rango.hasta);
          const sola = rango?.desde === p.desde && rango?.hasta === p.hasta;
          const etiquetaN = p.n >= MIN_APORT_VISIBLE ? t.diario.aportaciones.replace("{n}", f.num(p.n)) : p.n > 0 ? t.diario.pocas : "";
          const elegir = () => {
            if (p.total > 0) onRango(sola ? null : { desde: p.desde, hasta: p.hasta });
          };
          return (
            <g
              key={p.lunes}
              role="listitem"
              tabIndex={p.total > 0 ? 0 : -1}
              aria-label={`${tramo(p)}: ${f.eur2(p.total)}${etiquetaN ? `, ${etiquetaN}` : ""}`}
              className={p.total > 0 ? "cursor-pointer outline-none" : "outline-none"}
              onClick={elegir}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  elegir();
                }
              }}
              onPointerMove={(e) => {
                if (!p.total) return setTip(null);
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                const filas = [{ color: "var(--viz-entra)", valor: f.eur2(p.total), etiqueta: etiquetaN }];
                if (p.otros > 0) filas.push({ color: "var(--viz-entra)", valor: f.eur2(p.otros), etiqueta: t.diario.otros });
                setTip({ x: e.clientX - b.left, y: e.clientY - b.top, titulo: tramo(p), filas });
              }}
              onPointerLeave={() => setTip(null)}
            >
              <rect x={cx - banda / 2} y={m.t} width={banda} height={H} fill="transparent" />
              {p.total > 0 ? (
                <path
                  d={(() => {
                    const x0 = cx - barra / 2;
                    const top = y(p.total);
                    const h = m.t + H - top;
                    const r = Math.min(4, barra / 2, h);
                    return `M${x0},${m.t + H}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + barra - r}Q${x0 + barra},${top} ${x0 + barra},${top + r}V${m.t + H}Z`;
                  })()}
                  fill={dentro ? "var(--viz-entra)" : "var(--viz-apagado)"}
                  className="transition-[fill] duration-200"
                />
              ) : null}
              {i % pasos === 0 ? (
                <text x={cx} y={alto - 8} textAnchor="middle" className="fill-[var(--color-tinta-suave)] text-[10px]">
                  {f.corta(p.desde)}
                </text>
              ) : null}
            </g>
          );
        })}
        {pico && pico.total > 0 ? (
          <text
            x={m.l + banda * datos.indexOf(pico) + banda / 2}
            y={y(pico.total) - 6}
            textAnchor="middle"
            className="fill-[var(--color-tinta)] text-[10px] tabular-nums"
          >
            {f.compacto(pico.total)}
          </text>
        ) : null}
      </svg>
      <Tooltip tip={tip} ancho={ancho} />
    </div>
  );
}

/* ───────────────────────── Tabla de movimientos (y vista en tabla) ───────────────────────── */

type Orden = { k: "fecha" | "importe"; desc: boolean };

function Cab({
  k,
  children,
  derecha,
  orden,
  onOrden,
  soloAncho,
}: {
  k?: Orden["k"];
  children: React.ReactNode;
  derecha?: boolean;
  orden?: Orden;
  onOrden?: (k: Orden["k"]) => void;
  /** Solo en pantallas anchas: en móvil su dato va bajo el concepto. */
  soloAncho?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={k && orden?.k === k ? (orden.desc ? "descending" : "ascending") : undefined}
      className={`border-b border-[var(--color-linea)] px-3 py-2 font-[family-name:var(--ff-mono)] text-[10px] font-normal uppercase tracking-wider text-[var(--color-tinta-suave)] ${derecha ? "text-right" : "text-left"} ${soloAncho ? "hidden md:table-cell" : ""}`}
    >
      {k && onOrden ? (
        <button type="button" onClick={() => onOrden(k)} className="uppercase">
          {children} {orden?.k === k ? (orden.desc ? "↓" : "↑") : ""}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * Los gastos AGRUPADOS POR CONCEPTO (decisión de la coordinación, 21-oct-2026): una fila por
 * concepto con su total, su número de pagos y la fecha del último; al pulsarla se despliegan
 * sus pagos uno a uno. El CSV sigue saliendo pago a pago, que es lo que se concilia con el banco.
 */
function Tabla({
  movimientos,
  semanas,
  dias,
  conceptos,
  nombreCampana,
  lang,
  f,
  t,
}: {
  movimientos: Movimiento[];
  semanas: Semana[];
  dias: DiaRecaudacion[];
  conceptos: Record<string, string>;
  nombreCampana: (c: string) => string;
  lang: string;
  f: Formatos;
  t: TextosPanel;
}) {
  const [orden, setOrden] = React.useState<Orden>({ k: "importe", desc: true });
  const onOrden = (k: Orden["k"]) => setOrden((o) => ({ k, desc: o.k === k ? !o.desc : true }));
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const alternar = (k: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });

  const grupos = Object.values(
    movimientos.reduce<
      Record<string, { clave: string; concepto: string; tipo: TipoGasto; campana: string; total: number; ultimo: string; pagos: Movimiento[] }>
    >((acc, m) => {
      const k = `${m.campana}|${m.concepto}`;
      acc[k] ??= { clave: k, concepto: m.concepto, tipo: m.tipo, campana: m.campana, total: 0, ultimo: m.fecha, pagos: [] };
      acc[k].total = cent(acc[k].total + m.importe);
      if (m.fecha > acc[k].ultimo) acc[k].ultimo = m.fecha;
      acc[k].pagos.push(m);
      return acc;
    }, {}),
  ).sort((a, b) => {
    const v = orden.k === "fecha" ? a.ultimo.localeCompare(b.ultimo) : a.total - b.total;
    return orden.desc ? -v : v;
  });
  const total = cent(movimientos.reduce((a, m) => a + m.importe, 0));
  const semanasTabla = porSemana(semanas, dias).filter((s) => s.total > 0);

  const descargar = () => {
    const dec = lang === "en" ? "." : ",";
    const sep = ";";
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const filas = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const lineas = [
      [t.tabla.fecha, t.tabla.concepto, t.tabla.tipo, t.tabla.campana, t.tabla.importe].map(esc).join(sep),
      ...filas.map((m) =>
        [m.fecha, conceptos[m.concepto] ?? m.concepto, t.tipos[m.tipo], nombreCampana(m.campana), m.importe.toFixed(2).replace(".", dec)]
          .map((x, i) => (i === 4 ? x : esc(x)))
          .join(sep),
      ),
    ];
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "caja-resistencia-movimientos.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const celda = "px-3 py-2";
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-tinta)]">{t.tabla.titulo}</p>
          <p className="mt-0.5 text-xs text-[var(--color-tinta-suave)]">{t.tabla.sub}</p>
        </div>
        {grupos.length ? (
          <button
            type="button"
            onClick={descargar}
            className="rounded-md border border-[var(--color-linea)] px-3 py-1 text-xs text-[var(--color-tinta)] hover:border-[var(--color-tinta)]"
          >
            {t.tabla.csv}
          </button>
        ) : null}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Cab>{t.tabla.concepto}</Cab>
              <Cab soloAncho>{t.tabla.tipo}</Cab>
              <Cab soloAncho>{t.tabla.campana}</Cab>
              <Cab k="fecha" orden={orden} onOrden={onOrden} soloAncho>
                {t.tabla.ultimoPago}
              </Cab>
              <Cab k="importe" derecha orden={orden} onOrden={onOrden}>
                {t.tabla.importe}
              </Cab>
            </tr>
          </thead>
          <tbody>
            {grupos.length ? (
              grupos.flatMap((g) => {
                const nombre = conceptos[g.concepto] ?? g.concepto;
                const abierto = abiertos.has(g.clave);
                const nPagos = g.pagos.length === 1 ? t.tabla.unPago : t.tabla.pagos.replace("{n}", f.num(g.pagos.length));
                const fila = (
                  <tr key={g.clave} className="border-b border-[var(--color-linea)]">
                    <td className={celda}>
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={t.tabla.verPagos.replace("{concepto}", nombre)}
                        onClick={() => alternar(g.clave)}
                        className="flex items-start gap-2 text-left text-[var(--color-tinta)] hover:text-[var(--color-acento-tinta)]"
                      >
                        <span aria-hidden className={`mt-0.5 inline-block text-[10px] transition-transform ${abierto ? "rotate-90" : ""}`}>
                          ▶
                        </span>
                        <span>
                          {nombre}
                          <span className="block text-xs text-[var(--color-tinta-suave)]">{nPagos}</span>
                          <span className="block text-xs text-[var(--color-tinta-suave)] md:hidden">
                            {t.tipos[g.tipo]} · {t.tabla.ultimoPago.toLowerCase()} {f.corta(g.ultimo)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className={`${celda} hidden text-[var(--color-tinta-suave)] md:table-cell`}>{t.tipos[g.tipo]}</td>
                    <td className={`${celda} hidden text-[var(--color-tinta-suave)] md:table-cell`}>{nombreCampana(g.campana)}</td>
                    <td className={`${celda} hidden whitespace-nowrap text-[var(--color-tinta-suave)] md:table-cell`}>{f.corta(g.ultimo)}</td>
                    <td className={`${celda} whitespace-nowrap text-right font-[family-name:var(--ff-mono)] tabular-nums text-[var(--color-tinta)]`}>
                      {f.eur2(g.total)}
                    </td>
                  </tr>
                );
                if (!abierto) return [fila];
                const pagos = [...g.pagos]
                  .sort((a, b) => b.fecha.localeCompare(a.fecha))
                  .map((p, i) => (
                    <tr key={`${g.clave}-${p.fecha}-${i}`} className="border-b border-[var(--color-linea)] bg-[var(--color-fondo)]/40 text-xs">
                      <td className="py-1.5 pl-8 pr-3 text-[var(--color-tinta-suave)]">{f.larga(p.fecha)}</td>
                      <td className="hidden md:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-[family-name:var(--ff-mono)] tabular-nums text-[var(--color-tinta-suave)]">
                        {f.eur2(p.importe)}
                      </td>
                    </tr>
                  ));
                return [fila, ...pagos];
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-tinta-suave)]">
                  {t.tabla.vacio}
                </td>
              </tr>
            )}
          </tbody>
          {grupos.length ? (
            <tfoot>
              <tr>
                <th scope="row" className="px-3 pt-3 text-left text-sm font-semibold text-[var(--color-tinta)]">
                  {t.tabla.total}
                </th>
                <td className="hidden md:table-cell" />
                <td className="hidden md:table-cell" />
                <td className="hidden md:table-cell" />
                <td className="whitespace-nowrap px-3 pt-3 text-right font-[family-name:var(--ff-mono)] font-semibold tabular-nums text-[var(--color-tinta)]">
                  {f.eur2(total)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-[var(--color-acento-tinta)] underline underline-offset-4">{t.tabla.verDiario}</summary>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              <Cab>{t.tabla.dia}</Cab>
              <Cab derecha>{t.tabla.recaudado}</Cab>
              <Cab derecha>{t.tabla.nAport}</Cab>
            </tr>
          </thead>
          <tbody>
            {semanasTabla.map((s) => (
              <tr key={s.lunes} className="border-b border-[var(--color-linea)] last:border-0">
                <td className="px-3 py-1.5 text-[var(--color-tinta-suave)]">
                  {s.desde === s.hasta ? f.corta(s.desde) : `${f.corta(s.desde)} – ${f.corta(s.hasta)}`}
                  {s.otros > 0 ? <span className="block text-[11px]">{`${f.eur2(s.otros)} ${t.diario.otros}`}</span> : null}
                </td>
                <td className="px-3 py-1.5 text-right font-[family-name:var(--ff-mono)] tabular-nums">{f.eur2(s.total)}</td>
                <td className="px-3 py-1.5 text-right font-[family-name:var(--ff-mono)] tabular-nums text-[var(--color-tinta-suave)]">
                  {s.n >= MIN_APORT_VISIBLE ? f.num(s.n) : s.n > 0 ? `< ${MIN_APORT_VISIBLE}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
