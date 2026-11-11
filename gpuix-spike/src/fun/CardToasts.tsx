// Port of components/CardToasts.tsx. Bottom-right: a card turns over as it is collected.
// translateX(24px) is a spacer pair (the row is always 344 wide), rotateY is a width
// squash of a clipped card, baked into linear segments.
import { useEffect, useState } from "react";
import { useWindowSize } from "@gpuix/react";
import { cardById, type Card } from "../../../src/lib/cards";
import { dismissToast, useCardToasts, type CardToast } from "../../../src/lib/moments";
import { strings } from "../../../src/strings";
import type { Route } from "../Shell";
import { MONO, type Theme } from "../theme";
import { EASE_OUT_STRONG, bake, bezier, useAfter, useKeyframes } from "./anim";
import { CommandCard, moduleColor } from "./CommandCard";

const SHOW_MS = 5200;
const flipE = bezier(0.34, 1.4, 0.64, 1), openE = bezier(0.23, 1, 0.32, 1);

export function CardToasts({ t, locale, go }: { t: Theme; locale: string; go: (r: Route) => void }) {
  const toasts = useCardToasts(), size = useWindowSize();
  if (!toasts.length) return null;
  // 344 = 320 + the 24px the toast slides in from; right: -4 puts the toast's own edge 20px in.
  return (
    <div style={{ position: "absolute", right: -4, bottom: 20, width: 344, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", maxHeight: size.height }}>
      {toasts.slice(-3).map((toast) => <Toast key={toast.key} toast={toast} t={t} locale={locale} go={go} />)}
    </div>
  );
}

function FlipCard({ card, t, i, n }: { card: Card; t: Theme; i: number; n: number }) {
  const W = 56, H = 77, cx = (i - Math.min(2, n - 1) / 2) * 4;
  const frames = bake(16, (p) => {
    const e = flipE(p), s = 0.8 + 0.2 * e, w = Math.max(0.01, W * s * Math.abs(Math.cos(Math.PI * (1 - e)))), h = H * s;
    return { left: W / 2 + cx - w / 2, top: H / 2 - h / 2 + 12 * (1 - e), width: w, height: h, opacity: openE(Math.min(1, p / 0.4)) };
  });
  const m = useKeyframes(useAfter(120 + i * 90), frames, 700);
  return (
    <div style={{ position: "absolute", overflow: "hidden", display: "flex", flexDirection: "row", justifyContent: "center", ...frames[0].style, pointerEvents: "none" }} motion={m}>
      <CommandCard t={t} card={card} collected size="sm" w={W} />
    </div>
  );
}

function Toast({ toast, t, locale, go }: { toast: CardToast; t: Theme; locale: string; go: (r: Route) => void }) {
  const s = strings(locale);
  const [leaving, setLeaving] = useState(false), [held, setHeld] = useState(false);
  const cards = toast.ids.map(cardById).filter((c): c is Card => c !== undefined), first = cards[0];

  useEffect(() => {
    if (held) return;
    const out = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(out);
  }, [held]);
  useEffect(() => {
    if (!leaving) return;
    const gone = setTimeout(() => dismissToast(toast.key), 220);
    return () => clearTimeout(gone);
  }, [leaving, toast.key]);
  if (!first) return null;
  const single = cards.length === 1 && !toast.backlog, m = moduleColor(first.module);
  const tr = leaving ? { duration: 0.22, ease: "easeIn" as const } : { duration: 0.42, ease: EASE_OUT_STRONG };
  return (
    <div style={{ display: "flex", flexDirection: "row", width: 344 }}>
      <div style={{ width: 24 }} motion={{ initial: { width: 24 }, animate: { width: leaving ? 24 : 0 }, transition: tr }} />
      <div onClick={() => { go({ name: "deck" }); setLeaving(true); }} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
        style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.glassBorder, backgroundColor: t.glass, pointerEvents: "auto", cursor: "pointer",
          boxShadow: t.dark ? [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.05)", inset: true }, { offsetX: 0, offsetY: 24, blurRadius: 72, spreadRadius: -20, color: "rgba(0,0,0,0.8)" }]
            : { offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -24, color: "rgba(0,0,0,0.28)" } }}
        motion={{ initial: { opacity: 0 }, animate: { opacity: leaving ? 0 : 1 }, transition: tr }}>
        <div style={{ position: "relative", width: 56, height: 74, flexShrink: 0 }}>
          {cards.slice(0, 3).map((c, i) => ({ c, i })).reverse().map(({ c, i }) => <FlipCard key={c.id} card={c} t={t} i={i} n={cards.length} />)}
        </div>
        <div style={{ minWidth: 0, flexShrink: 1, flexGrow: 1 }}>
          <div style={{ fontSize: 11, lineHeight: 16.5, fontWeight: 800, letterSpacing: 0.275, color: m, whiteSpace: "nowrap" }}>{(single ? s.cardNew : s.cardsNew.replace("{n}", String(cards.length))).toUpperCase()}</div>
          {single ? (
            <>
              <div style={{ marginTop: 2, fontFamily: MONO, fontSize: 14, lineHeight: 21, fontWeight: 700, color: t.foreground }}>{first.cmd}</div>
              <div style={{ fontSize: 12, lineHeight: 16, color: t.mutedForeground }}>{first.does}</div>
            </>
          ) : (
            <div style={{ marginTop: 2, fontSize: 14, lineHeight: 20, color: t.foreground }}>{toast.backlog ? s.cardsBacklog.replace("{n}", String(cards.length)) : cards.map((c) => c.cmd).join(", ")}</div>
          )}
          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 16.5, color: t.mutedForeground }}>{s.cardsOpenDeck}</div>
        </div>
      </div>
      <div style={{ width: 0 }} motion={{ initial: { width: 0 }, animate: { width: leaving ? 0 : 24 }, transition: tr }} />
    </div>
  );
}
