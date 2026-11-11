// Port of components/VerifyBlock.tsx. The checks themselves (src/lib/verify) run unchanged.
import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CHALLENGES, challengeTitle, indexOf, moduleOf, moduleTitle, type Challenge } from "../../../src/challenges";
import { cardsSince, scanCards } from "../../../src/lib/cardCollector";
import { HINTS, recentTypo, type Typo } from "../../../src/lib/hints";
import { celebrate, type Win } from "../../../src/lib/moments";
import { currentProgress, today, useProgress, type Progress } from "../../../src/lib/progress";
import { describeChanges, snapshot, type RepoSnapshot } from "../../../src/lib/repoState";
import { shellHistory } from "../../../src/lib/shell";
import { streakLength } from "../../../src/lib/streak";
import { passed, toneOf, verifierFor, type CheckResult, type ResultTone } from "../../../src/lib/verify";
import { strings, type UiStrings } from "../../../src/strings";
import { FONT, MONO, type Theme } from "../theme";
import { Btn, Glassy, PingDot } from "./atoms";
import { mascotSrc } from "./Mascot";
import { Runs, alpha, extra, ticks, type Run } from "./rich";
import { Icon } from "../ui";
import "./icons";

/** The directory prompt in the learner's language; only these two override the challenge's own. */
function localizedDirPrompt(id: string, t: UiStrings): string | undefined {
  if (id === "you_are_here") return t.dirPromptHome;
  if (id === "make_it_so") return t.dirPromptPractice;
  return undefined;
}

// The repository as it was at the last passing check, so "what changed" covers everything since.
const baselineKey = (dir: string) => `gg-baseline:${dir}`;
function readBaseline(dir: string): RepoSnapshot | null {
  try { return JSON.parse(localStorage.getItem(baselineKey(dir)) ?? "null"); } catch { return null; }
}
const writeBaseline = (dir: string, s: RepoSnapshot) => localStorage.setItem(baselineKey(dir), JSON.stringify(s));

// Checks that only read this computer, so they can run every few seconds and tick steps off.
const LIVE = new Set([
  "meet_the_terminal", "command_performance", "you_are_here", "there_and_back_again", "make_it_so", "get_git",
  "repository", "commit_to_it", "remote_control", "forks_and_clones", "branches_arent_just_for_birds",
]);
const LIVE_MS = 2500; // ponytail: a file watcher would be instant
const STUCK_MS = 60_000;

/** What the celebration shows, worked out from progress before and after the pass. */
async function winFor(challenge: Challenge, before: Progress, after: Progress, openedAt: number, hintsUsed: number, locale: string, mascotId?: string): Promise<Win> {
  await scanCards();
  const total = CHALLENGES.length;
  const count = (p: Progress) => CHALLENGES.filter((c) => p.completed[c.id]).length;
  const inModule = CHALLENGES.filter((c) => c.module === challenge.module);
  const moduleDone = inModule.every((c) => after.completed[c.id]) && !inModule.every((c) => before.completed[c.id]);
  const courseDone = count(after) === total;
  const firstToday = !before.days.includes(today());
  const index = indexOf(challenge.id);
  const nextId = CHALLENGES.slice(index + 1).find((c) => !after.completed[c.id])?.id ?? CHALLENGES.find((c) => !after.completed[c.id])?.id;
  const mod = moduleOf(challenge);
  return {
    challengeId: challenge.id,
    title: challengeTitle(challenge, locale),
    mascotId,
    moduleDone: moduleDone && mod ? moduleTitle(mod, locale) : undefined,
    courseDone,
    course: { before: count(before), after: count(after), total },
    seconds: Math.max(1, Math.round((Date.now() - openedAt) / 1000)),
    hintsUsed,
    newCards: cardsSince(openedAt),
    streak: firstToday ? { before: streakLength(before.days), after: streakLength(after.days), days: after.days } : undefined,
    next: courseDone ? { kind: "finale" } : nextId ? { kind: "challenge", id: nextId } : null,
  };
}

