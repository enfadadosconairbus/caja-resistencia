"use client";
import * as React from "react";
import type { Horquilla as Datos, PuntoHorquilla } from "@/lib/dashboard-parse";
import { eurosCorto, fechaES } from "@/lib/formato";

/**
 * Banda mín–máx del impacto acumulado, con lectura al pasar el ratón.
 *
 * Es cliente solo por la interacción: la banda, los ejes y las etiquetas se pintan en
 * servidor igual, así que sin JavaScript el gráfico se ve entero y sigue siendo legible —
 * lo único que se pierde es la guía que sigue al cursor.
 */

const W = 720, H = 260, PAD_L = 62, PAD_R = 10, PAD_T = 12, PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function GraficaHorquilla({
  datos,
  lang,
  etiquetaHoy,
  ejeAria,
}: {
  datos: Datos;
  lang: string;
  etiquetaHoy: string;
  ejeAria: string;
}) {
  const serie = datos.serie;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [i, setI] = React.useState<number | null>(null);

  const max = Math.max(...serie.map((p) => p.maxAcum)) * 1.06 || 1;
  const x = (k: number) => PAD_L + (k / Math.max(1, serie.length - 1)) * PLOT_W;
  const y = (v: number) => PAD_T + PLOT_H - (v / max) * PLOT_H;

  let iHoy = serie.findIndex((p) => p.proyeccion) - 1;
  if (iHoy < 0) iHoy = serie.length - 1;

  const tramo = (desde: number, hasta: number) => serie.slice(desde, hasta + 1);
  const linea = (pts: PuntoHorquilla[], desde: number, campo: "minAcum" | "maxAcum") =>
    pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(desde + k).toFixed(1)},${y(p[campo]).toFixed(1)}`).join(" ");
  const area = (pts: PuntoHorquilla[], desde: number) =>
    `${linea(pts, desde, "maxAcum")} ` +
    pts.map((_, k) => {
      const j = pts.length - 1 - k;
      return `L${x(desde + j).toFixed(1)},${y(pts[j].minAcum).toFixed(1)}`;
    }).join(" ") + " Z";

  const obs = tramo(0, iHoy);
  const proy = iHoy < serie.length - 1 ? tramo(iHoy, serie.length - 1) : [];
  const ticks = [0, max / 2, max];
  const etiquetasX = [0, iHoy, serie.length - 1].filter((v, k, a) => a.indexOf(v) === k);

  /** Índice del punto más cercano al cursor, en coordenadas del SVG. */
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || serie.length < 2) return;
    const caja = svg.getBoundingClientRect();
    const px = ((e.clientX - caja.left) / caja.width) * W;
    const k = Math.round(((px - PAD_L) / PLOT_W) * (serie.length - 1));
    setI(Math.max(0, Math.min(serie.length - 1, k)));
  };

  const activo = i != null ? serie[i] : null;
  // La etiqueta se pega al lado contrario del cursor cuando se acerca al borde derecho.
  const etiquetaDerecha = i != null && x(i) > PAD_L + PLOT_W * 0.62;

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={`${ejeAria} ${eurosCorto(serie[0].minAcum, lang)} – ${eurosCorto(serie[serie.length - 1].maxAcum, lang)}.`}
        onPointerMove={alMover}
        onPointerLeave={() => setI(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--color-linea)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" fontFamily="var(--ff-mono)" fontSize={9} fill="var(--color-tinta-suave)">
              {eurosCorto(v, lang)}
            </text>
          </g>
        ))}

        {proy.length ? (
          <>
            <path d={area(proy, iHoy)} fill="var(--color-acento-tinta)" opacity={0.09} />
            <path d={linea(proy, iHoy, "maxAcum")} fill="none" stroke="var(--color-acento-tinta)" strokeWidth={1.6} strokeDasharray="4 3" opacity={0.75} />
            <path d={linea(proy, iHoy, "minAcum")} fill="none" stroke="var(--color-acento-tinta)" strokeWidth={1.6} strokeDasharray="4 3" opacity={0.75} />
          </>
        ) : null}

        <path d={area(obs, 0)} fill="var(--color-acento-tinta)" opacity={0.2} />
        <path d={linea(obs, 0, "maxAcum")} fill="none" stroke="var(--color-acento-tinta)" strokeWidth={1.8} strokeLinejoin="round" />
        <path d={linea(obs, 0, "minAcum")} fill="none" stroke="var(--color-acento-tinta)" strokeWidth={1.8} strokeLinejoin="round" />

        {proy.length ? (
          <>
            <line x1={x(iHoy)} y1={PAD_T} x2={x(iHoy)} y2={PAD_T + PLOT_H} stroke="var(--color-tinta-suave)" strokeWidth={1} strokeDasharray="2 3" />
            <text x={x(iHoy) + 4} y={PAD_T + 9} fontFamily="var(--ff-mono)" fontSize={9} fill="var(--color-tinta-suave)">
              {etiquetaHoy}
            </text>
          </>
        ) : null}

        {etiquetasX.map((k) => (
          <text
            key={k}
            x={x(k)}
            y={H - 8}
            textAnchor={k === 0 ? "start" : k === serie.length - 1 ? "end" : "middle"}
            fontFamily="var(--ff-mono)"
            fontSize={9}
            fill="var(--color-tinta-suave)"
          >
            {fechaES(serie[k].dia, lang, { day: "2-digit", month: "short" })}
          </text>
        ))}

        {/* ── Lectura bajo el cursor ── */}
        {activo && i != null ? (
          <g pointerEvents="none">
            <line x1={x(i)} y1={PAD_T} x2={x(i)} y2={PAD_T + PLOT_H} stroke="var(--color-tinta)" strokeWidth={1} opacity={0.55} />
            <circle cx={x(i)} cy={y(activo.maxAcum)} r={3.5} fill="var(--color-acento-tinta)" />
            <circle cx={x(i)} cy={y(activo.minAcum)} r={3.5} fill="var(--color-acento-tinta)" />
            <g transform={`translate(${etiquetaDerecha ? x(i) - 154 : x(i) + 8}, ${PAD_T + 4})`}>
              <rect width={146} height={44} rx={4} fill="var(--color-fondo)" stroke="var(--color-linea)" />
              <text x={8} y={16} fontFamily="var(--ff-mono)" fontSize={10} fill="var(--color-tinta-suave)">
                {fechaES(activo.dia, lang, { day: "numeric", month: "long" })}
              </text>
              <text x={8} y={33} fontFamily="var(--ff-mono)" fontSize={12} fontWeight={600} fill="var(--color-tinta)">
                {eurosCorto(activo.minAcum, lang)}–{eurosCorto(activo.maxAcum, lang)}
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
