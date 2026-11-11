// Port of src/components/Outline.tsx: headings come from <HeadingAnchor> wrappers
// (the lesson renderer wraps its h2/h3 in them), scroll-spy and jumps read live
// element bounds from the renderer instead of IntersectionObserver / scrollIntoView.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import type { PublicInstance as Instance } from "@gpuix/react";
import { renderer } from "../boot";
import { EASE_OUT_STRONG, withAlpha } from "../ui";
import { FONT, type Theme } from "../theme";

export interface Heading { id: number; text: string; level: 2 | 3 }

// --- registry: element id order is creation order, which is document order ---
let headings: Heading[] = [];
const subs = new Set<() => void>();
const publish = (next: Heading[]) => { headings = next; subs.forEach((f) => f()); };
const useHeadings = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => headings);
export const currentHeadings = () => headings;

/** Wrap an h2/h3 in this so the outline can find it. Renders a plain div. */
export function HeadingAnchor({ level, text, children }: { level: 2 | 3; text: string; children: ReactNode }) {
  const ref = useRef<Instance>(null);
  useLayoutEffect(() => {
    const h = { id: ref.current!.id, text, level };
    publish([...headings, h].sort((a, b) => a.id - b.id));
    return () => publish(headings.filter((x) => x !== h));
  }, [text, level]);
  return <div ref={ref}>{children}</div>;
}

const NARROW_PX = 940, STRIP_GAP = 16;
const scrollOffset = (id: number) => renderer.getScrollOffset(id)?.[1] ?? 0;

let tween: ReturnType<typeof setInterval> | undefined;
/** Smooth scroll, as `behavior: "smooth"`. */
function scrollTo(scroller: number, to: number) {
  clearInterval(tween);
  const from = scrollOffset(scroller), t0 = Date.now(), ms = 320;
  tween = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms), e = 1 - (1 - k) ** 3;
    renderer.scrollTo(scroller, 0, from + (to - from) * e);
    if (k === 1) clearInterval(tween);
  }, 16);
}

/** Scroll so heading `h` sits at the top of the scroller (or its middle). */
export function jumpTo(scroller: Instance | null, h: Heading, block: "start" | "center" = "start") {
  if (!scroller) return;
  const b = renderer.getElementBounds(h.id), s = renderer.getElementBounds(scroller.id);
  if (!b || !s) return;
  const lead = block === "start" ? 0 : (s.height - b.height) / 2;
  scrollTo(scroller.id, Math.min(0, scrollOffset(scroller.id) - (b.y - s.y) + lead));
}

export function useOutline(scroller: RefObject<Instance | null>, content: RefObject<Instance | null>, row: RefObject<Instance | null>) {
  const list = useHeadings();
  const [active, setActive] = useState<number | null>(null);
  // `position: sticky; top: 16`: the column rides with the row until it would pass 16px from the top.
  const [top, setTop] = useState(16);
  const pinnedUntil = useRef(0);

  const measure = useCallback(() => {
    const sc = scroller.current, ct = content.current;
    if (!sc || !ct) return;
    const s = renderer.getElementBounds(sc.id), c = renderer.getElementBounds(ct.id);
    if (!s || !c) return;
    const r = row.current && renderer.getElementBounds(row.current.id);
    if (r) setTop(Math.max(16, r.y - s.y));
    if (!headings.length || Date.now() < pinnedUntil.current) return;
    // The last heading or two can never reach the band; at the end of the travel the last one is active.
    if (-scrollOffset(sc.id) + s.height >= c.height - 2) return setActive(headings[headings.length - 1].id);
    const top = s.y + 64, bottom = s.y + s.height * 0.3;
    const hit = headings.find((h) => { const b = renderer.getElementBounds(h.id); return b && b.y < bottom && b.y + b.height > top; });
    if (hit) setActive(hit.id);
  }, []);

  useEffect(() => { setActive(list[0]?.id ?? null); const t = setTimeout(measure, 150); return () => clearTimeout(t); }, [list]);
  const jump = useCallback((h: Heading) => {
    setActive(h.id);
    pinnedUntil.current = Date.now() + 700;
    jumpTo(scroller.current, h);
  }, []);
  return { headings: list, active, jump, measure, top };
}

