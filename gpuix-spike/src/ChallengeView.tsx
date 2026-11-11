// Port of src/views/ChallengeView.tsx. Shell.tsx lays out the row (672 px body + the
// outline's 192 px column); this is the body. Headings register with nav/outline via lesson.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { byId, challengeTitle, indexOf, moduleOf, moduleTitle, CHALLENGES, TOTAL_CHALLENGES } from "../../src/challenges";
import { loadChallenge } from "../../src/lib/content";
import { setHeaderTitle } from "../../src/lib/headerTitle";
import { PREDICTIONS } from "../../src/lib/predictions";
import { useProgress } from "../../src/lib/progress";
import { strings } from "../../src/strings";
import { renderer } from "./boot";
import { Btn } from "./challenge/atoms";
import { LinkPreviewHost } from "./challenge/LinkPreview";
import { Mascot, mascotAt } from "./challenge/Mascot";
import { FolderPanel, RepoGraph, TerminalPanel } from "./challenge/Panels";
import { Predict } from "./challenge/Predict";
import { extra } from "./challenge/rich";
import { VerifyBlock } from "./challenge/VerifyBlock";
import { Flow, lessonBlocks, type Block } from "./lesson";
import type { Route } from "./Shell";
import { FONT, type Theme } from "./theme";

const CARD = { mt: 24, mb: 24 }; // `my-6` on the verify box, predict box and live panels

export function Challenge({ t, locale, id, go }: { t: Theme; locale: string; id: string; go: (r: Route) => void }) {
  const challenge = byId(id);
  const s = strings(locale);
  if (!challenge) {
    // A stale bookmark or a typed hash should not leave a blank window.
    return (
      <div style={{ width: "100%", maxWidth: 672, paddingLeft: 24, paddingRight: 24, paddingTop: 40, paddingBottom: 40, fontFamily: FONT }}>
        <div style={{ fontSize: 20, lineHeight: 28, fontWeight: 600, color: t.foreground }}>{s.notFoundTitle}</div>
        <div style={{ marginTop: 16, fontSize: 14, lineHeight: 20, fontWeight: 500, color: t.primary, cursor: "pointer", textDecoration: "underline" }} onClick={() => go({ name: "home" })}>{s.notFoundBack}</div>
      </div>
    );
  }
  return <Body t={t} locale={locale} challenge={challenge} go={go} />;
}

