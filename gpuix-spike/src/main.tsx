// GPUIX spike entry: Home → Mario jump → pixel wipe → challenge one.
import "./tauri-shim";
import "./nav/storage"; // before anything that reads localStorage
import { useEffect, useMemo, useState } from "react";
import { useWindowSize } from "@gpuix/react";
import { FALLBACK_LOCALE, resolveLocale } from "../../src/lib/content";
import { setHeaderTitle } from "../../src/lib/headerTitle";
import { hydrate } from "../../src/lib/progress";
import { Banners } from "./nav/banner";
import { useWindowKeyDown } from "./nav/keys";
import { WindowControls } from "./WindowControls";
import { registerIcon } from "./ui";
import { CHALLENGES } from "../../src/challenges";
import { launch, renderer } from "./boot";
import { Challenge } from "./ChallengeView";
import { PaneContext, type Pane } from "./glass";
import { Home, HomeScene } from "./Home";
import { Shell, type Route } from "./Shell";
import { ConfirmDialogHost } from "./dialog";
import { FunOverlays, FunRoute, useFunCollector } from "./fun"; // celebration, card toasts, deck, finale, pages
import { DARK, LIGHT } from "./theme";

import { __iconData as house } from "lucide-react/dist/esm/icons/house.mjs";
import { __iconData as search } from "lucide-react/dist/esm/icons/search.mjs";
import { __iconData as layers } from "lucide-react/dist/esm/icons/layers.mjs";
import { __iconData as bookMarked } from "lucide-react/dist/esm/icons/book-bookmark.mjs";
import { __iconData as libraryBig } from "lucide-react/dist/esm/icons/library-big.mjs";
import { __iconData as info } from "lucide-react/dist/esm/icons/info.mjs";
import { __iconData as globe } from "lucide-react/dist/esm/icons/globe.mjs";
import { __iconData as sun } from "lucide-react/dist/esm/icons/sun.mjs";
import { __iconData as moon } from "lucide-react/dist/esm/icons/moon.mjs";
import { __iconData as triangleAlert } from "lucide-react/dist/esm/icons/triangle-alert.mjs";
import { __iconData as check } from "lucide-react/dist/esm/icons/check.mjs";
import { __iconData as cornerDownLeft } from "lucide-react/dist/esm/icons/corner-down-left.mjs";
for (const [n, d] of Object.entries({ house, search, layers, "book-marked": bookMarked, "library-big": libraryBig, info, globe, sun, moon, check, "triangle-alert": triangleAlert, "corner-down-left": cornerDownLeft })) registerIcon(n, d);

const LOCALE_KEY = "git-gud:locale", THEME_KEY = "git-gud:theme"; // the original's keys (App.tsx)
const SIDEBAR_W = 256;

/** Port of lib/pixelTransition.ts: 40px squares fade in outward from the
 *  click, the route swaps under them, then they clear in the same order. */
function PixelWipe({ origin, w, h, onCovered, onDone }: { origin: { x: number; y: number }; w: number; h: number; onCovered: () => void; onDone: () => void }) {
  const CELL = 40, SPREAD = 380, FRAME = 160;
  const cells = useMemo(() => {
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    const max = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y));
    const out: { x: number; y: number; d: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const d = Math.hypot((c + 0.5) * CELL - origin.x, (r + 0.5) * CELL - origin.y) / max;
      out.push({ x: c * CELL, y: r * CELL, d: Math.round(d * SPREAD + Math.random() * 60) });
    }
    return out;
  }, []);
  const longest = Math.max(...cells.map((c) => c.d));
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    const a = setTimeout(() => { onCovered(); setTimeout(() => setPhase("out"), 32); }, longest + FRAME);
    const b = setTimeout(onDone, (longest + FRAME) * 2 + 64);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h }}>
      {cells.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: CELL, height: CELL, backgroundColor: "rgb(98,181,232)" }}
          motion={{ initial: { opacity: phase === "in" ? 0 : 1 }, animate: { opacity: phase === "in" ? 1 : 0 }, transition: { duration: FRAME / 1000, delay: c.d / 1000, ease: "linear" } }} />
      ))}
    </div>
  );
}

