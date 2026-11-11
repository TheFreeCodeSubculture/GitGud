import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StyleDesc } from "@gpuix/react";
import { renderer } from "../boot";
import type { Theme } from "../theme";
import { Button, Icon } from "../ui";
import { extra } from "./rich";
import "./icons";

const nums = (c: string) => c.match(/[\d.]+/g)!.map(Number);

/** `alert-glass` over a solid page: the page colour with a 6% wash of the variant colour. */
export function Glassy({ t, tint, border, children, style, onLayout }: { t: Theme; tint?: string; border?: string; children: ReactNode; style?: StyleDesc; onLayout?: (e: any) => void }) {
  let bg = t.background;
  if (tint) {
    const [r, g, b] = nums(t.background), [tr, tg, tb] = nums(tint);
    bg = `rgb(${Math.round(r + (tr - r) * 0.06)},${Math.round(g + (tg - g) * 0.06)},${Math.round(b + (tb - b) * 0.06)})`;
  }
  return <div onLayout={onLayout} style={{ width: "100%", borderRadius: 8, borderWidth: 1, borderColor: border ?? t.border, backgroundColor: bg, padding: 16, ...style }}>{children}</div>;
}

/** A counter that ticks every `ms` while mounted: drives the looping CSS animations. */
function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

/** `animate-pulse`: opacity 1 -> .5 -> 1 over 2 s. */
export function PulseDot({ color, size = 6, round = false }: { color: string; size?: number; round?: boolean }) {
  const n = useTick(1000);
  return <div style={{ width: size, height: size, flexShrink: 0, backgroundColor: color, borderRadius: round ? size : 0 }}
    motion={{ initial: false, animate: { opacity: n % 2 ? 1 : 0.5 }, transition: { duration: 1, ease: "easeInOut" } }} />;
}

/** The "watching" dot: a solid dot with a ring that grows and fades (`animate-ping`). */
export function PingDot({ color }: { color: string }) {
  const n = useTick(1000);
  return (
    <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
      <div key={n} style={{ position: "absolute", left: 0, top: 0, width: 8, height: 8, borderRadius: 8, backgroundColor: color.replace(/,[\d.]+\)$/, ",0.6)") }}
        motion={{ initial: { left: 0, top: 0, width: 8, height: 8, opacity: 0.6 }, animate: { left: -4, top: -4, width: 16, height: 16, opacity: 0 }, transition: { duration: 0.9, ease: [0, 0, 0.2, 1] } }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 8, height: 8, borderRadius: 8, backgroundColor: color }} />
    </div>
  );
}

/** ui.tsx's Button plus the `sm` size and `disabled` the challenge page needs. */
export function Btn({ t, variant, sm, disabled, onClick, children, style }: { t: Theme; variant?: "default" | "ghost" | "outline"; sm?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode; style?: StyleDesc }) {
  return (
    <Button t={t} variant={variant} onClick={disabled ? undefined : onClick}
      style={{ ...(sm ? { height: 28, paddingLeft: 9, paddingRight: 9, gap: 6 } : {}), ...(disabled ? { opacity: 0.6, cursor: "default", pointerEvents: "none" } : {}), ...style }}>{children}</Button>
  );
}

/** `<input type=range>` as the app styles it (.gg-range): a 2 px track and a 10 px square thumb. */
export function Range({ t, min, max, value, onChange }: { t: Theme; min: number; max: number; value: number; onChange: (v: number) => void }) {
  const box = useRef<{ id: number } | null>(null);
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState(false);
  const at = (x: number) => {
    const b = box.current && renderer.getElementBounds(box.current.id);
    if (b) onChange(Math.round(min + Math.min(1, Math.max(0, (x - 5 - b.x) / (b.width - 10))) * (max - min)));
  };
  const frac = max > min ? (value - min) / (max - min) : 0;
  return (
    <div ref={box as never} onLayout={(e) => setW(e.width ?? 0)} style={{ position: "relative", flexGrow: 1, flexBasis: 0, minWidth: 0, height: 16, cursor: "pointer" }}
      onMouseDown={(e) => { setDrag(true); at(e.x ?? 0); }} onMouseUp={() => setDrag(false)} onMouseLeave={() => setDrag(false)}
      onMouseMove={(e) => drag && at(e.x ?? 0)}>
      {/* pointerEvents none: a filled, positioned child would otherwise swallow the press. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 7, height: 2, pointerEvents: "none", backgroundColor: t.dark ? "rgba(245,245,245,0.18)" : "rgba(39,39,42,0.18)" }} />
      <div style={{ position: "absolute", top: 3, left: frac * Math.max(0, w - 10), width: 10, height: 10, pointerEvents: "none", backgroundColor: t.foreground }} />
    </div>
  );
}

export { extra, Icon };
