// Port of components/Celebration.tsx. Same sequence and timings; every CSS transform is
// rebuilt from width/height/top/left/opacity motion (see anim.tsx). Pure-DOM bits that
// have no GPUIX equivalent: backdrop-blur (a more opaque scrim instead), sound (none).
import { join } from "node:path";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useWindowSize } from "@gpuix/react";
import { Check, Clock, Flag, Layers, Lightbulb } from "lucide-react";
import { cardById } from "../../../src/lib/cards";
import { dismissWin, useWin, type Win } from "../../../src/lib/moments";
import { isMilestone, week } from "../../../src/lib/streak";
import { strings, type UiStrings } from "../../../src/strings";
import { PUBLIC, ROOT } from "../boot";
import type { Route } from "../Shell";
import { FONT, MONO, type Theme } from "../theme";
import { EASE_BOUNCE, EASE_OUT_STRONG, LIcon, Rise, alpha, around, bake, bezier, mix, track, useAfter, useKeyframes, useTween } from "./anim";
import { cannons } from "./Confetti";
import { warning } from "./tokens";

const BAKED = join(ROOT, "assets", "baked");
const SPARKS: [number, number][] = [[-70, -38], [-58, 30], [-34, -66], [0, -78], [36, -64], [64, -30], [70, 26], [0, 74], [-40, 62], [44, 60]];
const CW = 440;

/** Mounted once, last in the tree. `go` is the app's navigate. */
export function Celebration({ t, locale, go }: { t: Theme; locale: string; go: (r: Route) => void }) {
  const win = useWin();
  return win ? <Sequence key={`${win.challengeId}-${win.course.after}`} win={win} t={t} locale={locale} go={go} /> : null;
}

function Sequence({ win, t, locale, go }: { win: Win; t: Theme; locale: string; go: (r: Route) => void }) {
  const s = strings(locale);
  const size = useWindowSize();
  const [screen, setScreen] = useState<"done" | "streak">("done");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const big = win.courseDone ? 2 : win.moduleDone ? 1.6 : 1;
    cannons(big);
    const again = big > 1 ? setTimeout(() => cannons(big * 0.7), 900) : 0;
    return () => clearTimeout(again);
  }, [win]);

  useEffect(() => {
    if (screen !== "streak" || !win.streak) return;
    const lit = setTimeout(() => { if (isMilestone(win.streak!.after)) cannons(1.4); }, 260);
    return () => clearTimeout(lit);
  }, [screen, win]);

  function finish(goOn: boolean) {
    setLeaving(true);
    setTimeout(() => {
      dismissWin();
      if (!goOn || !win.next) return;
      go(win.next.kind === "finale" ? { name: "finale" } : { name: "challenge", id: win.next.id });
    }, 180);
  }
  const onContinue = () => (screen === "done" && win.streak ? setScreen("streak") : finish(true));
  const key = (e: { key?: string }) => { const k = (e.key ?? "").toLowerCase(); if (k === "escape") finish(false); else if (k === "enter" || k === " " || k === "space") onContinue(); };

  const showStay = !(screen === "done" && win.streak) && win.next;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, pointerEvents: "auto",
      // bg-background/85 + backdrop-blur-lg: no blur here, so the scrim is a touch denser.
      backgroundColor: alpha(t.background, 0.96), fontFamily: FONT }}
      onKeyDown={key}
      motion={{ initial: { opacity: 0 }, animate: { opacity: leaving ? 0 : 1 }, transition: leaving ? { duration: 0.18, ease: "easeIn" } : { duration: 0.22, ease: EASE_OUT_STRONG } }}>
      <div key={screen} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CW, maxWidth: "100%" }}>
        <Rise dy={10} dur={360}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            {screen === "done" ? <Done win={win} t={t} s={s} /> : <Streak win={win} t={t} s={s} locale={locale} />}
            <Rise d={1150} style={{ marginTop: 36 }}>
              <Raised t={t} label={s.winContinue} onClick={onContinue} />
            </Rise>
            {showStay && (
              <Rise d={1250} style={{ marginTop: 12 }}>
                <div onClick={() => finish(false)} style={{ fontSize: 12, lineHeight: 16, color: t.mutedForeground, cursor: "pointer", hover: { color: t.foreground, textDecoration: "underline" } }}>{s.winStay}</div>
              </Rise>
            )}
          </div>
        </Rise>
      </div>
    </div>
  );
}

