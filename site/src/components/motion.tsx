"use client";
import * as React from "react";
import {
  m,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion";

/* ------------------------------------------------------------------ *
 * One motion language for the whole site. Shared easing + timing are
 * what make the interactions feel intentional (expensive) rather than
 * a pile of unrelated effects. Every primitive is reduced-motion aware.
 * ------------------------------------------------------------------ */

/** Signature entrance easing — a soft expo-out. Editorial, unhurried. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Snappier easing for exits / hovers. */
export const EASE_SOFT: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export const VIEWPORT = { once: true, margin: "0px 0px -10% 0px" } as const;

/* ---------------- MaskText: lines rise from behind a clip ---------------- */

type MaskTextProps = {
  /** A single line, or several lines revealed in sequence. */
  lines: string | string[];
  className?: string;
  /** Extra delay before the first line (seconds). */
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  /** Play on mount instead of on scroll-into-view (use for above-the-fold). */
  immediate?: boolean;
};

/**
 * Reveals type by wiping each line up from behind an overflow mask.
 * The signature "expensive" move — replaces block fade-up on headlines.
 */
export function MaskText({
  lines,
  className,
  delay = 0,
  as = "h2",
  immediate = false,
}: MaskTextProps) {
  const reduce = useReducedMotion();
  const rows = Array.isArray(lines) ? lines : [lines];
  const Tag = m[as] as React.ElementType;
  const PlainTag = as as React.ElementType;

  if (reduce) {
    return (
      <PlainTag className={className}>
        {rows.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </PlainTag>
    );
  }

  // Above-the-fold: CSS-driven reveal so the (LCP) text paints on first render
  // without waiting for JS hydration. Pure markup + CSS, no framer-m.
  if (immediate) {
    return (
      <PlainTag className={className}>
        {rows.map((line, i) => (
          <span key={i} className="block overflow-hidden pb-[0.06em]">
            <span
              className="mask-rise block"
              style={{ animationDelay: `${(delay + i * 0.09).toFixed(2)}s` }}
            >
              {line}
            </span>
          </span>
        ))}
      </PlainTag>
    );
  }

  // Below-the-fold: reveal on scroll. The trigger lives on the (untransformed)
  // outer wrapper so its IntersectionObserver reports reliably; the inner line
  // animates via variant propagation.
  return (
    <Tag className={className}>
      {rows.map((line, i) => (
        <m.span
          key={i}
          className="block overflow-hidden pb-[0.06em]"
          variants={{ hidden: {}, show: {} }}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
        >
          <m.span
            className="block"
            variants={{
              hidden: { y: "115%" },
              show: {
                y: "0%",
                transition: { duration: 0.85, ease: EASE, delay: delay + i * 0.09 },
              },
            }}
          >
            {line}
          </m.span>
        </m.span>
      ))}
    </Tag>
  );
}

/* ---------------- Rise: refined single-element reveal ---------------- */

export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

/* ---------------- Stagger: children arrive in sequence ---------------- */

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div className={className} variants={staggerChild}>
      {children}
    </m.div>
  );
}

/* ---------------- Curtain: media revealed by a clip wipe ---------------- */

export function Curtain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      style={{ overflow: "hidden" }}
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={VIEWPORT}
      transition={{ duration: 1, ease: EASE }}
    >
      <m.div
        className="h-full w-full"
        initial={{ scale: 1.16 }}
        whileInView={{ scale: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 1.15, ease: EASE }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

/* ---------------- MagneticButton: cursor-weighted CTA ---------------- */

export function MagneticButton({
  href,
  children,
  className,
  strength = 0.28,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLAnchorElement>(null);
  const x = useSpring(0, { stiffness: 150, damping: 14, mass: 0.12 });
  const y = useSpring(0, { stiffness: 150, damping: 14, mass: 0.12 });

  // Fine-pointer capability sin setState-en-efecto (SSR → false). Solo el ratón
  // recibe el tirón magnético; nunca el táctil. (PILOT-FIX-001)
  const finePointer = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(pointer: fine)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: fine)").matches,
    () => false,
  );
  const enabled = finePointer && !reduce;

  const onMove = (e: React.MouseEvent) => {
    if (!enabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <m.a
      ref={ref}
      href={href}
      className={className}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={reset}
    >
      {children}
    </m.a>
  );
}
