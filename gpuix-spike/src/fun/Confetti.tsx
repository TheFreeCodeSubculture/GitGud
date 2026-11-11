// Port of lib/celebrate.ts `cannons`. canvas-confetti's physics (randomPhysics /
// updateFetti, copied from node_modules/canvas-confetti) run unchanged; instead of a
// <canvas>, particles are software-rasterised into ONE RGBA buffer that is pushed to a
// single full-window <img> per tick. That keeps the node count at 1 for any particle
// count, and rotation/flutter come for free (GPUIX has no transforms).
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "@gpuix/react";
import type { ImgInstance } from "@gpuix/react";

const COLORS = ["#ff4f64", "#ff8a00", "#ffd60a", "#ff5db1", "#9b6dff", "#5b8cff", "#31c5f4", "#72d572"]
  .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const PIECES = 320, WAVES = 9, SPREAD_MS = 450;
const TPS = 60; // canvas-confetti ticks once per animation frame
const S = Number(process.env.GG_CONFETTI_SCALE ?? 1.25); // raster pixels per logical px

// path shape "M0 -6 L6 6 L-6 6 Z" after shapeFromPath's own normalisation matrix
// (it only samples x,y >= 0, so the triangle ends up off-centre: scale 10/6, shift -5).
const TRI: [number, number][] = [[-5, -15], [5, 5], [-15, 5]];

interface P {
  x: number; y: number; wobble: number; wobbleSpeed: number; velocity: number; angle2D: number; tiltAngle: number;
  c: number[]; shape: 0 | 1 | 2; tick: number; total: number; decay: number; gravity: number;
}

let W = 1200, H = 820;
let parts: P[] = [];
let wake: (() => void) | null = null;

/** The speed whose arc peaks half a window up (celebrate.ts `startVelocity`). */
function startVelocity(decay: number, gravity: number) {
  const sin = Math.sin((67.5 * Math.PI) / 180);
  const peak = (v: number) => { let y = 0; for (let dy = sin * v - gravity * 3; dy > 0; v *= decay, dy = sin * v - gravity * 3) y += dy; return y; };
  let lo = 1, hi = 400;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (peak(mid) < H * 0.5) lo = mid; else hi = mid; }
  return lo;
}

function burst(count: number, angleDeg: number, ox: number, sv: number) {
  const spread = (90 * Math.PI) / 180, ang = (angleDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) parts.push({
    x: ox * W, y: H, wobble: Math.random() * 10, wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
    velocity: sv * 0.5 + Math.random() * sv, angle2D: -ang + (0.5 * spread - Math.random() * spread),
    tiltAngle: (Math.random() * 0.5 + 0.25) * Math.PI, c: COLORS[i % COLORS.length], shape: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    tick: 0, total: 320, decay: 0.93, gravity: 1.25 * 3,
  });
}

/** Both corner cannons at once. `scale` > 1 for the bigger moments. */
export function cannons(scale = 1) {
  const sv = startVelocity(0.93, 1.25);
  const perWave = Math.round((PIECES * scale) / 2 / WAVES);
  for (let w = 0; w < WAVES; w++) setTimeout(() => {
    burst(perWave, 45, 0, sv); burst(perWave, 135, 1, sv);
    wake?.();
  }, w === 0 ? 0 : Math.random() * SPREAD_MS);
}

// --- raster ------------------------------------------------------------------
let buf: Uint8ClampedArray, bw = 0, bh = 0;

function span(y: number, x0: number, x1: number, c: number[], a: number) {
  y = Math.round(y); if (y < 0 || y >= bh) return;
  x0 = Math.max(0, Math.round(x0)); x1 = Math.min(bw - 1, Math.round(x1));
  for (let x = x0; x <= x1; x++) put(y * bw + x, c, a);
}
function put(p: number, c: number[], a: number) {
  const i = p * 4, da = buf[i + 3] / 255;
  if (da === 0) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a * 255; return; }
  const oa = a + da * (1 - a);
  for (let k = 0; k < 3; k++) buf[i + k] = (c[k] * a + buf[i + k] * da * (1 - a)) / oa;
  buf[i + 3] = oa * 255;
}
/** Convex polygon, scanline, vertices already in raster px. */
function poly(v: number[][], c: number[], a: number) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of v) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(bh - 1, Math.floor(y1 - 0.5)); y++) {
    const yc = y + 0.5; let xl = Infinity, xr = -Infinity;
    for (let i = 0; i < v.length; i++) {
      const [ax, ay] = v[i], [bx, by] = v[(i + 1) % v.length];
      if ((ay <= yc) === (by <= yc)) continue;
      const x = ax + ((yc - ay) / (by - ay)) * (bx - ax);
      if (x < xl) xl = x;
      if (x > xr) xr = x;
    }
    if (xr >= xl) span(y, xl - 0.5, xr - 0.5, c, a);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, c: number[], a: number) {
  if (rx < 0.4 || ry < 0.4) return;
  const m = Math.max(rx, ry), cs = Math.cos(rot), sn = Math.sin(rot);
  for (let y = Math.max(0, Math.floor(cy - m)); y <= Math.min(bh - 1, Math.ceil(cy + m)); y++)
    for (let x = Math.max(0, Math.floor(cx - m)); x <= Math.min(bw - 1, Math.ceil(cx + m)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * cs + dy * sn) / rx, w = (-dx * sn + dy * cs) / ry;
      if (u * u + w * w <= 1) put(y * bw + x, c, a);
    }
}

