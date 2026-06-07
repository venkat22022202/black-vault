"use client";

import { useEffect, useRef } from "react";

/**
 * Spring-physics 3D tilt + cursor-tracked glare (Emil Kowalski playbook):
 * - decorative spring (rAF lerp toward target) so it feels alive, not artificial
 * - GPU-only transform; no layout
 * - hover-gated (hover:hover + pointer:fine) so touch devices don't false-trigger
 * - disabled under prefers-reduced-motion
 */
export default function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const card = inner.current;
    if (!el || !card || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let tX = 0, tY = 0, cX = 0, cY = 0; // target/current rotation
    let tGX = 50, tGY = 50, cGX = 50, cGY = 50; // target/current glare position (%)
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tY = (px - 0.5) * max * 2;
      tX = (0.5 - py) * max * 2;
      tGX = px * 100;
      tGY = py * 100;
    };
    const onLeave = () => {
      tX = 0; tY = 0; tGX = 50; tGY = 50;
    };
    const loop = () => {
      cX += (tX - cX) * 0.12;
      cY += (tY - cY) * 0.12;
      cGX += (tGX - cGX) * 0.12;
      cGY += (tGY - cGY) * 0.12;
      card.style.transform = `perspective(1000px) rotateX(${cX.toFixed(2)}deg) rotateY(${cY.toFixed(2)}deg)`;
      card.style.setProperty("--gx", `${cGX.toFixed(1)}%`);
      card.style.setProperty("--gy", `${cGY.toFixed(1)}%`);
      raf = requestAnimationFrame(loop);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [max]);

  return (
    <div ref={wrap} className={className} style={{ perspective: "1000px" }}>
      <div ref={inner} className="relative will-change-transform" style={{ transformStyle: "preserve-3d" }}>
        {children}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "radial-gradient(480px circle at var(--gx,50%) var(--gy,50%), rgba(0,255,136,0.14), transparent 45%)",
          }}
        />
      </div>
    </div>
  );
}
