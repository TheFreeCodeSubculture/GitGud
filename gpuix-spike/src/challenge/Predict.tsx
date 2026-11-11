// Port of components/Predict.tsx: three small graphs, pick one before running the command.
import { useState } from "react";
import { chime } from "../../../src/lib/celebrate";
import { PREDICTIONS } from "../../../src/lib/predictions";
import { mountRepoFigure, type RepoScene } from "../../../src/lib/repoFigure";
import { strings } from "../../../src/strings";
import type { Theme } from "../theme";
import { Glassy } from "./atoms";
import { Figure } from "./Figure";
import { Runs, alpha, extra, ticks } from "./rich";
import { Icon } from "../ui";
import "./icons";

const key = (id: string) => `gg-predict:${id}`;

export function Predict({ t, challengeId, locale }: { t: Theme; challengeId: string; locale: string }) {
  const s = strings(locale), x = extra(t);
  const p = PREDICTIONS[challengeId];
  const [picked, setPicked] = useState<number | null>(() => {
    const v = localStorage.getItem(key(challengeId));
    return v === null ? null : Number(v);
  });
  const [gridW, setGridW] = useState(638);
  const [hover, setHover] = useState<number | null>(null);
  if (!p) return null;

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    localStorage.setItem(key(challengeId), String(i));
    if (i === p!.answer) chime([783.99, 1046.5], 0.04);
  }

  const right = picked === p.answer;
  // One scale for all three, sized to the biggest, so a small option looks small rather than zoomed in.
  const frame = {
    slots: Math.max(3, ...p.options.map((o) => o.scene.nodes.length)),
    lanes: Math.max(1, ...p.options.map((o) => Math.max(1, ...o.scene.nodes.map((n) => n.lane + 1)))),
    remote: p.options.some((o) => o.scene.remote),
  };
  const tint = picked === null ? x.info : right ? t.success : x.warning;
  const thumb = Math.floor((gridW - 20) / 3 - 16);
  const wash = t.muted;

  return (
    <Glassy t={t} tint={tint}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, fontSize: 11, lineHeight: 16, fontWeight: 700, letterSpacing: 0.275, color: x.infoForeground }}>
        <Icon name="sparkles" size={14} color={x.infoForeground} />{s.predictEyebrow.toUpperCase()}
      </div>
      <div style={{ marginTop: 6, fontWeight: 500 }}><Runs size={15} lineHeight={22.5} color={t.foreground} runs={ticks(p.ask, wash, { weight: 500 })} /></div>

      <div onLayout={(e) => setGridW(e.width ?? 638)} style={{ marginTop: 12, display: "flex", flexDirection: "row", gap: 10 }}>
        {p.options.map((o, i) => {
          const isAnswer = i === p.answer;
          const state = picked === null ? "open" : isAnswer ? "right" : picked === i ? "wrong" : "other";
          const look = {
            open: { borderColor: hover === i ? alpha(t.primary, 0.6) : t.border },
            right: { borderColor: t.success, backgroundColor: x.successSurface },
            wrong: { borderColor: x.error, backgroundColor: x.errorSurface },
            other: { borderColor: t.border, opacity: 0.55 },
          }[state];
          return (
            <div key={o.label} onClick={() => pick(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ position: "relative", flexGrow: 1, flexBasis: 0, minWidth: 0, display: "flex", flexDirection: "column", borderRadius: 8, borderWidth: 2, padding: 6, paddingBottom: 10,
                backgroundColor: alpha(t.card, 0.5), cursor: picked === null ? "pointer" : "default", ...look }}>
              <div style={{ marginBottom: 6 }}>
                <Figure t={t} width={thumb} deps={[`${challengeId}-${i}`, thumb]}
                  mount={(st, sv) => mountRepoFigure(st, sv, { ...o.scene, frame } as RepoScene, () => {})} />
              </div>
              <div style={{ paddingLeft: 4, paddingRight: 4, fontSize: 12, lineHeight: 16.5, color: t.foreground }}>{o.label}</div>
              {(state === "right" || state === "wrong") && (
                <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: state === "right" ? t.success : x.error }}
                  motion={{ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, ease: "easeOut" } }}>
                  <Icon name={state === "right" ? "check" : "x"} size={14} color="#ffffff" strokeWidth={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picked !== null && (
        <div style={{ marginTop: 12 }} motion={{ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.42, delay: 0.08, ease: [0.23, 1, 0.32, 1] } }}>
          <Runs color={t.foreground} runs={[
            { text: right ? s.predictRight : s.predictWrong, weight: 600, color: right ? t.successForeground : x.warningForeground },
            { text: " " }, ...ticks(p.why, wash), { text: " " }, { text: s.predictNow, color: t.mutedForeground },
          ]} />
        </div>
      )}
    </Glassy>
  );
}