/** Where the column sits, given the pane (window x of its left edge, its width). */
export function outlineLayout(pane: { x: number; w: number }) {
  if (pane.w < NARROW_PX || process.env.GG_NARROW) return { narrow: true, left: 0 };
  const cw = Math.min(pane.w, 1152), cl = pane.x + (pane.w - cw) / 2, inner = cw - 48;
  const content = Math.min(672, inner - 216), group = content + 216;
  return { narrow: false, left: cl + 24 + Math.max(0, (inner - group) / 2) + content + 24 };
}

export function OutlineColumn({ t, headings, active, onJump, left, top, height }: {
  t: Theme; headings: Heading[]; active: number | null; onJump: (h: Heading) => void; left: number; top: number; height: number;
}) {
  return (
    <div style={{ position: "absolute", left, top, width: 192, maxHeight: height, overflowY: "scroll", scrollbarWidth: 0, paddingTop: 32, paddingBottom: 32, paddingRight: 16, fontFamily: FONT }}>
      <div style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: 500, letterSpacing: 0.3, color: t.mutedForeground, whiteSpace: "nowrap" }}>ON THIS PAGE</div>
      {headings.map((h, i) => (
        <div key={h.id} onClick={() => onJump(h)} style={{
          marginTop: i ? 1 : 0, paddingTop: 4, paddingBottom: 4, paddingLeft: h.level === 3 ? 20 : 8, paddingRight: 8, borderRadius: 6, cursor: "pointer",
          fontSize: 12, lineHeight: 16, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden",
          ...(active === h.id ? { backgroundColor: t.accent, fontWeight: 500, color: t.foreground } : { color: t.mutedForeground, hover: { color: t.foreground } }),
        }}>{h.text}</div>
      ))}
    </div>
  );
}

/** The narrow-window rail: 2px strips with fisheye widths and a label card. */
export function OutlineRail({ t, headings, active, onJump, winH }: { t: Theme; headings: Heading[]; active: number | null; onJump: (h: Heading) => void; winH: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [box, setBox] = useState({ y: 0, height: 0 });
  const n = headings.length, H = (n - 1) * STRIP_GAP;
  const indexAt = (y: number) => Math.max(0, Math.min(n - 1, Math.round(((y - box.y) / Math.max(1, box.height)) * (n - 1))));
  const pct = (i: number) => (i / Math.max(1, n - 1)) * H;
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 64, pointerEvents: "none" }}>
      <div style={{ position: "absolute", right: 12, top: (winH - H) / 2, height: H, width: 44 }}
        onLayout={(e) => setBox({ y: e.y ?? 0, height: e.height ?? 0 })}>
        {headings.map((h, i) => {
          const d = hovered === null ? null : Math.abs(i - hovered);
          const w = d === 0 ? 24 : d === 1 ? 16 : d === 2 ? 10 : h.level === 3 ? 6 : 8;
          return <div key={h.id} style={{ position: "absolute", right: 0, top: pct(i) - 1, height: 2, width: w, borderRadius: 1, pointerEvents: "none",
            backgroundColor: h.id === active ? withAlpha(t.foreground, 0.9) : withAlpha(t.mutedForeground, 0.4) }}
            motion={{ initial: { width: w }, animate: { width: w }, transition: { duration: 0.15, ease: EASE_OUT_STRONG } }} />;
        })}
        {/* One hit area, not one per strip; the pointer's Y picks the heading. */}
        <div style={{ position: "absolute", right: 0, top: -12, bottom: -12, width: 44, cursor: "pointer", pointerEvents: "auto" }}
          onMouseMove={(e) => setHovered(indexAt(e.y ?? 0))} onMouseLeave={() => setHovered(null)}
          onClick={(e) => { const h = headings[indexAt(e.y ?? 0)]; if (h) onJump(h); }} />
        {hovered !== null && headings[hovered] && (
          // The card is as wide as its text, right-aligned in a 224px lane (an absolute box with only `right` set has no width here).
          <div style={{ position: "absolute", right: 36, top: pct(hovered) - 15, width: 224, display: "flex", flexDirection: "row", justifyContent: "flex-end", pointerEvents: "none" }}>
            <div style={{ minWidth: 0, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8,
              borderWidth: 1, borderColor: t.glassBorder, backgroundColor: withAlpha(t.glass, 1.18),
              fontSize: 12, lineHeight: 16, color: t.foreground, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontFamily: FONT,
              boxShadow: { offsetX: 0, offsetY: 8, blurRadius: 24, spreadRadius: -8, color: "rgba(0,0,0,0.25)" } }}>{headings[hovered].text}</div>
          </div>
        )}
      </div>
    </div>
  );
}