/** GG_ROUTE: a challenge id, or home | deck | finale | dictionary | resources | about. */
function initialRoute(): Route {
  const r = process.env.GG_ROUTE;
  if (!r || r === "home") return { name: "home" };
  if (r === "deck" || r === "finale") return { name: r };
  if (r === "about" || r === "dictionary" || r === "resources") return { name: "page", page: r };
  return { name: "challenge", id: r };
}

function App() {
  // Persisted exactly as App.tsx does (git-gud:locale / git-gud:theme); GG_* override for tests.
  const [locale, setLocale] = useState(() => process.env.GG_LOCALE ?? localStorage.getItem(LOCALE_KEY) ?? resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale ?? FALLBACK_LOCALE));
  const [dark, setDark] = useState(() => process.env.GG_DARK ? process.env.GG_DARK === "1" : localStorage.getItem(THEME_KEY) === "dark");
  const [route, setRoute] = useState<Route>(initialRoute);
  const [palette, setPalette] = useState(process.env.GG_PALETTE === "1");
  const [wipe, setWipe] = useState<{ x: number; y: number } | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const size = useWindowSize();
  const t = dark ? DARK : LIGHT;
  const pane: Pane = { x: SIDEBAR_W, y: 0, w: size.width - SIDEBAR_W, h: size.height, scrollY };

  useEffect(() => setScrollY(0), [route]);
  useEffect(() => localStorage.setItem(THEME_KEY, dark ? "dark" : "light"), [dark]);
  useEffect(() => localStorage.setItem(LOCALE_KEY, locale), [locale]);
  // Progress lives in a file: load it so a returning learner never sees a zeroed sidebar.
  useEffect(() => void hydrate(), []);
  useFunCollector(); // collects command cards from the shell history (cardCollector.ts)
  // The only shortcut the original binds: Ctrl/Cmd+K toggles the palette.
  useWindowKeyDown((e) => {
    if ((e.modifiers?.ctrl || e.modifiers?.cmd) && e.key === "k") { e.preventDefault(); setPalette((v) => !v); }
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <PaneContext.Provider value={pane}>
        <Shell t={t} locale={locale} onLocale={setLocale} route={route} go={setRoute} dark={dark} onDark={setDark} onScroll={setScrollY}
          palette={palette} onPalette={setPalette} controls={<WindowControls t={t} />} banners={<Banners t={t} locale={locale} />}
          scene={route.name === "home" ? <HomeScene t={t} paneW={pane.w} /> : undefined}>
          {/* Deck / finale / page routes mount here. */}
          {route.name === "home"
            ? <Home t={t} locale={locale} onStart={setWipe} go={setRoute} />
            : route.name === "challenge" ? <Challenge key={route.id} t={t} locale={locale} id={route.id} go={setRoute} />
            : <FunRoute t={t} locale={locale} route={route} />}
        </Shell>
      </PaneContext.Provider>
      {wipe && <PixelWipe origin={wipe} w={size.width} h={size.height}
        onCovered={() => setRoute({ name: "challenge", id: CHALLENGES[0].id })} onDone={() => setWipe(null)} />}
      <FunOverlays t={t} locale={locale} go={setRoute} />
      <ConfirmDialogHost t={t} />
    </div>
  );
}

/** GG_ACTS="key:ctrl-k wait:400 key:b click:300,200 wheel:600,400,-300 move:x,y": scripted input for screenshots (starts at 1.5 s). */
async function acts() {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await wait(1500);
  for (const a of (process.env.GG_ACTS ?? "").split(/\s+/).filter(Boolean)) {
    const [k, v = ""] = [a.slice(0, a.indexOf(":")), a.slice(a.indexOf(":") + 1)], n = v.split(",").map(Number);
    if (k === "wait") await wait(+v);
    else if (k === "key") renderer.simulateKeystrokes(v);
    else if (k === "click") renderer.simulateClick(n[0], n[1]);
    else if (k === "move") renderer.simulateMouseMove(n[0], n[1]);
    else if (k === "title") setHeaderTitle({ eyebrow: "Git & GitHub · 6 of 16", title: "Get Git", mascotId: "adventurer" });
    else if (k === "wheel") renderer.simulateScrollWheel(n[0], n[1], 0, n[2]);
    await wait(k === "wait" ? 0 : 250);
  }
}

launch(<App />);
void acts();
