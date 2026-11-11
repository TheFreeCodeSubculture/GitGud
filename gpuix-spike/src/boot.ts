import "../vendor/preload"; // must precede the first @gpuix/native import (patched build, see NATIVE.md)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UNIVERSAL_PROPS } from "@gpuix/native/host";
import { createRenderer, render, startFrameLoop } from "@gpuix/react";
import type { ReactNode } from "react";
import { dispatchWindowKey } from "./nav/keys";

// GG_ROOT: the spike folder (assets/). A packaged build sets it, since a
// compiled binary has no source tree around it.
export const ROOT = process.env.GG_ROOT ?? join(import.meta.dir, "..");
export const PUBLIC = join(ROOT, "..", "public");
export const CONTENT = join(ROOT, "..", "src", "content");

// The stock reconciler drops unknown props on <div>; these two reach the patched native
// build (window drag region / no-drag child). The stock native build ignores them.
(UNIVERSAL_PROPS as Set<string>).add("windowDragArea");
(UNIVERSAL_PROPS as Set<string>).add("windowNoDrag");

export const renderer = createRenderer();
/** Open the window, register fonts, mount, pump frames. */
export function launch(node: ReactNode) {
  renderer.init({ title: "Git Gud", appName: "Git Gud", width: 1200, height: 820, minWidth: 800, minHeight: 600, resizable: true,
    // Linux: no native frame, the app draws its own header (WindowControls.tsx). Ignored by the stock build.
    ...({ decorations: "client" } as object),
  });
  registerFonts();
  render(node, { renderer, onKeyDown: dispatchWindowKey });
  startFrameLoop(renderer, { onTerminated: () => process.exit(0) });
  if (process.env.GG_OVERLAY) renderer.setDebugFrameOverlay(process.env.GG_OVERLAY);
  maybeScreenshot();
  void perf();
}

function registerFonts() {
  const fonts = join(ROOT, "assets", "fonts");
  for (const f of readdirSync(fonts)) renderer.registerFont(readFileSync(join(fonts, f)));
}

/** GG_SHOT=out.png → screenshot after GG_SHOT_MS and quit. Reference-diff harness. */
export function maybeScreenshot() {
  // GG_CLICK="x,y" → simulated click at 1500 ms (logical px), to drive animations.
  const click = process.env.GG_CLICK?.split(",").map(Number);
  if (click) setTimeout(() => renderer.simulateClick(click[0], click[1]), 1500);
  const out = process.env.GG_SHOT;
  if (!out) return;
  setTimeout(() => {
    renderer.captureScreenshot(out);
    setTimeout(() => process.exit(0), 300);
  }, Number(process.env.GG_SHOT_MS ?? 2500));
}

/** GG_PERF=1: scripted scenarios matching the WebKitGTK benchmark, logs per-phase
 *  draw-time percentiles and frames/s from GPUI's own frame stats. */
export async function perf() {
  if (process.env.GG_PERF !== "1") return;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const phase = async (name: string, ms: number, act: () => void) => {
    renderer.resetDebugFrameOverlayStats();
    const t0 = performance.now();
    act();
    await wait(ms);
    const s = renderer.getDebugFrameOverlayStats();
    const secs = (performance.now() - t0) / 1000;
    console.log(`[perf] ${name.padEnd(18)} frames/s=${(s.frames / secs).toFixed(1).padStart(5)}  p90=${s.p90Ms?.toFixed(1)}ms  p99=${s.p99Ms?.toFixed(1)}ms  max=${s.maxMs?.toFixed(1)}ms  (frames=${s.frames})`);
  };
  const wheel = (x: number, y: number, dy: number, ms: number) => {
    const end = performance.now() + ms;
    const tick = () => { if (performance.now() < end) { renderer.simulateScrollWheel(x, y, 0, dy); setTimeout(tick, 16); } };
    tick();
  };
  renderer.setDebugFrameOverlay(process.env.GG_OVERLAY ?? "minimal");
  await wait(2500);
  await phase("idle home", 2000, () => {});
  await phase("jump + wipe", 2500, () => renderer.simulateClick(509, 557));
  await wait(500);
  await phase("challenge scroll", 3000, () => wheel(800, 500, -40, 2800));
  await phase("sidebar scroll", 2000, () => wheel(128, 500, -30, 1800));
  if (process.env.GG_PERF_EXIT !== "0") process.exit(0);
}
