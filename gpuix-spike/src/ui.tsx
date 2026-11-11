// Shared primitives for the GPUIX build: icons, buttons, CSS-keyframe emulation.
import { useEffect, useState, type ReactNode } from "react";
import type { MotionEase, MotionStyle, StyleDesc } from "@gpuix/react";
import type { Theme } from "./theme";

// --- Icons -------------------------------------------------------------------
// lucide-react ships its geometry as data (`__iconData`); GPUI's <svg> renders a
// monochrome mask tinted with `color`, which is exactly what a lucide icon is.
type IconNode = [string, Record<string, string>][];
const icons: Record<string, string> = {};
export function registerIcon(name: string, data: { node: IconNode }, strokeWidth = 2) {
  const body = data.node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  icons[`${name}@${strokeWidth}`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
export function Icon({ name, size = 16, color, strokeWidth = 2 }: { name: string; size?: number; color: string; strokeWidth?: number }) {
  return <svg source={icons[`${name}@${strokeWidth}`]} style={{ width: size, height: size, color, flexShrink: 0 }} />;
}

// --- Keyframes ---------------------------------------------------------------
// GPUIX motion only tweens from the current value to one target. A CSS
// @keyframes rule is a list of targets at percentages, so play it as a chain of
// tweens, each starting when the previous one is due.
export interface Frame { at: number; style: MotionStyle; ease?: MotionEase }
export function useKeyframes(play: boolean, frames: Frame[], durationMs: number) {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (!play) { setStep(-1); return; }
    setStep(0);
    // Step n tweens toward frame n+1, so step n+1 starts when frame n+1 is due.
    const timers = frames.slice(1, -1).map((f, i) => setTimeout(() => setStep(i + 1), f.at * durationMs));
    return () => timers.forEach(clearTimeout);
  }, [play]);
  if (step < 0) return { initial: frames[0].style, animate: frames[0].style, transition: { duration: 0 } };
  const next = frames[Math.min(step + 1, frames.length - 1)];
  const from = frames[step];
  const ms = (next.at - from.at) * durationMs;
  return { initial: frames[0].style, animate: step + 1 < frames.length ? next.style : from.style, transition: { duration: Math.max(ms, 1) / 1000, ease: next.ease ?? "linear" } };
}

export const EASE_OUT_STRONG: MotionEase = [0.23, 1, 0.32, 1];

// --- Button ------------------------------------------------------------------
type Variant = "default" | "ghost" | "outline";
type Size = "default" | "lg" | "icon" | "icon-sm";
const HEIGHT: Record<Size, number> = { default: 32, lg: 36, icon: 32, "icon-sm": 28 };
const PADX: Record<Size, number> = { default: 11, lg: 13, icon: 0, "icon-sm": 0 };

export function Button({ t, variant = "default", size = "default", onClick, children, style }: {
  t: Theme; variant?: Variant; size?: Size; onClick?: (e: { x?: number; y?: number }) => void; children: ReactNode; style?: StyleDesc;
}) {
  const square = size === "icon" || size === "icon-sm";
  const base: StyleDesc = {
    display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: HEIGHT[size], width: square ? HEIGHT[size] : undefined, paddingLeft: PADX[size], paddingRight: PADX[size],
    borderRadius: 8, borderWidth: 1, fontSize: 14, fontWeight: 500, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
  };
  const v: Record<Variant, StyleDesc> = {
    // Specular top highlight (inset white 16%) + glow tinted with the primary.
    default: {
      borderColor: t.primary, backgroundColor: t.primary, color: t.primaryForeground,
      boxShadow: [
        { offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.16)", inset: true },
        { offsetX: 0, offsetY: 1, blurRadius: 3, spreadRadius: 0, color: withAlpha(t.primary, 0.24) },
        { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: -1, color: withAlpha(t.primary, 0.24) },
      ],
      hover: { backgroundColor: withAlpha(t.primary, 0.9) },
      active: { boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(0,0,0,0.08)", inset: true }] },
    },
    ghost: { borderColor: "rgba(0,0,0,0)", color: t.mutedForeground, hover: { backgroundColor: t.accent, color: t.foreground } },
    outline: {
      borderColor: t.input, backgroundColor: t.dark ? withAlpha("rgba(255,255,255,1)", 0.032) : t.popover, color: t.foreground,
      boxShadow: { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0, color: "rgba(0,0,0,0.05)" },
      hover: { backgroundColor: t.dark ? "rgba(255,255,255,0.05)" : "rgba(244,244,245,0.5)" },
    },
  };
  return <div style={{ ...base, ...v[variant], ...style }} onClick={(e) => onClick?.(e)}>{children}</div>;
}

/** `rgba(r,g,b,a)` → same colour at alpha `a * k`. Stands in for `color/NN`. */
export function withAlpha(rgba: string, k: number) {
  const m = rgba.match(/rgba?\(([^,]+),([^,]+),([^,)]+)(?:,([^)]+))?\)/);
  if (!m) return rgba;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return `rgba(${m[1]},${m[2]},${m[3]},${+(a * k).toFixed(3)})`;
}
