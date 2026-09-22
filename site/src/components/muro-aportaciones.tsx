"use client";
import * as React from "react";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { EASE } from "@/components/motion";

/**
 * Muro de aportaciones — elemento de firma de ESTA marca (no del craft base).
 * Cada unidad = una aportación; juntas construyen la caja (resistencia colectiva).
 * Stagger propio y rápido (el `Stagger` firma es para pocos ítems); reuso del
 * easing firma. Reduced-motion → retícula estática (todo visible al instante).
 */
const TOTAL = 84;
// Unidades marcadas en rojo (acento), repartidas sin urgencia ni cifra inventada.
const ACCENTS = new Set([9, 17, 26, 38, 41, 53, 60, 72, 77]);

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.014, delayChildren: 0.03 } },
};
const unit: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } },
};

export function MuroAportaciones({ ariaLabel }: { ariaLabel: string }) {
  const reduce = useReducedMotion();

  const cells = Array.from({ length: TOTAL }, (_, i) => (
    <span key={i} className="muro-unit" data-accent={ACCENTS.has(i) ? "true" : undefined} />
  ));

  if (reduce) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1.5"
      >
        {cells}
      </div>
    );
  }

  return (
    <m.div
      role="img"
      aria-label={ariaLabel}
      className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1.5"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {Array.from({ length: TOTAL }, (_, i) => (
        <m.span
          key={i}
          variants={unit}
          className="muro-unit"
          data-accent={ACCENTS.has(i) ? "true" : undefined}
        />
      ))}
    </m.div>
  );
}
