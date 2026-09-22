/**
 * Snapshot del termómetro de la huelga.
 *
 * Baja el dashboard de un tercero (airbus-huelga.github.io), le extrae SOLO los campos
 * neutros y los congela en src/config/termometro.json, versionado en el repo.
 *
 * Por qué snapshot y no fetch en vivo: la web de la caja no debe llamar a un tercero en
 * cada visita (rompe su promesa de "sin recursos de terceros sin consentimiento") ni
 * depender de una página ajena que no controlamos. El JSON en el repo es la fuente de
 * verdad; se refresca corriendo esto y redesplegando:  npm run snapshot:termometro
 *
 * Incluye riesgo y sentimiento por decisión expresa de Carlos (registro adversarial:
 * cambia la postura de la página, es su decisión registrada). Desde el 09-ago-2026
 * incluye también la HORQUILLA de impacto a la empresa (ver termometro-source.ts); sigue
 * fuera la cotización.
 *
 * El parseo y el calendario del conflicto NO se duplican aquí: salen de
 * src/lib/dashboard-parse.ts y src/lib/huelga.ts, los mismos que usa la web.
 *
 * Robusto: si la descarga o el parseo fallan, NO sobrescribe el snapshot anterior.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDATA, parseHorquilla } from "../src/lib/dashboard-parse.ts";
import { estadoHuelga } from "../src/lib/huelga.ts";

const FUENTE = "https://airbus-huelga.github.io/dashboard/";
const DESTINO = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "config", "termometro.json");

try {
  const res = await fetch(FUENTE, { headers: { "User-Agent": "caja-resistencia-snapshot" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const D = parseDATA(html);

  const noticia = (t) => ({
    titulo: t.titulo,
    medio: t.medio,
    url: t.url,
    fecha: t.fecha_iso ?? null,
    imagen: t.imagen || null,
  });

  // Suma de mensajes de los grupos de Telegram.
  const telegramTotal = Array.isArray(D.telegram)
    ? D.telegram.reduce((a, g) => a + (g.total_mensajes ?? 0), 0)
    : null;
  const mastodonTotal = Array.isArray(D.mastodon)
    ? D.mastodon.reduce((a, h) => a + (h.n ?? 0), 0)
    : null;

  const snapshot = {
    fuente: FUENTE,
    origenActualizado: D.updated_iso ?? null,
    capturado: new Date().toISOString(),
    huelga: estadoHuelga(D.updated_iso ?? new Date().toISOString()),
    kpi: {
      hoy: D.kpi?.hoy ?? null,
      ayer: D.kpi?.ayer ?? null,
      total: D.kpi?.total ?? null,
      medios: D.kpi?.medios ?? null,
    },
    // Riesgo y sentimiento: por decisión de Carlos. `detalle` del origen dice "retrata
    // mal a la empresa"; NO lo copiamos — el texto lo pone la web (dict) desde pct, para
    // controlar el tono. Aquí solo el dato numérico y el nivel.
    riesgo: D.riesgo ? { nivel: D.riesgo.nivel ?? null } : null,
    sentimiento: D.sentimiento
      ? {
          positivo: D.sentimiento.positivo ?? 0,
          neutro: D.sentimiento.neutro ?? 0,
          negativo: D.sentimiento.negativo ?? 0,
          pctNegativo: D.sentimiento.pct_negativo ?? null,
        }
      : null,
    // serie de volumen (nº de artículos/día): cobertura, no opinión
    volumen: Array.isArray(D.volumen)
      ? D.volumen.map((v) => ({ dia: v.dia, n: v.n }))
      : [],
    // horquilla mín-máx del impacto acumulado a la empresa (estimación de escenarios)
    horquilla: parseHorquilla(D, html),
    // Ya no se congela el `top5` del origen: la tira de «últimos titulares» que lo enseñaba
    // se retiró el 10-ago-2026 por duplicar las primeras del cronológico.
    // noticias de mayor impacto (con score y motivo del dashboard)
    impacto: Array.isArray(D.top_impacto)
      ? D.top_impacto.slice(0, 6).map((t) => ({ ...noticia(t), score: t.score ?? null, razon: t.razon ?? null }))
      : [],
    // cronológico: el feed ordenado por fecha desc; acotado para no inflar la página
    cronologico: Array.isArray(D.feed)
      ? [...D.feed]
          .sort((a, b) => String(b.fecha_iso).localeCompare(String(a.fecha_iso)))
          .slice(0, 80)
          .map((t) => ({ ...noticia(t), sent: t.sent_label ?? null }))
      : [],
    // resumen social (volumen de actividad; la nota honesta sobre LinkedIn/IG va tal cual)
    social: {
      telegram: telegramTotal,
      telegramGrupo: D.telegram?.[0]?.grupo ?? null,
      mastodon: mastodonTotal,
      xPosts: D.x_total_posts ?? null,
      xIdiomas: D.x_total_idiomas ?? null,
      xActualizado: D.x_actualizado ?? null,
      nota: D.x_linkedin_note ?? null,
    },
  };

  if (!snapshot.kpi.total && snapshot.cronologico.length === 0) {
    throw new Error("el snapshot saldría vacío; no se sobrescribe");
  }

  const antes = existsSync(DESTINO) ? readFileSync(DESTINO, "utf8") : null;
  const nuevo = JSON.stringify(snapshot, null, 2) + "\n";
  writeFileSync(DESTINO, nuevo);
  console.log(
    `✓ snapshot escrito (${DESTINO})\n` +
      `  origen actualizado: ${snapshot.origenActualizado}\n` +
      `  huelga: ${JSON.stringify(snapshot.huelga)} · ` +
      `horquilla ${snapshot.horquilla?.serie.length ?? 0} días · ` +
      `${snapshot.kpi.total} artículos · ${snapshot.kpi.medios} medios · ` +
      `riesgo ${snapshot.riesgo?.nivel} · sent -${snapshot.sentimiento?.pctNegativo}% · ` +
      `${snapshot.impacto.length} impacto · ${snapshot.cronologico.length} cronológico` +
      (antes === nuevo ? "\n  (sin cambios respecto al anterior)" : ""),
  );
} catch (e) {
  console.error(`✗ no se pudo actualizar el snapshot: ${e.message}`);
  console.error("  se conserva el snapshot anterior (si existía). No se toca nada.");
  process.exit(1);
}