/** updateFetti, minus the canvas. Returns false once the piece has faded. */
function draw(f: P): boolean {
  const scalar = 1.15;
  f.x += Math.cos(f.angle2D) * f.velocity; f.y += Math.sin(f.angle2D) * f.velocity + f.gravity; f.velocity *= f.decay;
  f.wobble += f.wobbleSpeed; f.tiltAngle += 0.1;
  const wx = f.x + 10 * scalar * Math.cos(f.wobble), wy = f.y + 10 * scalar * Math.sin(f.wobble);
  const rnd = Math.random() + 2, tc = Math.cos(f.tiltAngle), ts = Math.sin(f.tiltAngle);
  const progress = f.tick++ / f.total;
  const x1 = f.x + rnd * tc, y1 = f.y + rnd * ts, x2 = wx + rnd * tc, y2 = wy + rnd * ts;
  const a = 1 - progress, rot = (Math.PI / 10) * f.wobble;
  if (f.shape === 0) {
    poly([[Math.floor(f.x), Math.floor(f.y)], [Math.floor(wx), Math.floor(y1)], [Math.floor(x2), Math.floor(y2)], [Math.floor(x1), Math.floor(wy)]].map((p) => [p[0] * S, p[1] * S]), f.c, a);
  } else if (f.shape === 1) {
    ellipse(f.x * S, f.y * S, Math.abs(x2 - x1) * 0.6 * S, Math.abs(y2 - y1) * 0.6 * S, rot, f.c, a);
  } else {
    const sx = Math.abs(x2 - x1) * 0.1, sy = Math.abs(y2 - y1) * 0.1, cr = Math.cos(rot), sr = Math.sin(rot);
    poly(TRI.map(([px, py]) => [(f.x + cr * sx * px - sr * sy * py) * S, (f.y + sr * sx * px + cr * sy * py) * S]), f.c, a);
  }
  return f.tick < f.total;
}

export const confettiStats = { frames: 0, ms: 0 };

export function ConfettiLayer() {
  const size = useWindowSize();
  const img = useRef<ImgInstance>(null);
  const [on, setOn] = useState(false); // an <img> without pixels paints a placeholder, so only mount it while firing
  W = size.width; H = size.height;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null, last = 0, owed = 0, shown = false;
    const frame = () => {
      const now = performance.now();
      owed = Math.min(owed + ((now - last) / 1000) * TPS, 3); last = now;
      const ticks = Math.floor(owed); owed -= ticks;
      if (ticks === 0) return;
      const t0 = performance.now();
      const w = Math.round(W * S), h = Math.round(H * S);
      if (w !== bw || h !== bh) { bw = w; bh = h; buf = new Uint8ClampedArray(w * h * 4); }
      // Late frames catch up by stepping the physics, drawing only the last step.
      for (let t = 0; t < ticks; t++) { buf.fill(0); parts = parts.filter(draw); }
      if (parts.length || shown) {
        try { img.current?.setImagePixels(bw, bh, buf as unknown as Uint8Array); } catch { /* element not realised yet: next tick */ }
        shown = parts.length > 0;
      }
      confettiStats.frames++; confettiStats.ms += performance.now() - t0;
      if (!parts.length && timer) { clearInterval(timer); timer = null; shown = false; setOn(false); }
    };
    wake = () => { setOn(true); if (!timer) { last = performance.now(); owed = 0; timer = setInterval(frame, 1000 / TPS); } };
    return () => { wake = null; if (timer) clearInterval(timer); };
  }, []);
  return on ? <img ref={img as never} style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, pointerEvents: "none" }} /> : null;
}
