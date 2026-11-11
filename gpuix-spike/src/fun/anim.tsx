// Small animation helpers for the celebration / toast / card ports. GPUIX has no
// transforms, so translate and scale are rebuilt from the motion-able properties
// (width/height/top/left/opacity): see Rise, Pop and bake.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImgInstance } from "@gpuix/react";
import type { MotionEase, MotionStyle, StyleDesc } from "@gpuix/react";
import { EASE_OUT_STRONG, Icon as BaseIcon, registerIcon, useKeyframes, type Frame } from "../ui";

export { EASE_OUT_STRONG, useKeyframes };
export const EASE_BOUNCE: MotionEase = [0.34, 1.56, 0.64, 1];

/** Register a lucide component (what cards.ts hands us) as an <Icon>, once. It is a
 *  forwardRef whose render returns <Icon icon={data}/>, so the geometry is one call away. */
export function lucide(C: unknown, strokeWidth = 2): string {
  const c = C as { displayName?: string; render: (p: object, r: null) => { props: { icon: { node: never } } } };
  const name = c.displayName ?? "icon";
  const key = `${name}@${strokeWidth}`;
  if (!registered.has(key)) { registerIcon(name, c.render({}, null).props.icon, strokeWidth); registered.add(key); }
  return name;
}
const registered = new Set<string>();
export const LIcon = ({ C, size = 16, color, strokeWidth = 2 }: { C: unknown; size?: number; color: string; strokeWidth?: number }) =>
  <BaseIcon name={lucide(C, strokeWidth)} size={size} color={color} strokeWidth={strokeWidth} />;

/** `color-mix(in srgb, a pa%, b)` for opaque-or-not rgba strings. */
export function mix(a: string, b: string, pa: number) {
  const p = (s: string) => { const m = s.match(/[\d.]+/g)!.map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const [x, y] = [p(a), p(b)];
  return `rgba(${[0, 1, 2].map((i) => Math.round(x[i] * pa + y[i] * (1 - pa))).join(",")},${+(x[3] * pa + y[3] * (1 - pa)).toFixed(3)})`;
}
/** Same colour, alpha scaled (`color-mix(c N%, transparent)`). */
export const alpha = (c: string, k: number) => {
  const m = c.match(/[\d.]+/g)!.map(Number);
  return `rgba(${m[0]},${m[1]},${m[2]},${+((m[3] ?? 1) * k).toFixed(3)})`;
};
/** CSS `letter-spacing` is missing: a hair space between letters is the nearest thing. */
export const track = (s: string) => [...s].join(" ");

// --- cubic-bezier, for baking CSS keyframes whose easing GPUIX can't take per property ---
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = ((ax * t + bx) * t + cx) * t - x; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; }
    return ((ay * t + by) * t + cy) * t;
  };
}
/** Sample `at(progress)` into `n` linear segments over `ms`: any CSS timeline as Frames. */
export function bake(n: number, at: (p: number) => MotionStyle): Frame[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ at: i / n, style: at(i / n), ease: "linear" as MotionEase }));
}

/** true once `ms` have passed (never true if `ms` is Infinity). */
export function useAfter(ms: number) {
  const [on, set] = useState(ms <= 0);
  useEffect(() => { if (ms <= 0 || !isFinite(ms)) return; const t = setTimeout(() => { set(true); }, ms); return () => clearTimeout(t); }, []);
  return on;
}

/** A box scaled `s` about its centre, as left/top/width/height. */
export const around = (cx: number, cy: number, w: number, h: number, s: number) => ({ left: cx - (w * s) / 2, top: cy - (h * s) / 2, width: w * s, height: h * s });

/**
 * `gg-rise`: fade in while moving up `dy` (and optionally growing from `s0` of its
 * width `w`). translateY is a `top` offset on a relatively positioned box, which
 * leaves the layout footprint alone, as a transform does.
 */
export function Rise({ d = 0, dy = 14, dur = 420, ease = EASE_OUT_STRONG, w, s0 = 1, children, style }: {
  d?: number; dy?: number; dur?: number; ease?: MotionEase; w?: number; s0?: number; children: ReactNode; style?: StyleDesc;
}) {
  const transition = { duration: dur / 1000, delay: d / 1000, ease };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: w ?? "100%", flexShrink: 0, ...style }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: w ? w * s0 : "100%" }}
        motion={{ initial: { top: dy, opacity: 0, ...(w ? { width: w * s0 } : {}) }, animate: { top: 0, opacity: 1, ...(w ? { width: w } : {}) }, transition }}>
        {children}
      </div>
    </div>
  );
}

/** Interval-driven counter (no requestAnimationFrame in Bun). `step(p)` → value. */
export function useTween(ms: number, delay: number, ease: (p: number) => number) {
  const [p, setP] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const start = performance.now() + delay;
    const id = setInterval(() => {
      const q = Math.min(1, Math.max(0, (performance.now() - start) / ms));
      setP(ease(q));
      if (q >= 1 && !done.current) { done.current = true; clearInterval(id); }
    }, 16);
    return () => clearInterval(id);
  }, []);
  return p;
}

/** setImagePixels is a synchronous round-trip to the render thread; called in the commit that
 *  creates the <img> it can time out. Deferring a beat (and retrying once) avoids that. */
export function useImagePixels(build: () => [number, number, Uint8Array], deps: unknown[]) {
  const ref = useRef<ImgInstance>(null);
  useEffect(() => {
    let id = setTimeout(function put(left = 1) {
      try { const [w, h, px] = build(); ref.current?.setImagePixels(w, h, px); }
      catch (e) { if (left > 0) id = setTimeout(() => put(left - 1), 200); else console.log("setImagePixels failed", e); }
    }, 30);
    return () => clearTimeout(id);
  }, deps);
  return ref;
}