/** The verify box: pick a folder, check, see each step tick off, ask for hints. */
export function VerifyBlock({ t, challenge, locale, mascotId }: { t: Theme; challenge: Challenge; locale: string; mascotId?: string }) {
  const s = strings(locale), x = extra(t);
  const { progress, isComplete, setCompleted, setSavedDir } = useProgress();

  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathWarning, setPathWarning] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [typo, setTypo] = useState<Typo | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  /** Whether the shown results came from the button, which may show failures in red. */
  const [manual, setManual] = useState(false);
  const openedAt = useRef(Date.now());
  const busy = useRef(false);
  const lastKey = useRef("");

  const verifier = verifierFor(challenge.id);
  const done = isComplete(challenge.id);
  const dir = progress.savedDir;
  const tracksRepo = challenge.needsDirectory && challenge.module === "git";
  const hints = HINTS[challenge.id];
  const live = LIVE.has(challenge.id) && !done && (!challenge.needsDirectory || Boolean(dir));
  // While checks run on their own, help waits until the learner has been at it a while.
  const [stuck, setStuck] = useState(false);
  useEffect(() => { const id = setTimeout(() => setStuck(true), STUCK_MS); return () => clearTimeout(id); }, []);

  // Seed the baseline the first time a folder is seen, and again if it was recreated or its history went backwards.
  useEffect(() => {
    if (!tracksRepo || !dir) return;
    snapshot(dir).then((now) => {
      const was = readBaseline(dir);
      if (!was || !now.repo || now.commits < was.commits) writeBaseline(dir, now);
    }).catch(() => {});
  }, [tracksRepo, dir]);

  async function pickDirectory() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") { setSavedDir(picked); setPathWarning(false); }
  }

  async function check(byHand: boolean) {
    if (challenge.needsDirectory && !dir) { if (byHand) setPathWarning(true); return; }
    if (busy.current) return;
    busy.current = true;
    if (byHand) { setRunning(true); setError(null); setResults(null); setChanges([]); setTypo(null); }
    try {
      const out = await verifier!({ path: dir ?? undefined, invitedFriend: progress.invitedFriend });
      // A silent check that found nothing new should not re-render the list.
      const key = JSON.stringify(out);
      const changed = key !== lastKey.current;
      if (byHand || changed) { lastKey.current = key; setResults(out); setManual(byHand); }
      // Only ever set completion to true here: a passed challenge must not silently un-complete.
      if (passed(out)) {
        const before = currentProgress();
        const first = !before.completed[challenge.id];
        setCompleted(challenge.id, true);
        setManual(true);
        if (tracksRepo && dir) {
          const after = await snapshot(dir).catch(() => null);
          const was = readBaseline(dir);
          if (after && was) setChanges(describeChanges(was, after));
          if (after) writeBaseline(dir, after);
        }
        if (first) celebrate(await winFor(challenge, before, currentProgress(), openedAt.current, hintLevel, locale, mascotId));
      } else if (byHand || changed) {
        setTypo(recentTypo(await shellHistory().catch(() => [])));
      }
    } catch (e) {
      if (byHand) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      if (byHand) setRunning(false);
    }
  }

  // Live: check quietly until the challenge passes.
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (!live) return;
    void checkRef.current(false);
    const id = setInterval(() => void checkRef.current(false), LIVE_MS);
    return () => clearInterval(id);
  }, [live, dir]);

  if (!verifier) {
    return <div style={{ width: "100%", borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: t.border, padding: 16, textAlign: "center", fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>{s.noCheck}</div>;
  }

  const TONE: Record<ResultTone, { color: string; bg?: string }> = {
    done: { color: t.successForeground },
    failed: { color: x.errorForeground, bg: x.errorSurface },
    "optional-done": { color: alpha(t.successForeground, 0.85) },
    "optional-todo": { color: t.mutedForeground },
  };
  const row = { display: "flex", flexDirection: "row", alignItems: "center" } as const;
  const codeBg = (c: string): Run["code"] => ({ bg: t.muted, color: c });

  return (
    <Glassy t={t} tint={done ? t.success : undefined} border={alpha(done ? t.success : t.primary, 0.32)}>
      <div style={{ ...row, flexWrap: "wrap", gap: 8 }}>
        {challenge.needsDirectory && (
          <Btn t={t} variant="outline" disabled={running} onClick={() => void pickDirectory()}>
            <Icon name="folder-open" size={16} color={t.foreground} />{dir ? s.changeDirectory : s.selectDirectory}
          </Btn>
        )}
        <Btn t={t} disabled={running} onClick={() => void check(true)}>
          {running && <Icon name="loader" size={16} color={t.primaryForeground} />}
          {running ? s.checking : done ? s.checkAgain : s.verify}
        </Btn>
        {live && (
          <div style={{ ...row, gap: 6, marginLeft: 4, fontSize: 12, lineHeight: 16, color: t.mutedForeground }}>
            <PingDot color={t.success} />{s.liveWatching}
          </div>
        )}
        {done && (
          <Btn t={t} variant="ghost" onClick={() => { setCompleted(challenge.id, false); setResults(null); lastKey.current = ""; }}>
            <Icon name="rotate-ccw" size={14} color={t.mutedForeground} />{s.clearStatus}
          </Btn>
        )}
      </div>

      {challenge.needsDirectory && (
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 12, lineHeight: 16, color: pathWarning ? x.errorForeground : t.mutedForeground }}>
          {/* `break-all`: a zero-width space between characters lets a long path wrap anywhere. */}
          {dir ? [...dir].join("​") : localizedDirPrompt(challenge.id, s) ?? challenge.dirPrompt ?? s.pathRequired}
        </div>
      )}

      {error && <div style={{ marginTop: 12, borderRadius: 6, backgroundColor: x.errorSurface, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, fontSize: 14, lineHeight: 20, color: x.errorForeground }}>{error}</div>}

      {results && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map((result, i) => {
            // Before the learner asks, an unmet step is a to-do, not a failure.
            const tone = TONE[!manual && !result.passed ? "optional-todo" : toneOf(result)];
            return (
              <div key={`${result.message}-${i}`} style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, backgroundColor: tone.bg }}>
                <div style={{ marginTop: 2 }}>
                  <Icon name={result.passed ? "check" : result.optional || !manual ? "circle" : "x"} size={16} color={tone.color} />
                </div>
                <div style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
                  <Runs color={tone.color} runs={[...ticks(result.message, t.muted, { color: tone.color }).map((r) => (r.code ? { ...r, code: codeBg(tone.color) } : r)), ...(result.optional ? [{ text: s.optionalSuffix }] : [])]} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {changes.length > 0 && (
        <div style={{ marginTop: 12, borderRadius: 6, borderWidth: 1, borderColor: alpha(t.success, 0.24), backgroundColor: alpha(x.successSurface, 0.031), paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ ...row, gap: 6, fontSize: 14, lineHeight: 20, fontWeight: 500, color: t.successForeground }}>
            <Icon name="sparkles" size={14} color={t.successForeground} />{s.whatChanged}
          </div>
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            {changes.map((c) => (
              <div key={c} style={{ display: "flex", flexDirection: "row" }}>
                <div style={{ width: 20, flexShrink: 0, textAlign: "right", paddingRight: 8, fontSize: 14, lineHeight: 20, color: alpha(t.foreground, 0.9) }}>•</div>
                <div style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}><Runs color={alpha(t.foreground, 0.9)} runs={ticks(c, t.muted)} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && !passed(results) && (manual || stuck) && (typo || hints) && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 6, borderWidth: 1, borderColor: t.border, backgroundColor: alpha(t.card, 0.6), padding: 12 }}>
          {mascotId && (
            <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, overflow: "hidden" }}>
              <img src={mascotSrc(mascotId)} style={{ width: 34, height: 34, borderRadius: 17 }} />
            </div>
          )}
          <div style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, fontFamily: FONT }}>
            {typo && (
              <Runs color={t.foreground} runs={[
                { text: s.typoPrefix },
                { text: typo.typed, code: { bg: x.errorSurface, color: x.errorForeground } },
                { text: `— ${s.typoMeant}` },
                { text: typo.meant, code: { bg: t.muted } },
                { text: "?" },
              ]} />
            )}
            {hints?.slice(0, hintLevel).map((h, i) => (
              <Runs key={i} color={t.foreground} runs={[{ text: s.hintLevels[i].toUpperCase(), weight: 500, size: 12, spacing: 0.3, color: t.mutedForeground }, ...ticks(h, t.muted)]} />
            ))}
            {hints && hintLevel < hints.length && (
              <div style={{ alignSelf: "flex-start", marginLeft: -8 }}>
                <Btn t={t} variant="ghost" sm onClick={() => setHintLevel((n) => n + 1)}>
                  <Icon name="lightbulb" size={14} color={t.mutedForeground} />{hintLevel === 0 ? s.hintAsk : s.hintMore}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </Glassy>
  );
}
