"use client";
import * as React from "react";
import { LazyMotion, domAnimation } from "framer-motion";

/**
 * Loads only the `domAnimation` feature set (animations, variants, exit,
 * hover/tap/focus/in-view gestures) and pairs it with the lightweight `m`
 * components used across the site. This drops the drag / pan / layout-animation
 * code we never use from the initial bundle. `strict` makes any stray full
 * `motion.*` component throw, so we can't accidentally pull the heavy bundle.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
