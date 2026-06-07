"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Lenis smooth-scroll. Mount once on a page (renders nothing). Drives real window
 * scroll with eased momentum so the page glides — and so Framer Motion's
 * useScroll picks it up for scroll-scrubbed sections.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lenis: Lenis | null = null;
    let raf = 0;
    try {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      const inst = lenis;
      const loop = (time: number) => {
        inst.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      // Smooth scroll is an enhancement — never let it break the page.
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  return null;
}
