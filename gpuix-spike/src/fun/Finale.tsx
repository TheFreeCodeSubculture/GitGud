// Port of views/Finale.tsx: the wall of fame. Data comes from the app's own lib/github.ts.
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, RefreshCw } from "lucide-react";
import { COMPANION } from "../../../src/challenges";
import { configuredUsername, fetchContributors, patchUrl, type Contributor } from "../../../src/lib/github";
import { strings } from "../../../src/strings";
import { FONT, type Theme } from "../theme";
import { LIcon } from "./anim";
import { Md, esc } from "./md";
import { errorForeground, errorSurface } from "./tokens";
import { Button } from "../ui";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; total: number; contributors: Contributor[]; me: string };

/** status-pulse: 2s, opacity 1 → .5 → 1 in 6 steps each way. */
function usePulse(on: boolean) {
  const [o, setO] = useState(1);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const t = Date.now() % 2000;
      setO(t < 800 ? 1 : t < 1000 ? 1 - Math.floor(((t - 800) / 200) * 6) / 12 : t < 1800 ? 0.5 : 0.5 + Math.floor(((t - 1800) / 200) * 6) / 12);
    }, 33);
    return () => clearInterval(id);
  }, [on]);
  return o;
}

export function Finale({ t, locale }: { t: Theme; locale: string }) {
  const s = strings(locale);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [gw, setGw] = useState(622);
  const pulse = usePulse(state.kind === "loading");

  async function load() {
    setState({ kind: "loading" });
    try {
      const [list, me] = await Promise.all([fetchContributors(), configuredUsername()]);
      setState({ kind: "ready", total: list.total, contributors: list.contributors, me: me.toLowerCase() });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }
  useEffect(() => { void load(); }, []);

  const mine = state.kind === "ready" ? state.contributors.find((c) => c.username.toLowerCase() === state.me) : undefined;
  const patches = state.kind === "ready" ? state.contributors.filter((c) => c.patch) : [];
  const cols = Math.max(1, Math.floor(gw / 56)), cell = gw / cols;
  const h2 = { fontSize: 14, lineHeight: 20, fontWeight: 500, color: t.foreground } as const;

  return (
    <div style={{ width: "100%", maxWidth: 672, paddingLeft: 24, paddingRight: 24, paddingTop: 40, paddingBottom: 40, fontFamily: FONT }}>
      <div style={{ fontSize: 30, lineHeight: 36, fontWeight: 600, letterSpacing: -0.75, color: t.foreground }}>{s.finaleTitle}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 22.75, color: t.mutedForeground }}>{s.finaleIntro}</div>

      {state.kind === "loading" && <div style={{ marginTop: 32, fontSize: 14, lineHeight: 20, color: t.mutedForeground, opacity: pulse }}>{s.finaleFetching}</div>}

      {state.kind === "error" && (
        <div style={{ marginTop: 32, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: errorSurface(t), padding: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 20, color: errorForeground(t) }}>{state.message}</div>
          <div style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>{s.finaleNeedsConn}</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "row" }}>
            <Button t={t} variant="outline" onClick={() => void load()}><LIcon C={RefreshCw} size={14} color={t.foreground} />{s.finaleRetry}</Button>
          </div>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {mine?.patch && (
            <div style={{ marginTop: 32, display: "flex", flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, padding: 16 }}>
              <img src={patchUrl(mine.patch)} style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 8, borderWidth: 1, borderColor: t.border }} />
              <div style={{ flexShrink: 1, flexGrow: 1, minWidth: 0 }}>
                <div style={h2}>{s.finaleYourPatch}</div>
                <div style={{ marginTop: 4 }}>
                  <Md t={t} size={14} lineHeight={20} src={s.finalePatchDesc.split("{username}").map(esc).join(`**@${esc(mine.username)}**`)} />
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={h2}>{s.finaleQuilt}</div>
              <div style={{ fontSize: 12, lineHeight: 16, color: t.mutedForeground }}>{`${state.total.toLocaleString()} ${state.total === 1 ? s.finalePersonOne : s.finalePeopleMany}`}</div>
            </div>
            {patches.length > 0 ? (
              // Gapless on purpose: it should read as one piece of cloth.
              <div style={{ marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: t.border, overflow: "hidden", display: "grid", gridTemplateColumns: cols }} onLayout={(e) => setGw((e.width ?? 624) - 2)}>
                {patches.slice(0, 120).map((c) => (
                  <div key={c.username} onClick={() => void openUrl(`https://github.com/${c.username}`)} style={{ width: cell, height: cell, cursor: "pointer", ...(c.username.toLowerCase() === state.me ? { outlineWidth: 2, outlineColor: t.primary, outlineOffset: -2 } : {}) }}>
                    <img src={patchUrl(c.patch as string)} style={{ width: "100%", height: "100%" }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: t.border, padding: 16, textAlign: "center", fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>{s.finaleEmpty}</div>
            )}
          </div>

          <div style={{ marginTop: 32 }}>
            <div style={h2}>{s.finaleNext}</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>
              {[s.finaleNext1, s.finaleNext2, s.finaleNext3, s.finaleNext4].map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          <div style={{ marginTop: 32, display: "flex", flexDirection: "row" }}>
            <Button t={t} size="lg" onClick={() => void openUrl(COMPANION.pages)}>{s.finaleSeeOnline}<LIcon C={ExternalLink} size={14} color={t.primaryForeground} /></Button>
          </div>
        </>
      )}
    </div>
  );
}