/** `.gg-raised`: Duolingo's key, with a lip that disappears as it is pressed. */
function Raised({ t, label, onClick }: { t: Theme; label: string; onClick: () => void }) {
  const lip = (k: number) => ({ offsetX: 0, offsetY: k, blurRadius: 0, spreadRadius: 0, color: mix(t.primary, "rgba(0,0,0,1)", 0.72) });
  const bright = mix("rgba(255,255,255,1)", t.primary, 0.06);
  return (
    <div style={{ width: "100%", paddingBottom: 4 }}>
      <div autoFocus tabIndex={0} onClick={onClick} onKeyDown={(e: { key?: string }) => { const k = (e.key ?? "").toLowerCase(); if (k === "enter" || k === " " || k === "space") onClick(); }}
        style={{ width: "100%", height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: t.primary, color: t.primaryForeground,
          fontWeight: 700, fontSize: 15, letterSpacing: 1.2, cursor: "pointer", boxShadow: lip(4),
          hover: { backgroundColor: bright }, active: { boxShadow: lip(0), marginTop: 4 }, focusVisible: { outlineWidth: 2, outlineColor: mix(t.primary, "rgba(255,255,255,1)", 0.6), outlineOffset: 3 } }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

// --- screen one --------------------------------------------------------------

const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n) % 60).padStart(2, "0")}`;

function Done({ win, t, s }: { win: Win; t: Theme; s: UiStrings }) {
  const title = win.courseDone ? s.winCourse : win.moduleDone ? s.winModule : s.winChallenge;
  const hasCards = win.newCards.length > 0;
  const w = warning(t);
  return (
    <>
      <Hero win={win} t={t} />
      <Rise d={250} style={{ marginTop: 24 }}><div style={{ fontSize: 30, lineHeight: 36, fontWeight: 800, letterSpacing: -0.75, color: t.foreground, textAlign: "center" }}>{title}</div></Rise>
      <Rise d={330} style={{ marginTop: 6 }}><div style={{ fontSize: 14, lineHeight: 20, color: t.mutedForeground, textAlign: "center" }}>{win.moduleDone ?? win.title}</div></Rise>
      <div style={{ marginTop: 28, width: "100%", display: "grid", gridTemplateColumns: 3, gap: 12 }}>
        <Stat t={t} label={s.winCourse2} color={t.success} icon={Flag} delay={480}>
          <Count t={t} from={win.course.before} to={win.course.after} delay={900} format={(n) => `${n}/${win.course.total}`} />
        </Stat>
        <Stat t={t} label={s.winTime} color={t.primary} icon={Clock} delay={580}>
          <Count t={t} from={0} to={win.seconds} delay={1000} format={clock} />
        </Stat>
        <Stat t={t} label={hasCards ? s.winCards : s.winHints} color={w} icon={hasCards ? Layers : Lightbulb} delay={680}>
          <Count t={t} from={0} to={hasCards ? win.newCards.length : win.hintsUsed} delay={1100} format={(n) => (hasCards ? `+${n}` : String(n))} />
        </Stat>
      </div>
      {hasCards && (
        <Rise d={900} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
            {win.newCards.map((id) => (
              <div key={id} style={{ borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: alpha(t.card, 0.8), paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, fontFamily: MONO, fontSize: 11, lineHeight: 16.5, color: t.foreground }}>{cardById(id)?.cmd}</div>
            ))}
          </div>
        </Rise>
      )}
    </>
  );
}

const E = EASE_OUT_STRONG;
/** value of a keyframed property at p, each segment eased (CSS keyframe timing is per segment) */
function seg(p: number, pts: [number, number][], ease: (x: number) => number) {
  for (let i = 1; i < pts.length; i++) if (p <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * ease((p - a) / (b - a)); }
  return pts[pts.length - 1][1];
}
const easeOutStrong = bezier(0.23, 1, 0.32, 1);

/** A radial wash (CSS radial-gradient(closest-side, c, transparent)) drawn once into pixels. */
const radialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/></svg>`;
function Radial({ color, a, style, motion }: { color: string; a: number; style: object; motion: object }) {
  return <svg source={radialSvg} style={{ position: "absolute", color: alpha(color, a), ...style }} motion={motion as never} />;
}

