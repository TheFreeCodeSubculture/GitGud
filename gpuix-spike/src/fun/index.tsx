// What main.tsx mounts for this slice:
//   <FunRoute t locale route />   in the Shell's content slot for deck / finale / page routes
//   <FunOverlays t locale go />   last child of the root (celebration, card toasts, confetti)
//   useFunCollector()             once at the root: polls the shell history for new cards
// To celebrate, call the app's own `celebrate(win)` from src/lib/moments (nothing GPUIX-specific).
import type { Route } from "../Shell";
import type { Theme } from "../theme";
import { useCardCollector } from "../../../src/lib/cardCollector";
import { CardToasts } from "./CardToasts";
import { Celebration } from "./Celebration";
import { ConfettiLayer } from "./Confetti";
import { Deck } from "./Deck";
import { Finale } from "./Finale";
import { PageView } from "./PageView";

export { cannons } from "./Confetti";

export const FUN_ROUTES = new Set(["deck", "finale", "page"]);

export function FunRoute({ t, locale, route }: { t: Theme; locale: string; route: Route }) {
  if (route.name === "deck") return <Deck t={t} locale={locale} />;
  if (route.name === "finale") return <Finale t={t} locale={locale} />;
  if (route.name === "page") return <PageView t={t} locale={locale} page={route.page} />;
  return null;
}

export function FunOverlays({ t, locale, go }: { t: Theme; locale: string; go: (r: Route) => void }) {
  return (
    <>
      <CardToasts t={t} locale={locale} go={go} />
      <Celebration t={t} locale={locale} go={go} />
      <ConfettiLayer />
    </>
  );
}

/** cardCollector.ts only touches `document.visibilityState`; a window that is open is visible. */
export function useFunCollector() {
  (globalThis as { document?: unknown }).document ??= { visibilityState: "visible" };
  useCardCollector();
}
