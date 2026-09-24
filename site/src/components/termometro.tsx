import { NoticiasNav } from "@/components/noticias-nav";
import { Miniatura } from "@/components/miniatura";
import { Horquilla, type HorquillaStrings } from "@/components/horquilla";
import { getTermometro } from "@/lib/termometro-source";
import { FASE_2_INICIO } from "@/lib/huelga";

/**
 * Termómetro de la huelga — datos de un dashboard de terceros (independiente, no
 * oficial), que baja el SERVIDOR con fallback al snapshot del repo. La web NO llama al
 * tercero desde el navegador del visitante.
 *
 * Incluye riesgo y sentimiento por decisión de la coordinación (registro adversarial), y desde el
 * 09-ago-2026 también la HORQUILLA de impacto económico a la empresa, que antes se
 * excluía a propósito. Sigue fuera la cotización. Refrescar el fallback:
 *   npm run snapshot:termometro   (y redesplegar).
 */

export type TermometroStrings = {
  kicker: string;
  title: string;
  intro: string;
  freshLabel: string;
  independiente: string;
  diaHuelga: string;
  diaIndefinida: string;
  treguaSub: string;
  hoy: string;
  total: string;
  medios: string;
  riesgoLabel: string;
  riesgoNivel: Record<string, string>;
  riesgoDetalle: string;
  sentLabel: string;
  sentNota: string;
  sentPos: string;
  sentNeu: string;
  sentNeg: string;
  volumenLabel: string;
  volumenEje: string;
  impactoLabel: string;
  impactoIntro: string;
  cronoLabel: string;
  socialLabel: string;
  socialTelegram: string;
  socialX: string;
  socialMastodon: string;
  socialNota: string;
  anterior: string;
  siguiente: string;
  pagina: string;
  anexoCta: string;
  anexoNota: string;
  horquilla: HorquillaStrings;
};

/**
 * Color del nivel de riesgo. Los tres cumplen WCAG AA (≥4.5:1) sobre las DOS superficies
 * en las que puede pintarse la casilla — `--color-superficie` #EFE9DF y `--color-fondo`
 * #F7F4EE —, no solo sobre la que toca hoy.
 *
 * Medido con Lighthouse: el ámbar anterior (#B7791F) daba 3,01:1 y el verde (#2E7D32)
 * 4,25:1. El ámbar no saltaba porque el origen empezó a mandar «amarillo», que no estaba
 * en el mapa y caía a un gris que sí cumplía; el fallo llevaba ahí desde el principio y
 * solo se destapó al añadir esa clave. El verde habría fallado en cuanto bajara el riesgo.
 *
 * Desde el modo noche los tres son TOKENS, no hexadecimales: el ámbar #8F5D14 y el verde
 * #2A702E están elegidos para cumplir sobre papel, y sobre el grafito del modo oscuro
 * caen a ~1,9:1. `globals.css` los aclara ahí (ver bloque `html.dark`).
 */
const RIESGO_COLOR: Record<string, string> = {
  rojo: "var(--color-acento-tinta)", // #C0392B — 4,50:1 sobre superficie
  ambar: "var(--color-riesgo-ambar)", // #8F5D14 · 4,65:1 · antes #B7791F (3,01:1)
  amarillo: "var(--color-riesgo-ambar)", // el origen usa «amarillo» desde ago-2026
  verde: "var(--color-riesgo-verde)", // #2A702E · 5,03:1 · antes #2E7D32 (4,25:1)
};

function fecha(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(d);
}
function diaMes(dia: string, lang: string): string {
  const d = new Date(dia);
  return Number.isNaN(d.getTime()) ? dia : new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short" }).format(d);
}