/** One pixel spark / ember: opacity runs its own 0 → 1 → 0, the position one eased tween. */
function Spark({ dx, dy, d, c, size, plus, cx, cy, color }: { dx: number; dy: number; d: number; c?: number; size: number; plus: boolean; cx: number; cy: number; color: string }) {
  const op = useKeyframes(useAfter(d), [{ at: 0, style: { opacity: 0 } }, { at: 0.2, style: { opacity: 1 }, ease: E }, { at: 1, style: { opacity: 0 }, ease: E }], 760);
  const from = around(cx, cy, size, size, 0.4), to = around(cx + dx, cy + dy, size, size, 1.1);
  const bar = { backgroundColor: color };
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }} motion={op}>
      <div style={{ position: "absolute", ...from }} motion={{ initial: from, animate: to, transition: { duration: 0.76, delay: d / 1000, ease: E } }}>
        {plus ? (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}><div style={{ ...bar, height: "20%", width: "100%" }} /></div>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row", justifyContent: "center" }}><div style={{ ...bar, width: "20%", height: "100%" }} /></div>
          </>
        ) : <div style={{ ...bar, width: "100%", height: "100%" }} />}
      </div>
    </div>
  );
}

function Hero({ win, t }: { win: Win; t: Theme }) {
  const big = Boolean(win.moduleDone || win.courseDone);
  return (
    <div style={{ position: "relative", width: 112, height: 112, flexShrink: 0 }}>
      <Radial color={t.success} a={0.34} style={{}} motion={{ initial: { ...around(56, 56, 112, 112, 0.2), opacity: 0.9 }, animate: { ...around(56, 56, 112, 112, 2.4), opacity: 0 }, transition: { duration: 0.9, delay: 0.08, ease: E } }} />
      {SPARKS.map(([dx, dy], i) => <Spark key={i} dx={dx} dy={dy} d={120 + i * 25} size={8} plus cx={56} cy={56} color={t.success} />)}
      {big ? <Plumber /> : <MascotPop win={win} t={t} />}
    </div>
  );
}

const popFrames = (cx: number, cy: number, w: number, h: number) => [
  { at: 0, style: { ...around(cx, cy, w, h, 0.3), opacity: 0 } },
  { at: 0.6, style: { ...around(cx, cy, w, h, 1.08), opacity: 1 }, ease: EASE_BOUNCE },
  { at: 1, style: { ...around(cx, cy, w, h, 1), opacity: 1 }, ease: EASE_BOUNCE },
];

function MascotPop({ win, t }: { win: Win; t: Theme }) {
  const play = useAfter(60);
  const m = useKeyframes(play, popFrames(56, 56, 96, 96), 640);
  return (
    <div style={{ position: "absolute", ...around(56, 56, 96, 96, 0.3), borderRadius: 48, borderWidth: 4, borderColor: t.success, backgroundColor: t.card, overflow: "hidden" }} motion={m}>
      <img src={join(PUBLIC, "mascots", `${win.mascotId ?? "pixelArt"}.svg`)} style={{ width: "100%", height: "100%", borderRadius: 44 }} />
    </div>
  );
}

