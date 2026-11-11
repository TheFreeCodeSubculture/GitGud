// Port of src/views/Home.tsx + HomeScene + QuestMap.
import { join } from "node:path";
import { useEffect, useState } from "react";
import { grouped, moduleTitle, challengeTitle, indexOf } from "../../src/challenges";
import { requestConfirmDialog } from "../../src/lib/confirmDialog";
import { nextIncomplete, useProgress } from "../../src/lib/progress";
import type { Route } from "../../src/lib/router";
import "./challenge/icons"; // rotate-ccw
import { strings } from "../../src/strings";
import { PUBLIC, ROOT } from "./boot";
import { ASPECT, Glass } from "./glass";
import { Button, EASE_OUT_STRONG, Icon, useKeyframes, withAlpha } from "./ui";
import { FONT, type Theme } from "./theme";

const BAKED = join(ROOT, "assets", "baked");
const GROUND = 0.895, GITTY_HEIGHT = 0.32, FEET_INSET = 0.067;

/** Pinned to the pane bottom at the artwork's aspect, as in HomeScene.tsx. */
export function HomeScene({ t, paneW }: { t: Theme; paneW: number }) {
  const sceneH = paneW / ASPECT;
  const gittyH = sceneH * GITTY_HEIGHT;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.sky, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: sceneH }}>
        <img src={join(BAKED, `home-bg-${t.dark ? "dark" : "light"}.png`)} objectFit="cover"
          style={{ position: "absolute", top: 0, left: 0, width: paneW, height: sceneH }} />
        <img src={join(PUBLIC, "gitty", "gitty-rest.webp")}
          style={{ position: "absolute", height: gittyH, width: gittyH * (240 / 135), left: paneW * 0.06,
            bottom: sceneH * (1 - GROUND - FEET_INSET * GITTY_HEIGHT) }} />
      </div>
    </div>
  );
}

/** Stepped (pixel) corners from two overlapping rects: same shape as the CSS
 *  clip-path polygon, with no clip-path. */
function Tile({ color, ring, label, labelColor }: { color: string; ring?: string; label: string; labelColor: string }) {
  const S = 24, N = 2;
  return (
    <div style={{ position: "relative", width: S, height: S, cursor: "pointer" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: N, bottom: N, backgroundColor: color }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: N, right: N, backgroundColor: color }} />
      {ring && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: ring, borderRadius: 2 }} />}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: labelColor }}>{label}</div>
    </div>
  );
}

function Walker() {
  // gg-walker-bob: 1.2s steps(2) → 1px up for half the cycle.
  const [up, setUp] = useState(false);
  useEffect(() => { const i = setInterval(() => setUp((u) => !u), 600); return () => clearInterval(i); }, []);
  return <img src={join(BAKED, "mario.png")} style={{ position: "absolute", width: 18, height: 17, left: 3, top: -17 - (up ? 1 : 0) }} />;
}

function QuestMap({ t, locale, completed, current }: { t: Theme; locale: string; completed: Record<string, boolean>; current: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 12 }}>
      {grouped().map(({ module, items }) => {
        const done = items.filter(({ challenge }) => completed[challenge.id]).length;
        return (
          <div key={module.id} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <div style={{ width: 112, flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, color: t.mutedForeground }}>{moduleTitle(module, locale)}</div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {items.map(({ challenge, index }) => {
                const ok = !!completed[challenge.id];
                const here = index === current;
                return (
                  <div key={challenge.id} style={{ position: "relative" }}>
                    <Tile
                      label={String(index + 1)}
                      color={ok ? t.success : here ? withAlpha(t.primary, 0.2) : withAlpha(t.mutedForeground, 0.12)}
                      ring={here ? t.primary : undefined}
                      labelColor={ok ? "#fff" : here ? t.foreground : t.mutedForeground}
                    />
                    {here && <Walker />}
                  </div>
                );
              })}
            </div>
            <div style={{ flexGrow: 1 }} />
            <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, color: t.mutedForeground }}>{`${done}/${items.length}`}</div>
          </div>
        );
      })}
    </div>
  );
}

/** gg-coin / gg-mario keyframes, played as motion chains. rotateY on the coin
 *  is a horizontal squash, so it's width going 36 → 0 → 36 around its centre. */