/** Gráfica de barras del volumen de cobertura, CON eje de días (X) y escala (Y). */
function GraficaVolumen({ datos, ejeLabel, lang }: { datos: { dia: string; n: number }[]; ejeLabel: string; lang: string }) {
  if (!datos.length) return null;
  const max = Math.max(...datos.map((d) => d.n), 1);
  const W = 320, H = 120, padL = 26, padB = 18, padT = 6;
  const cw = W - padL, ch = H - padB - padT;
  const gap = 2;
  const bw = (cw - gap * (datos.length - 1)) / datos.length;
  const yTicks = [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${ejeLabel}. Máximo ${max} en un día.`}>
      {yTicks.map((v) => {
        const y = padT + ch - (v / max) * ch;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W} y2={y} stroke="var(--color-linea)" strokeWidth={1} />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontFamily="var(--ff-mono)" fontSize={8} fill="var(--color-tinta-suave)">
              {v}
            </text>
          </g>
        );
      })}
      {datos.map((d, i) => {
        const h = (d.n / max) * ch;
        const x = padL + i * (bw + gap);
        return <rect key={d.dia} x={x} y={padT + ch - h} width={bw} height={h} rx={0.8} fill="var(--color-confianza-tinta)" opacity={i === datos.length - 1 ? 1 : 0.5} />;
      })}
      {[0, datos.length - 1].map((i) => (
        <text
          key={i}
          x={padL + i * (bw + gap) + bw / 2}
          y={H - 5}
          textAnchor={i === 0 ? "start" : "end"}
          fontFamily="var(--ff-mono)"
          fontSize={8}
          fill="var(--color-tinta-suave)"
        >
          {diaMes(datos[i].dia, lang)}
        </text>
      ))}
    </svg>
  );
}

type Sent = { positivo: number; neutro: number; negativo: number; pctNegativo: number | null } | null;

/** Barra apilada del sentimiento de la cobertura, respecto a la empresa. */
function Sentimiento({ s, sm }: { s: TermometroStrings; sm: Sent }) {
  if (!sm) return null;
  const tot = (sm.positivo ?? 0) + (sm.neutro ?? 0) + (sm.negativo ?? 0) || 1;
  const segs = [
    { k: s.sentNeg, n: sm.negativo ?? 0, c: "var(--color-acento-tinta)" },
    { k: s.sentNeu, n: sm.neutro ?? 0, c: "var(--color-tinta-suave)" },
    { k: s.sentPos, n: sm.positivo ?? 0, c: "var(--color-confianza-tinta)" },
  ];
  return (
    <div>
      <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">{s.sentLabel}</p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        {segs.map((g) => (
          <span key={g.k} style={{ width: `${(g.n / tot) * 100}%`, background: g.c }} />
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {segs.map((g) => (
          <div key={g.k} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: g.c }} />
            <dt className="text-xs text-[var(--color-tinta-suave)]">{g.k}</dt>
            <dd className="font-[family-name:var(--ff-mono)] text-xs tabular-nums text-[var(--color-tinta)]">{Math.round((g.n / tot) * 100)}%</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">{s.sentNota}</p>
    </div>
  );
}

export async function Termometro({ s, lang }: { s: TermometroStrings; lang: string }) {
  const { data } = await getTermometro();
  const { huelga, kpi, volumen, impacto, cronologico, social, riesgo, sentimiento, horquilla, fuente, origenActualizado } = data;
  const nf = new Intl.NumberFormat(lang);
  const pag = { anterior: s.anterior, siguiente: s.siguiente, pagina: s.pagina };

  // El conflicto va por fases: primera convocatoria con fecha de fin, tregua e indefinida.
  // La casilla dice en cuál estamos, no un contador que ya no significa nada.
  const tileHuelga = !huelga
    ? null
    : huelga.fase === "primera"
      ? { k: s.diaHuelga.replace("{dia}", String(huelga.dia)).replace("{total}", String(huelga.total)), sub: null }
      : huelga.fase === "indefinida"
        ? { k: s.diaIndefinida.replace("{dia}", String(huelga.dia)), sub: null }
        : {
            // Zona fija: la fecha de reanudación no puede bailar un día según dónde se
            // renderice. El conflicto es en España.
            k: new Intl.DateTimeFormat(lang, {
              day: "numeric", month: "short", timeZone: "Europe/Madrid",
            }).format(new Date(FASE_2_INICIO)),
            sub: s.treguaSub.replace("{dias}", String(huelga.dias)),
          };

  const tiles = [
    tileHuelga,
    kpi.total != null ? { k: nf.format(kpi.total), sub: s.total } : null,
    kpi.medios != null ? { k: nf.format(kpi.medios), sub: s.medios } : null,
    kpi.hoy != null ? { k: nf.format(kpi.hoy), sub: s.hoy } : null,
  ].filter(Boolean) as { k: string; sub: string | null }[];

  const riesgoColor = riesgo?.nivel ? RIESGO_COLOR[riesgo.nivel] ?? "var(--color-tinta-suave)" : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="kicker !mb-0">{s.kicker}</p>
        <span className="rounded bg-[color-mix(in_srgb,var(--color-confianza)_12%,transparent)] px-2 py-0.5 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-confianza-tinta)]">
          {s.freshLabel.replace("{fecha}", fecha(origenActualizado, lang))}
        </span>
      </div>
      <h2 className="mt-4 max-w-3xl font-[family-name:var(--ff-display)] text-3xl font-bold leading-tight md:text-5xl">{s.title}</h2>
      <p className="mt-6 max-w-3xl text-[var(--color-tinta-suave)]">{s.intro}</p>

      {/* Riesgo + KPIs + sentimiento + gráfica */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
          {riesgo?.nivel ? (
            <div className="mb-5 flex items-center gap-3 border-b border-[var(--color-linea)] pb-5">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: riesgoColor! }} aria-hidden="true" />
              <div>
                <p className="font-[family-name:var(--ff-display)] text-lg font-bold" style={{ color: riesgoColor! }}>
                  {s.riesgoNivel[riesgo.nivel] ?? riesgo.nivel}
                </p>
                {sentimiento?.pctNegativo != null ? (
                  <p className="font-[family-name:var(--ff-mono)] text-[11px] text-[var(--color-tinta-suave)]">
                    {s.riesgoDetalle.replace("{pct}", String(sentimiento.pctNegativo).replace(".", ","))}
                  </p>
                ) : null}
              </div>
              <span className="ml-auto font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">{s.riesgoLabel}</span>
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-5">
            {tiles.map((t) => (
              <div key={t.k}>
                <dd className="font-[family-name:var(--ff-mono)] text-3xl font-medium tabular-nums text-[var(--color-tinta)]">{t.k}</dd>
                {t.sub ? <dt className="mt-1 text-sm text-[var(--color-tinta-suave)]">{t.sub}</dt> : null}
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
          <Sentimiento s={s} sm={sentimiento} />
          <p className="mt-6 font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">{s.volumenLabel}</p>
          <GraficaVolumen datos={volumen} ejeLabel={s.volumenEje} lang={lang} />
        </div>
      </div>

      {/* Punto de ruptura: horquilla mín-máx del impacto acumulado a la empresa */}
      <Horquilla datos={horquilla} s={s.horquilla} lang={lang} />

      {/* ── Dos columnas: mayor impacto + cronológico ──
          Aquí había antes una tira de «últimos titulares» sacada del top5 del origen. Se
          retiró (10-ago-2026): sus cuatro noticias son las cuatro primeras del cronológico,
          así que la portada las enseñaba dos veces con distinto envoltorio.

          Las dos columnas se estiran a la misma altura y el paginador del cronológico baja al
          fondo (`mt-auto` en `NoticiasNav`): si no, la columna corta terminaba a media altura
          y la sección quedaba descuadrada. */}
      <div className="mt-10 grid items-stretch gap-10 lg:grid-cols-2">
        <div className="flex flex-col">
          <p className="font-[family-name:var(--ff-display)] text-lg font-bold text-[var(--color-tinta)]">{s.impactoLabel}</p>
          <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">{s.impactoIntro}</p>
          <ol className="mt-4 space-y-3">
            {impacto.map((t, i) => (
              <li key={t.url}>
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] p-4 transition-colors hover:border-[var(--color-tinta)]">
                  <span className="font-[family-name:var(--ff-mono)] text-lg font-semibold tabular-nums text-[var(--color-acento-tinta)]">{i + 1}</span>
                  <Miniatura src={t.imagen ?? null} medio={t.medio} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-tinta)] group-hover:text-[var(--color-confianza-tinta)]">{t.titulo}</span>
                    <span className="mt-1 block font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">{t.medio}</span>
                    {t.razon ? <span className="mt-1 block text-xs text-[var(--color-tinta-suave)]">{t.razon}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col">
          <p className="font-[family-name:var(--ff-display)] text-lg font-bold text-[var(--color-tinta)]">{s.cronoLabel}</p>
          <div className="mt-4 flex flex-1 flex-col">
            <NoticiasNav items={cronologico} porPagina={6} conSentimiento s={pag} lang={lang} />
          </div>
        </div>
      </div>

      {/* Resumen social */}
      {social ? (
        <div className="mt-10 rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-6">
          <p className="font-[family-name:var(--ff-mono)] text-[10px] uppercase tracking-wider text-[var(--color-tinta-suave)]">{s.socialLabel}</p>
          <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {social.telegram != null ? (
              <div>
                <dd className="font-[family-name:var(--ff-mono)] text-2xl font-medium tabular-nums text-[var(--color-tinta)]">{nf.format(social.telegram)}</dd>
                <dt className="mt-1 text-sm text-[var(--color-tinta-suave)]">{s.socialTelegram}</dt>
              </div>
            ) : null}
            {social.xPosts != null ? (
              <div>
                <dd className="font-[family-name:var(--ff-mono)] text-2xl font-medium tabular-nums text-[var(--color-tinta)]">{nf.format(social.xPosts)}</dd>
                <dt className="mt-1 text-sm text-[var(--color-tinta-suave)]">
                  {s.socialX}
                  {social.xIdiomas ? ` · ${social.xIdiomas} idiomas` : ""}
                </dt>
              </div>
            ) : null}
            {social.mastodon != null ? (
              <div>
                <dd className="font-[family-name:var(--ff-mono)] text-2xl font-medium tabular-nums text-[var(--color-tinta)]">{nf.format(social.mastodon)}</dd>
                <dt className="mt-1 text-sm text-[var(--color-tinta-suave)]">{s.socialMastodon}</dt>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 font-[family-name:var(--ff-mono)] text-[10px] leading-relaxed text-[var(--color-tinta-suave)]">{s.socialNota}</p>
        </div>
      ) : null}

      {/* Anexo: dashboard completo (tercero, se abre fuera) */}
      <div className="mt-8 flex flex-col gap-4 border-t border-[var(--color-linea)] pt-6 sm:flex-row sm:items-center">
        <a href={fuente} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--color-tinta)] px-6 py-3 text-sm font-semibold text-[var(--color-tinta)] transition-colors hover:bg-[var(--color-tinta)] hover:text-[var(--color-fondo)]">
          {s.anexoCta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 3h6v6M11 3 3 11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className="flex-1 font-[family-name:var(--ff-mono)] text-[11px] leading-relaxed text-[var(--color-tinta-suave)]">{s.anexoNota}</p>
      </div>
    </>
  );
}