function Plumber() {
  const pop = useKeyframes(useAfter(60), popFrames(56, 56, 72, 66), 640);
  const jump = useKeyframes(useAfter(200), [
    { at: 0, style: { top: 0 } }, { at: 0.45, style: { top: -26 }, ease: [0.34, 1.4, 0.64, 1] }, { at: 1, style: { top: 0 }, ease: [0.34, 1.4, 0.64, 1] },
  ], 700);
  // coin: translateY 30 → -14 → 0, rotateY 0 → 540 → 720 (a width squash), fading in over the first 30%
  const coin = useKeyframes(useAfter(250), bake(18, (p) => {
    const ty = seg(p, [[0, 30], [0.7, -14], [1, 0]], easeOutStrong), th = (seg(p, [[0, 0], [0.7, 540], [1, 720]], easeOutStrong) * Math.PI) / 180;
    const w = Math.max(0.01, 34 * Math.abs(Math.cos(th)));
    return { left: 56 - w / 2, top: 23 - 36 + ty, width: w, height: 34, opacity: seg(p, [[0, 0], [0.3, 1], [1, 1]], easeOutStrong) };
  }), 900);
  return (
    <>
      <div style={{ position: "absolute", ...around(56, 56, 72, 66, 0.3) }} motion={pop}>
        <img src={join(BAKED, "mario.png")} style={{ position: "absolute", left: 0, width: "100%", height: "100%" }} motion={jump} />
      </div>
      <img src={join(BAKED, "coin.png")} style={{ position: "absolute", left: 39, top: -13, width: 34, height: 34 }} motion={coin} />
    </>
  );
}

function Stat({ t, label, color, icon, delay, children }: { t: Theme; label: string; color: string; icon: unknown; delay: number; children: ReactNode }) {
  const w = (CW - 24) / 3;
  return (
    <Rise d={delay} dy={26} dur={560} ease={EASE_BOUNCE} w={w} s0={0.92}>
      <div style={{ width: "100%", overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: alpha(color, 0.38), backgroundColor: mix(color, t.card, 0.07),
        boxShadow: { offsetX: 0, offsetY: 3, blurRadius: 0, spreadRadius: 0, color: alpha(color, 0.28) } }}>
        <div style={{ paddingTop: 4, paddingBottom: 4, backgroundColor: alpha(color, 0.16), borderTopLeftRadius: 13, borderTopRightRadius: 13, color: mix(color, t.foreground, 0.75), fontSize: 10.5, lineHeight: 16, fontWeight: 700, letterSpacing: 0.84, textAlign: "center", whiteSpace: "nowrap" }}>{label.toUpperCase()}</div>
        <div style={{ height: 46, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, color: t.foreground, fontSize: 19, fontWeight: 700 }}>
          <LIcon C={icon} size={16} color={color} strokeWidth={2.75} />
          {children}
        </div>
      </div>
    </Rise>
  );
}

/** Counts from → to once the card has landed, easing out, as Duolingo's tickers do. */
function Count({ from, to, delay, format }: { t: Theme; from: number; to: number; delay: number; format: (n: number) => string }) {
  const p = useTween(Math.min(900, 250 + Math.abs(to - from) * 60), delay, (q) => 1 - (1 - q) ** 3);
  return <div style={{ whiteSpace: "nowrap" }}>{format(Math.round(from + (to - from) * p))}</div>;
}

// --- screen two: the streak ---------------------------------------------------

/** A pixel flame: grey and still until it catches. */
const FLAME = [".....a......", ".....aa.....", "....aaa.....", "....aaaa..a.", "...aaaaa..a.", "...aaabaa.aa", "..aaabbaaaaa", "..aabbbbaaaa", ".aaabbccbaaa", ".aabbcccbbaa", ".aabcccccbaa", ".aabcccccba.", "..abbcccbba.", "...aabbbaa.."];

