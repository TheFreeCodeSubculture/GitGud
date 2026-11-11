// Port of src/lib/searchHighlight.ts's revealSearchHit: after a palette result
// opens its challenge, scroll to the section heading, then blink the matched
// words. The DOM version paints a CSS Custom Highlight; here the scroller carries
// a native `highlight` prop whose colour alpha is stepped through the same
// two-blinks / hold / fade timeline.
import { useSyncExternalStore } from "react";
import type { PublicInstance as Instance } from "@gpuix/react";
import { currentHeadings, jumpTo } from "./outline";

let flash: { terms: string[]; alpha: number } | null = null;
const subs = new Set<() => void>();
const set = (next: typeof flash) => { flash = next; subs.forEach((f) => f()); };
export const useFlash = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => flash);

let timers: ReturnType<typeof setTimeout>[] = [];
export function clearFlash() { timers.forEach(clearTimeout); timers = []; set(null); }

// ms, alpha: PULSE 650 (two blinks), hold, fade (T3 Code's timings).
const TIMELINE: [number, number][] = [[0, 0], [160, 1], [325, 0], [490, 1], [650, 0], [810, 1], [2500, 1], [2700, 0.6], [2900, 0.25], [3100, 0]];

export function revealSearchHit({ scroller, headingId, query }: { scroller: () => Instance | null; headingId: string; query: string }) {
  clearFlash();
  const index = Number(headingId.match(/^s-(\d+)-/)?.[1] ?? -1);
  const terms = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const start = Date.now();
  // The route has to render before the anchor exists, as in the original.
  const tick = () => {
    const h = currentHeadings()[index];
    if (index >= 0 && !h && Date.now() - start < 1200) return void timers.push(setTimeout(tick, 50));
    if (h) jumpTo(scroller(), h);
    // Waiting for the scroll to settle matters: the blink is the payload.
    const base = h ? 380 : 0;
    TIMELINE.forEach(([ms, alpha], i) => timers.push(setTimeout(() => set(i === TIMELINE.length - 1 ? null : { terms, alpha }), base + ms)));
  };
  timers.push(setTimeout(tick, 80));
}
