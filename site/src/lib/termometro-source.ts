import fallback from "@/config/termometro.json";
import { estadoHuelga, type EstadoHuelga } from "@/lib/huelga";
import { parseDATA, parseHorquilla, type Horquilla } from "@/lib/dashboard-parse";

export type { Horquilla, PuntoHorquilla } from "@/lib/dashboard-parse";

/**
 * Fuente del termómetro — Opción 2: el SERVIDOR baja el dashboard y lo cachea; el
 * navegador del visitante NO contacta con el tercero (se mantiene la promesa de "sin
 * recursos de terceros"). Next revalida cada hora, así que se ve fresco sin scraping
 * por visita. Si la descarga o el parseo fallan, se sirve el último snapshot bueno
 * versionado en el repo (config/termometro.json) — nunca una página rota.
 *
 * Incluye riesgo y sentimiento por decisión de Carlos.
 *
 * ⚠️ CAMBIO DE POSTURA (09-ago-2026, decisión de Carlos): se INCLUYE la horquilla de
 * impacto económico a la empresa (el "punto de ruptura"), que hasta ahora se excluía a
 * propósito y vivía solo en el dashboard enlazado. Sigue fuera la cotización. La horquilla
 * es una ESTIMACIÓN por escenarios de un tercero independiente, no una cifra de Airbus:
 * la web debe decirlo cada vez que la enseñe.
 */

const FUENTE = "https://airbus-huelga.github.io/dashboard/";
const REVALIDAR_S = 3600; // 1 h

export type Noticia = {
  titulo: string;
  medio: string;
  url: string;
  fecha: string | null;
  imagen: string | null;
  sent?: string | null;
  score?: number | null;
  razon?: string | null;
};

export type TermometroSnapshot = {
  fuente: string;
  origenActualizado: string | null;
  capturado: string;
  huelga: EstadoHuelga | null;
  kpi: { hoy: number | null; ayer: number | null; total: number | null; medios: number | null };
  riesgo: { nivel: string | null } | null;
  sentimiento: {
    positivo: number;
    neutro: number;
    negativo: number;
    pctNegativo: number | null;
  } | null;
  volumen: { dia: string; n: number }[];
  horquilla: Horquilla | null;
  impacto: Noticia[];
  cronologico: Noticia[];
  social: {
    telegram: number | null;
    telegramGrupo: string | null;
    mastodon: number | null;
    xPosts: number | null;
    xIdiomas: number | null;
    xActualizado: string | null;
    nota: string | null;
  } | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function noticia(t: any): Noticia {
  return { titulo: t.titulo, medio: t.medio, url: t.url, fecha: t.fecha_iso ?? null, imagen: t.imagen || null };
}

function toSnapshot(D: any, html?: string): TermometroSnapshot {
  const tg = Array.isArray(D.telegram) ? D.telegram.reduce((a: number, g: any) => a + (g.total_mensajes ?? 0), 0) : null;
  const md = Array.isArray(D.mastodon) ? D.mastodon.reduce((a: number, h: any) => a + (h.n ?? 0), 0) : null;
  return {
    fuente: FUENTE,
    origenActualizado: D.updated_iso ?? null,
    capturado: new Date().toISOString(),
    huelga: estadoHuelga(D.updated_iso ?? null),
    kpi: {
      hoy: D.kpi?.hoy ?? null,
      ayer: D.kpi?.ayer ?? null,
      total: D.kpi?.total ?? null,
      medios: D.kpi?.medios ?? null,
    },
    riesgo: D.riesgo ? { nivel: D.riesgo.nivel ?? null } : null,
    sentimiento: D.sentimiento
      ? { positivo: D.sentimiento.positivo ?? 0, neutro: D.sentimiento.neutro ?? 0, negativo: D.sentimiento.negativo ?? 0, pctNegativo: D.sentimiento.pct_negativo ?? null }
      : null,
    volumen: Array.isArray(D.volumen) ? D.volumen.map((v: any) => ({ dia: v.dia, n: v.n })) : [],
    horquilla: parseHorquilla(D, html),
    impacto: Array.isArray(D.top_impacto)
      ? D.top_impacto.slice(0, 6).map((t: any) => ({ ...noticia(t), score: t.score ?? null, razon: t.razon ?? null }))
      : [],
    // 30 y no 80: la lista se navega de 6 en 6, así que 80 eran 14 páginas que casi nadie
    // abre y sí pesaban en el HTML de la portada (medido en producción).
    cronologico: Array.isArray(D.feed)
      ? [...D.feed]
          .sort((a: any, b: any) => String(b.fecha_iso).localeCompare(String(a.fecha_iso)))
          .slice(0, 30)
          .map((t: any) => ({ ...noticia(t), sent: t.sent_label ?? null }))
      : [],
    social: {
      telegram: tg,
      telegramGrupo: D.telegram?.[0]?.grupo ?? null,
      mastodon: md,
      xPosts: D.x_total_posts ?? null,
      xIdiomas: D.x_total_idiomas ?? null,
      xActualizado: D.x_actualizado ?? null,
      nota: D.x_linkedin_note ?? null,
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Datos del termómetro: en vivo del servidor (revalidado 1 h) con fallback al snapshot. */
export async function getTermometro(): Promise<{ data: TermometroSnapshot; enVivo: boolean }> {
  try {
    const res = await fetch(FUENTE, { next: { revalidate: REVALIDAR_S } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const data = toSnapshot(parseDATA(html), html);
    // El centinela mira el cronológico, no el desaparecido `top5`: la comprobación debe
    // pinchar sobre datos que la página realmente enseña, o deja de avisar de lo que importa.
    if (!data.kpi.total && data.cronologico.length === 0) throw new Error("vacío");
    return { data, enVivo: true };
  } catch {
    // Último snapshot bueno del repo. La página nunca se rompe por el tercero.
    const data = fallback as unknown as TermometroSnapshot;
    // El estado de la huelga depende de HOY, no de cuándo se congeló el snapshot.
    return { data: { ...data, huelga: estadoHuelga(Date.now()) }, enVivo: false };
  }
}