const flameSvg = (k: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 14" shape-rendering="crispEdges">${FLAME.flatMap((row, y) => [...row].map((c, x) => (c === k ? `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>` : ""))).join("")}</svg>`;
/** One flame in three tints (rim a, body b, heart c): a monochrome mask each. */
function FlameImg({ colors, motion }: { colors: [string, string, string]; motion?: object }) {
  const fill = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" } as const;
  return (
    <div style={fill} motion={motion as never}>
      {["a", "b", "c"].map((k, i) => <svg key={k} source={flameSvg(k)} style={{ ...fill, color: colors[i] }} />)}
    </div>
  );
}

function Flame({ t }: { t: Theme }) {
  const w = warning(t), err = t.dark ? "rgba(251,65,74,1)" : "rgba(251,44,54,1)";
  const lit: [string, string, string] = [mix(w, err, 0.75), w, mix(w, "rgba(255,255,255,1)", 0.35)];
  const grey: [string, string, string] = ["rgba(91,93,100,1)", "rgba(110,112,120,1)", "rgba(133,135,143,1)"];
  // 84x98 about the bottom centre of a 144 box; gg-ignite then gg-flicker (steps(2), 1.6s)
  const fw = 84, fh = 98, cx = 72, bottom = 72 + fh / 2;
  const box = (sx: number, sy: number) => ({ left: cx - (fw * sx) / 2, top: bottom - fh * sy, width: fw * sx, height: fh * sy });
  const ignite = useKeyframes(useAfter(250), [
    { at: 0, style: box(0.82, 0.82) }, { at: 0.45, style: box(1.2, 1.2), ease: EASE_BOUNCE }, { at: 0.75, style: box(0.95, 0.95), ease: EASE_BOUNCE }, { at: 1, style: box(1, 1), ease: EASE_BOUNCE },
  ], 700);
  const [flick, setFlick] = useState(-1);
  useEffect(() => {
    let i: ReturnType<typeof setInterval>;
    const start = setTimeout(() => { setFlick(0); let n = 0; i = setInterval(() => setFlick(++n % 4), 400); }, 1300 + 400);
    return () => { clearTimeout(start); clearInterval(i); };
  }, []);
  const FLK = [[1, 1], [0.99, 1.02], [0.98, 1.04], [0.99, 1.02]];
  const m = flick < 0 ? ignite : { initial: box(1, 1), animate: box(FLK[flick][0], FLK[flick][1]), transition: { duration: 0.001 } };
  return (
    <div style={{ position: "absolute", left: cx - fw / 2, top: bottom - fh, width: fw, height: fh }} motion={m as never}>
      <FlameImg colors={grey} />
      <FlameImg colors={lit} motion={{ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.36, delay: 0.25, ease: "easeOut" } }} />
    </div>
  );
}

/** The old count rolls up and out as the new one rolls in from below. */
function Roll({ from, to, t }: { from: number; to: number; t: Theme }) {
  const H = 79.2, wd = Math.max(String(from).length, String(to).length) * 46;
  const num = (n: number, m: object, init: object, top: number) => (
    <div style={{ position: "absolute", left: 0, right: 0, top, height: H, textAlign: "center", fontSize: 72, lineHeight: H, fontWeight: 900, color: warning(t) }} motion={m as never}>{String(n)}</div>
  );
  return (
    <div style={{ position: "relative", width: wd, height: H, overflow: "hidden", marginTop: -4 }}>
      {num(from, { initial: { top: 0, opacity: 1 }, animate: { top: -H, opacity: 0 }, transition: { duration: 0.42, delay: 0.48, ease: E } }, {}, 0)}
      {num(to, { initial: { top: H, opacity: 0 }, animate: { top: 0, opacity: 1 }, transition: { duration: 0.52, delay: 0.48, ease: EASE_BOUNCE } }, {}, H)}
    </div>
  );
}

