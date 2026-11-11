// Fake `panel-glass`: GPUI has no backdrop-filter, but the only thing behind the
// home panels is the landscape, which never changes. So the landscape is
// blurred once at build time (scripts/bake.cjs) and each panel draws the slice
// of it that sits behind it, tinted the way the CSS tints it. Rounded corners
// go into the alpha, since GPUI clips images to rectangles only.
//
// ponytail: CPU fill in JS per layout change (~1–3 ms per panel). If panels ever
// float over moving content, this needs the zui fork's real `paint_backdrop_blur`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { StyleDesc, ImgInstance } from "@gpuix/react";
import { ROOT } from "./boot";
import type { Theme } from "./theme";

export const ASPECT = 1000 / 563;
const SCALE = 2; // supersample: GPUIX doesn't expose the display scale factor

type Src = { w: number; h: number; px: Buffer };
const cache: Partial<Record<"light" | "dark", Src>> = {};
function blurred(dark: boolean): Src {
  const k = dark ? "dark" : "light";
  if (!cache[k]) {
    const dir = join(ROOT, "assets", "baked");
    const { width, height } = JSON.parse(readFileSync(join(dir, `home-bg-${k}.blur.json`), "utf8"));
    cache[k] = { w: width, h: height, px: readFileSync(join(dir, `home-bg-${k}.blur.rgba`)) };
  }
  return cache[k]!;
}

/** Where the landscape pane is in window coordinates, and how far it's scrolled. */
export interface Pane { x: number; y: number; w: number; h: number; scrollY: number }
export const PaneContext = createContext<Pane | null>(null);

const rgba = (s: string) => s.match(/[\d.]+/g)!.map(Number);

function fill(b: { x: number; y: number; width: number; height: number }, pane: Pane, t: Theme, radius: number) {
  const W = Math.max(1, Math.round(b.width * SCALE)), H = Math.max(1, Math.round(b.height * SCALE));
  const src = blurred(t.dark);
  const s32 = new Uint32Array(src.px.buffer, src.px.byteOffset, src.w * src.h);
  const out = Buffer.allocUnsafe(W * H * 4);
  const o32 = new Uint32Array(out.buffer, out.byteOffset, W * H);
  const [tr, tg, tb, ta] = rgba(t.glass);
  const [sr, sg, sb] = rgba(t.sky.startsWith("#") ? hex(t.sky) : t.sky);
  const sceneH = pane.w / ASPECT;
  const sceneTop = pane.y + pane.h - sceneH;
  // Column → source column, computed once instead of per pixel.
  const us = new Int32Array(W);
  for (let x = 0; x < W; x++) us[x] = Math.min(src.w - 1, Math.max(0, Math.floor(((b.x + (x + 0.5) / SCALE - pane.x) / pane.w) * src.w)));
  // Tint lookup: out = c + (tint - c) * a, per channel, as a 256-entry table.
  const lut = (tc: number) => Uint8Array.from({ length: 256 }, (_, c) => c + (tc - c) * ta);
  const LR = lut(tr), LG = lut(tg), LB = lut(tb);
  const sky = (255 << 24) | (LB[sb] << 16) | (LG[sg] << 8) | LR[sr]; // little-endian RGBA
  for (let y = 0; y < H; y++) {
    const v = Math.floor(((b.y + (y + 0.5) / SCALE - sceneTop) / sceneH) * src.h);
    const row = y * W;
    if (v < 0) { o32.fill(sky, row, row + W); continue; }
    const srow = Math.min(v, src.h - 1) * src.w;
    for (let x = 0; x < W; x++) {
      const c = s32[srow + us[x]];
      o32[row + x] = (255 << 24) | (LB[(c >> 16) & 255] << 16) | (LG[(c >> 8) & 255] << 8) | LR[c & 255];
    }
  }
  // Rounded corners: only the four R×R squares need coverage maths.
  const R = Math.round(radius * SCALE);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const a = Math.max(0, Math.min(1, R - Math.hypot(R - x - 0.5, R - y - 0.5) + 0.5));
    if (a === 1) continue;
    for (const [px, py] of [[x, y], [W - 1 - x, y], [x, H - 1 - y], [W - 1 - x, H - 1 - y]]) out[(py * W + px) * 4 + 3] = 255 * a;
  }
  return { W, H, out };
}

function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${n >> 16},${(n >> 8) & 255},${n & 255})`;
}

export function Glass({ t, children, style, radius = 10 }: { t: Theme; children: ReactNode; style?: StyleDesc; radius?: number }) {
  const pane = useContext(PaneContext);
  const img = useRef<ImgInstance>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Layout events fire on any relayout; only refill when the panel actually moved.
  const onLayout = (e: { x?: number; y?: number; width?: number; height?: number }) => setBox((old) => {
    const next = { x: e.x ?? 0, y: e.y ?? 0, width: e.width ?? 0, height: e.height ?? 0 };
    return old && old.x === next.x && old.y === next.y && old.width === next.width && old.height === next.height ? old : next;
  });

  useEffect(() => {
    if (!box || !pane || !img.current) return;
    // Layout bounds are in content space; the backdrop is fixed to the pane.
    const t0 = performance.now();
    const { W, H, out } = fill({ ...box, y: box.y - pane.scrollY }, pane, t, radius);
    if (process.env.GG_DEBUG) console.log(`glass fill ${W}x${H} ${(performance.now() - t0).toFixed(1)}ms`);
    img.current.setImagePixels(W, H, out);
  }, [box, pane?.x, pane?.y, pane?.w, pane?.h, pane?.scrollY, t]);

  const shadow = t.dark
    ? [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.05)", inset: true },
       { offsetX: 0, offsetY: 24, blurRadius: 72, spreadRadius: -20, color: "rgba(0,0,0,0.8)" }]
    : [{ offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -24, color: "rgba(0,0,0,0.28)" }];

  return (
    <div
      style={{ position: "relative", borderRadius: radius, boxShadow: shadow, ...style }}
      onLayout={onLayout}
    >
      {/* Tree order is paint order: backdrop, then content, then the hairline. */}
      <img ref={img as never} style={{ position: "absolute", top: 0, left: 0, width: box?.width ?? 0, height: box?.height ?? 0 }} />
      {children}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: t.glassBorder, borderRadius: radius, pointerEvents: "none" }} />
    </div>
  );
}
