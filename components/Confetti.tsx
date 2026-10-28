"use client";

import { useEffect, useRef } from "react";
import { useHoliday } from "@/components/HolidayProvider";

const FALLBACK = ["#FF5A5F", "#FFD23F", "#2EC4B6", "#4CC9F0", "#E63E9B", "#8E7CFF", "#B8F34A", "#FF9F1C"];

interface Piece {
  x: number; y: number; vx: number; vy: number; g: number; r: number;
  rot: number; vr: number; color: string; kind: "rect" | "dot" | "glyph"; glyph: string;
}

/**
 * Canvas confetti, no library, in the active holiday's colors with a few holiday glyphs mixed in.
 * Changing `burst` to a new non-zero number fires one burst (`big` for the winner moment).
 * Skipped when the viewer prefers reduced motion.
 */
export function Confetti({ burst, big = false }: { burst: number; big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { holiday } = useHoliday();

  useEffect(() => {
    if (!burst) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const css = getComputedStyle(canvas);
    const themed = ["--sun", "--tomato", "--mint", "--sky", "--pink"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
    const colors = themed.length >= 3 ? [...themed, "#ffffff"] : FALLBACK;
    const glyphs = holiday.glyphs;

    const dpr = window.devicePixelRatio || 1;
    const W = (canvas.width = Math.floor(window.innerWidth * dpr));
    const H = (canvas.height = Math.floor(window.innerHeight * dpr));
    const n = big ? 240 : 80;
    const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
      const glyph = glyphs.length && i % 6 === 0;
      return {
        x: W / 2 + (Math.random() - 0.5) * W * (big ? 0.35 : 0.12),
        y: H * (big ? 0.38 : 0.62),
        vx: (Math.random() - 0.5) * (big ? 28 : 13) * dpr,
        vy: (-Math.random() * (big ? 26 : 15) - 4) * dpr,
        g: 0.55 * dpr,
        r: (glyph ? 15 + Math.random() * 10 : 4 + Math.random() * 7) * dpr,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.45,
        color: colors[i % colors.length],
        kind: glyph ? "glyph" : Math.random() < 0.3 ? "dot" : "rect",
        glyph: glyph ? glyphs[i % glyphs.length] : "",
      };
    });

    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of pieces) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.992;
        p.rot += p.vr;
        if (p.y > H + 40 * dpr) continue;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === "glyph") {
          ctx.font = `${p.r}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.glyph, 0, 0);
        } else if (p.kind === "dot") {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 1.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r / 1.6);
        }
        ctx.restore();
      }
      if (alive > 0 && now - started < 6000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst, big, holiday]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