function MarioStage({ play, children }: { play: boolean; children: React.ReactNode }) {
  // motion only tweens `top` on absolutely positioned boxes, so centre the
  // sprites from the stage's measured size instead of with flex + translate.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cy = (h: number) => (box.h - h) / 2;
  const coinY = useKeyframes(play, [
    { at: 0, style: { top: cy(36), opacity: 1 } },
    { at: 0.55, style: { top: cy(36) - 110, opacity: 1 }, ease: EASE_OUT_STRONG },
    { at: 1, style: { top: cy(36) - 40, opacity: 0 }, ease: EASE_OUT_STRONG },
  ], 700);
  const coinSpin = useKeyframes(play, [
    { at: 0, style: { width: 36 } },
    { at: 0.275, style: { width: 0 }, ease: "easeIn" },
    { at: 0.55, style: { width: 36 }, ease: "easeOut" },
    { at: 0.775, style: { width: 0 }, ease: "easeIn" },
    { at: 1, style: { width: 36 }, ease: "easeOut" },
  ], 700);
  const mario = useKeyframes(play, [
    { at: 0, style: { top: cy(40) + 70 } },
    { at: 0.5, style: { top: cy(40) - 2 }, ease: "easeInOut" },
    { at: 1, style: { top: cy(40) + 70 }, ease: "easeInOut" },
  ], 600);
  return (
    <div style={{ position: "relative", alignSelf: "flex-start", marginTop: 24 }}
      onLayout={(e) => setBox({ w: e.width ?? 0, h: e.height ?? 0 })}>
      {/* Behind the button: tree order is paint order, there is no z-index. */}
      {play && box.w > 0 && (
        <>
          <div style={{ position: "absolute", left: (box.w - 36) / 2, top: cy(36), width: 36, height: 36, display: "flex", flexDirection: "row", justifyContent: "center", pointerEvents: "none" }} motion={coinY}>
            <img src={join(BAKED, "coin.png")} style={{ height: 36, width: 36 }} motion={coinSpin} />
          </div>
          <img src={join(BAKED, "mario.png")} style={{ position: "absolute", left: (box.w - 44) / 2, top: cy(40) + 70, width: 44, height: 40, pointerEvents: "none" }} motion={mario} />
        </>
      )}
      {children}
    </div>
  );
}

export function Home({ t, locale, onStart, go }: { t: Theme; locale: string; onStart: (origin: { x: number; y: number }) => void; go: (r: Route) => void }) {
  const s = strings(locale);
  const { progress, completedCount, total, allDone, clearAll } = useProgress();
  const started = completedCount > 0;
  const [launching, setLaunching] = useState(false);
  const title = { fontSize: 24, lineHeight: 32, fontWeight: 600, letterSpacing: -0.6, color: t.foreground } as const;
  const body = { marginTop: 8, fontSize: 14, lineHeight: 20, color: t.mutedForeground } as const;

  async function onClearAll() {
    if (await requestConfirmDialog(s.homeClearMsg, { title: s.homeClearTitle, variant: "destructive" })) clearAll();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 672, paddingLeft: 24, paddingRight: 24, paddingTop: 40, paddingBottom: 40, fontFamily: FONT }}>
      <Glass t={t} style={{ padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 }}>
          <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 14, fontWeight: 500, color: t.foreground }}>{s.homeProgressLabel}</div>
          <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 14, color: t.mutedForeground }}>{`${completedCount} / ${total}`}</div>
          <div style={{ flexGrow: 1 }} />
          {started && <Button t={t} variant="ghost" size="icon-sm" onClick={() => void onClearAll()}><Icon name="rotate-ccw" color={t.mutedForeground} /></Button>}
        </div>
        <div style={{ marginTop: 12 }}>
          <QuestMap t={t} locale={locale} completed={progress.completed} current={allDone ? total : indexOf(nextIncomplete(progress.completed))} />
        </div>
      </Glass>

      {!started && (
        <Glass t={t} style={{ marginTop: 24, padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={title}>{s.homeWelcome}</div>
          <div style={{ ...body, lineHeight: 22.75 }}>{s.homeIntro1}</div>
          <div style={{ ...body, marginTop: 12, lineHeight: 22.75 }}>{s.homeIntro2}</div>
          <MarioStage play={launching}>
            <Button t={t} size="lg" onClick={(e) => {
              if (launching) return;
              setLaunching(true);
              // Let the coin reach its peak before the wipe begins, as Home.tsx does.
              setTimeout(() => onStart({ x: e.x ?? 600, y: e.y ?? 400 }), 420);
            }}>{s.homeStart}</Button>
          </MarioStage>
        </Glass>
      )}

      {started && (
        <Glass t={t} style={{ marginTop: 24, padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={title}>{allDone ? s.homeCongrats : s.homeOnWay}</div>
          <div style={body}>{allDone ? s.homeFinished : s.homePickup}</div>
          <Button t={t} size="lg" style={{ marginTop: 24, alignSelf: "flex-start" }}
            onClick={() => go(allDone ? { name: "finale" } : { name: "challenge", id: nextIncomplete(progress.completed) })}>
            {allDone ? s.homeSeeNext : s.homeContinue}
          </Button>
        </Glass>
      )}
    </div>
  );
}

export { challengeTitle };
