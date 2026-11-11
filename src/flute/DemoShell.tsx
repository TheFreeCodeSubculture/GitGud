import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Surface, useSceneTime } from "@webprodigies/flute";

import { CHALLENGE_IDS } from "~/challenges";
import { Shell } from "~/components/Shell";
import { FALLBACK_LOCALE, resolveLocale } from "~/lib/content";
import { setGitRunner } from "~/lib/git";
import { LayerContext, type LayerProps } from "~/lib/layer";
import { useProgress } from "~/lib/progress";
import { href, type Route } from "~/lib/router";
import "./demo.css";

/** Page size every scene is authored against: a 1440×900 app window. */
export const PAGE = { width: 1440, height: 900 };

// The verifiers talk to Git through Tauri, which a browser tab does not have.
// Route them to the dev server instead (see `demoGit` in vite.config.ts), so a
// Verify click in a scene runs real Git against a real folder.
setGitRunner(async (args, cwd) => {
  const res = await fetch("/__demo/git", { method: "POST", body: JSON.stringify({ args, cwd }) });
  if (!res.ok) throw new Error(`git ${args[0]} is not available in the demo`);
  return res.json();
});

/** What a scene wants the app to look like at a given moment. Omitted = leave alone. */
export type Cue = {
  dark?: boolean;
  /** The first N challenges complete, the rest not. */
  done?: number;
  savedDir?: string | null;
  /** Scroll offset of the page's content area, in px. */
  scroll?: number;
};

/** Zero speed and acceleration at both ends, like Flute's cinematic curve. */
export function ease(from: number, to: number, t: number, start: number, end: number) {
  const p = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return from + (to - from) * p * p * p * (p * (p * 6 - 15) + 10);
}

// Theme is scene state, not the user's stored preference.
let dark = false;
const listeners = new Set<() => void>();
function setDark(next: boolean) {
  if (next === dark) return;
  dark = next;
  listeners.forEach((l) => l());
}
function useDark() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => dark,
  );
}

/** Applies the scene's cue for the current time. Renders nothing. */
function Director({ cue }: { cue: (t: number) => Cue }) {
  const want = cue(useSceneTime());
  const { progress, setCompleted, setSavedDir } = useProgress();

  // Layout effect: the change lands before paint, so a capture at time t sees it.
  useLayoutEffect(() => {
    // Lazy images under a 3D transform may never start loading, and export waits for every image.
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
    if (want.dark !== undefined) setDark(want.dark);
    if (want.done !== undefined) {
      CHALLENGE_IDS.forEach((id, i) => {
        const done = i < want.done!;
        if (Boolean(progress.completed[id]) !== done) setCompleted(id, done);
      });
    }
    if (want.savedDir !== undefined && progress.savedDir !== want.savedDir) setSavedDir(want.savedDir);
    if (want.scroll !== undefined) {
      const main = document.querySelector<HTMLElement>('[data-flute-id="content"] main');
      if (main) main.scrollTop = want.scroll;
    }
  });
  return null;
}

/** Every Layer seam in the app becomes its own Surface. Module-level: a new identity would remount. */
function SurfaceLayer({ id, className, style, children }: LayerProps) {
  return (
    <Surface id={id} className={className} style={style}>
      {children}
    </Surface>
  );
}

/**
 * The app's real Shell around one view, split into depth layers.
 *
 * Not `<App />`: in a plain browser there is no Tauri backend, so App would
 * paint its "Git is missing" banner across every shot.
 *
 * `open` lets the home view's panels separate from the content layer. It also
 * unclips the scroll area, so it only suits pages that fit the window.
 */
export function DemoShell({
  route,
  cue,
  open = false,
  children,
}: {
  route: Route;
  cue: (t: number) => Cue;
  open?: boolean;
  children: (locale: string) => ReactNode;
}) {
  // Shell and the views read the route from the hash. replaceState rather than
  // assigning the hash: no hashchange, no history entry, no scroll jump.
  const target = href(route);
  if (window.location.hash !== target) history.replaceState(null, "", target);

  const [locale, setLocale] = useState(
    () => localStorage.getItem("git-gud:locale") ?? resolveLocale(navigator.language ?? FALLBACK_LOCALE),
  );
  // Start in the scene's own theme, so the first frame is right and Gitty
  // does not read the initial set as a theme change and cast her spell.
  useState(() => {
    const initial = cue(0).dark;
    if (initial !== undefined) dark = initial;
  });
  const isDark = useDark();

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <>
      <Director cue={cue} />
      <Surface id="page" style={PAGE}>
        <div data-layer-host className={open ? "flute-demo open-content h-full" : "flute-demo h-full"}>
          <LayerContext.Provider value={SurfaceLayer}>
            <Shell locale={locale} onLocaleChange={setLocale} dark={isDark} onDarkChange={setDark}>
              {children(locale)}
            </Shell>
          </LayerContext.Provider>
        </div>
      </Surface>
    </>
  );
}