function Tile({ w, color, edge, delay, children }: { w: number; color: string; edge?: string; delay: number; children?: ReactNode }) {
  const m = useKeyframes(useAfter(delay), popFrames(w / 2, w / 2, w, w), 420);
  const N = 2, fill = { position: "absolute", backgroundColor: color } as const;
  return (
    <div style={{ position: "relative", width: w, height: w, flexShrink: 0 }}>
      <div style={{ position: "absolute", ...around(w / 2, w / 2, w, w, 0.3) }} motion={m}>
        <div style={{ ...fill, left: 0, right: 0, top: N, bottom: N }} />
        <div style={{ ...fill, top: 0, bottom: 0, left: N, right: N }} />
        {edge && <><div style={{ position: "absolute", left: 0, right: 0, bottom: 2, height: 1, backgroundColor: edge }} /><div style={{ position: "absolute", left: N, right: N, bottom: 0, height: 2, backgroundColor: edge }} /></>}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      </div>
    </div>
  );
}

function Streak({ win, t, s, locale }: { win: Win; t: Theme; s: UiStrings; locale: string }) {
  const st = win.streak!, days = week(st.days), w = warning(t);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const message = isMilestone(st.after) ? s.streakMilestone : st.after === 1 ? s.streakFirst : s.streakKeep;
  const runs = days.map((d, i) => d.done && i > 0 && days[i - 1].done);
  const col = (CW - 2 - 32 - 24) / 7;
  const embers = useMemo(() => SPARKS.slice(0, 8), []);
  return (
    <>
      <div style={{ position: "relative", width: 144, height: 144, flexShrink: 0 }}>
        <Radial color={w} a={0.7} style={{}} motion={{ initial: { ...around(72, 72, 96, 96, 0.2), opacity: 0.9 }, animate: { ...around(72, 72, 96, 96, 2.4), opacity: 0 }, transition: { duration: 0.8, delay: 0.24, ease: E } }} />
        {embers.map(([dx, dy], i) => <Spark key={i} dx={dx * 1.1} dy={dy * 1.1} d={300 + i * 20} size={6} plus={false} cx={72} cy={72} color={w} />)}
        <Flame t={t} />
      </div>
      <Roll from={st.before} to={st.after} t={t} />
      <Rise d={650}><div style={{ fontSize: 18, lineHeight: 28, fontWeight: 700, letterSpacing: 0.45, color: w, textAlign: "center" }}>{s.streakLabel.toUpperCase()}</div></Rise>

      <Rise d={760} style={{ marginTop: 24 }}>
        <div style={{ width: "100%", borderRadius: 18, borderWidth: 1, borderColor: t.glassBorder, backgroundColor: t.glass, paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 14,
          boxShadow: t.dark ? [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.05)", inset: true }, { offsetX: 0, offsetY: 24, blurRadius: 72, spreadRadius: -20, color: "rgba(0,0,0,0.8)" }]
            : { offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -24, color: "rgba(0,0,0,0.28)" } }}>
          <div style={{ display: "grid", gridTemplateColumns: 7, gap: 4 }}>
            {days.map((d, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, lineHeight: 16, fontWeight: 700, color: d.isToday ? w : t.mutedForeground }}>{fmt.format(d.date)}</div>
                <div style={{ position: "relative", width: "100%", height: 28, display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
                  {runs[i] && <div style={{ position: "absolute", top: 11, left: -col / 2, width: col, height: 6, backgroundColor: alpha(w, 0.55) }}
                    motion={{ initial: { width: 0 }, animate: { width: col }, transition: { duration: 0.3, delay: (950 + i * 60) / 1000, ease: E } }} />}
                  <Tile w={28} delay={900 + i * 60} color={d.done ? w : alpha(t.mutedForeground, 0.15)} edge={d.done ? mix(w, "rgba(0,0,0,1)", 0.7) : undefined}>
                    {d.done && <LIcon C={Check} size={14} color="#ffffff" strokeWidth={3.5} />}
                  </Tile>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Rise>
      <Rise d={1050} style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, lineHeight: 20, color: t.mutedForeground, textAlign: "center" }}>{message.replace("{n}", String(st.after)).replace("{next}", String(st.after + 1))}</div>
      </Rise>
    </>
  );
}