function Body({ t, locale, challenge, go }: { t: Theme; locale: string; challenge: NonNullable<ReturnType<typeof byId>>; go: (r: Route) => void }) {
  const s = strings(locale), x = extra(t);
  const index = indexOf(challenge.id);
  const { isComplete, progress } = useProgress();
  const done = isComplete(challenge.id);
  const savedDir = progress.savedDir;
  // Re-rolling the guide is per-challenge: the next challenge starts from its own face.
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [challenge.id]);
  const mascotId = mascotAt(index, offset)?.id;
  const title = challengeTitle(challenge, locale);
  const mod = moduleOf(challenge);
  const eyebrow = `${mod ? moduleTitle(mod, locale) : s.challenges} · ${index + 1} ${s.eyebrowOf} ${TOTAL_CHALLENGES}`;

  const body = useMemo(() => loadChallenge(locale, challenge.file), [locale, challenge.file]);
  const blocks = useMemo(() => {
    // The prediction goes where the lesson stops explaining and starts instructing:
    // before its first step box, so it is asked before the answer is on the page.
    const at = PREDICTIONS[challenge.id] ? body.before.indexOf('<div class="chal-step') : -1;
    const lesson = (html: string) => lessonBlocks(html, t);
    const out: Block[] = at < 0 ? lesson(body.before) : [
      ...lesson(body.before.slice(0, at)),
      { el: <Predict key={`p-${challenge.id}`} t={t} challengeId={challenge.id} locale={locale} />, ...CARD },
      ...lesson(body.before.slice(at)),
    ];
    // `key` remounts on navigation, so one challenge's results never show under the next.
    out.push({ el: <VerifyBlock key={challenge.id} t={t} challenge={challenge} locale={locale} mascotId={mascotId} />, ...CARD });
    if (challenge.needsDirectory && challenge.module === "git" && savedDir) out.push({ el: <RepoGraph t={t} dir={savedDir} locale={locale} challengeId={challenge.id} />, ...CARD });
    if (challenge.module === "files" && challenge.needsDirectory && savedDir) out.push({ el: <FolderPanel t={t} dir={savedDir} locale={locale} />, ...CARD });
    if (challenge.module === "terminal" || (challenge.module === "files" && !challenge.needsDirectory)) out.push({ el: <TerminalPanel t={t} locale={locale} />, ...CARD });
    if (body.after) out.push(...lesson(body.after));
    return out;
  }, [body, t, challenge, locale, mascotId, savedDir]);

  // Test hook: GG_CLICKS="x,y;x,y" simulates clicks 1.2 s apart (boot.ts's GG_CLICK does one).
  useEffect(() => {
    const t = (process.env.GG_CLICKS ?? "").split(";").filter(Boolean).map((p, i) => setTimeout(() => { const [x, y] = p.split(",").map(Number); renderer.simulateClick(x, y); }, 1500 + i * 1200));
    return () => t.forEach(clearTimeout);
  }, []);

  // Hand the heading, and the guide that belongs to it, to the title bar once the real one has
  // scrolled out from under it. The browser watches with an IntersectionObserver; here it is
  // a cheap look at the heading's painted bounds. 52 = the title bar's height.
  const heading = useRef<{ id: number }>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const b = heading.current && renderer.getElementBounds(heading.current.id);
      if (b) setHeaderTitle(b.y + b.height <= 52 ? { eyebrow, title, mascotId } : null);
    }, 100);
    return () => { clearInterval(id); setHeaderTitle(null); };
  }, [title, eyebrow, mascotId]);

  const prev = CHALLENGES[index - 1], next = CHALLENGES[index + 1];
  return (
    <div style={{ width: "100%", minWidth: 0, paddingTop: 32, paddingBottom: 32, fontFamily: FONT, marginTop: -Number(process.env.GG_Y ?? 0) }}>
      <div style={{ width: "100%" }}>
        <div ref={heading as never} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Mascot t={t} index={index} offset={offset} onCycle={() => setOffset((o) => o + 1)} />
          <div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontSize: 12, lineHeight: 16, color: t.mutedForeground }}>{eyebrow}</div>
              {done && <div style={{ borderRadius: 999, backgroundColor: x.successSurface, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, fontSize: 11, lineHeight: 16.5, fontWeight: 500, color: t.successForeground }}>{s.completedBadge}</div>}
            </div>
            <div style={{ fontSize: 24, lineHeight: 32, fontWeight: 600, letterSpacing: -0.6, color: t.foreground }}>{title}</div>
          </div>
        </div>

        <LinkPreviewHost t={t}>
          <div style={{ marginTop: 24, width: "100%", fontSize: 15, lineHeight: 25, color: t.foreground }}><Flow blocks={blocks} /></div>
        </LinkPreviewHost>

        <div style={{ marginTop: 40, paddingTop: 16, borderTopWidth: 1, borderColor: t.border, display: "flex", flexDirection: "row", alignItems: "center" }}>
          <Btn t={t} variant="outline" onClick={() => go(prev ? { name: "challenge", id: prev.id } : { name: "home" })}>{`← ${prev ? challengeTitle(prev, locale) : s.navAllChallenges}`}</Btn>
          <div style={{ flexGrow: 1 }} />
          <Btn t={t} variant="outline" onClick={() => go(next ? { name: "challenge", id: next.id } : { name: "finale" })}>{`${next ? challengeTitle(next, locale) : s.navDone} →`}</Btn>
        </div>
      </div>
    </div>
  );
}
