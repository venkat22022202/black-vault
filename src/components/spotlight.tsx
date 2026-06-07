"use client";

import { useEffect, useRef } from "react";

/**
 * A soft neon light that follows the cursor (spring-lerped). Uses mix-blend
 * screen so it only *adds* light to the dark UI — never washes out text.
 * Hover-gated + disabled under reduced motion (decorative only).
 */
export default function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.3;
    let cx = tx, cy = ty, raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const loop = () => {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      el.style.setProperty("--x", `${cx.toFixed(0)}px`);
      el.style.setProperty("--y", `${cy.toFixed(0)}px`);
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
      style={{
        mixBlendMode: "screen",
        background:
          "radial-gradient(600px circle at var(--x, 50%) var(--y, 30%), rgba(0,255,136,0.07), transparent 42%)",
      }}
    />
  );
}
