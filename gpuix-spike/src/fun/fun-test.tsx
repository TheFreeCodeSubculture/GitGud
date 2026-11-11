// Harness for this slice. GG_FUN=win|winstreak|winmodule|toast|toast-many  GG_ROUTE=deck|finale|about|dictionary|resources
// GG_SEQ="ms,..." → <GG_OUT>-<ms>.png, ms after the trigger. GG_CLICK_AT="ms:x,y" clicks. Seeds progress in GG_APPDATA.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const APPDATA = process.env.GG_APPDATA ?? join(import.meta.dir, "..", "..", ".fun-appdata");
process.env.APPDATA = APPDATA; process.env.XDG_DATA_HOME = APPDATA;
mkdirSync(join(APPDATA, "com.jyotirmoydas.gitgud"), { recursive: true });
writeFileSync(join(APPDATA, "com.jyotirmoydas.gitgud", "user-data.json"), JSON.stringify({
  completed: { meet_the_terminal: true }, saved_dir: null, invited_friend: null, days: [],
  cards: { whoami: "2026-11-01", pwd: "2026-11-01", ls: "2026-11-02", cd: "2026-11-03" },
}));
import "../tauri-shim";
import { useState } from "react";
import { useWindowSize } from "@gpuix/react";
import { launch, renderer } from "../boot";
import { Challenge } from "../ChallengeView";
import { Shell, type Route } from "../Shell";
import { DARK, LIGHT } from "../theme";
import { registerIcon } from "../ui";
import { celebrate, announceCards } from "../../../src/lib/moments";
import { hydrate, today } from "../../../src/lib/progress";
import { FunOverlays, FunRoute } from "./index";
import { __iconData as house } from "lucide-react/dist/esm/icons/house.mjs";
import { __iconData as search } from "lucide-react/dist/esm/icons/search.mjs";
import { __iconData as layers } from "lucide-react/dist/esm/icons/layers.mjs";
import { __iconData as bookMarked } from "lucide-react/dist/esm/icons/book-bookmark.mjs";
import { __iconData as libraryBig } from "lucide-react/dist/esm/icons/library-big.mjs";
import { __iconData as info } from "lucide-react/dist/esm/icons/info.mjs";
import { __iconData as globe } from "lucide-react/dist/esm/icons/globe.mjs";
import { __iconData as moon } from "lucide-react/dist/esm/icons/moon.mjs";
for (const [n, d] of Object.entries({ house, search, layers, "book-marked": bookMarked, "library-big": libraryBig, info, globe, moon })) registerIcon(n, d);

const R = process.env.GG_ROUTE;
const initial: Route = R === "deck" ? { name: "deck" } : R === "finale" ? { name: "finale" } : R && ["about", "dictionary", "resources"].includes(R) ? { name: "page", page: R as "about" } : { name: "challenge", id: "meet_the_terminal" };

function App() {
  const [route, go] = useState<Route>(initial);
  const [dark, setDark] = useState(process.env.GG_DARK === "1");
  const t = dark ? DARK : LIGHT;
  useWindowSize();
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {process.env.GG_NOSHELL ? <div style={{ width: "100%", height: "100%", backgroundColor: t.background }} /> : (
      <Shell t={t} locale="en-US" route={route} go={go} dark={dark} onDark={setDark}>
        {route.name === "challenge" ? <Challenge t={t} locale="en-US" id={route.id} go={go} /> : <FunRoute t={t} locale="en-US" route={route} />}
      </Shell>)}
      <FunOverlays t={t} locale="en-US" go={go} />
    </div>
  );
}
void hydrate();
if (process.env.GG_DEBUG) { const o = renderer.tick.bind(renderer); (renderer as any).tick = () => { const a = performance.now(); const r = o(); const d = performance.now() - a; if (d > 30) console.log(`tick ${Math.round(a)} took ${Math.round(d)}`); return r; }; }
launch(<App />);

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return today(d); };
setTimeout(() => {
  const k = process.env.GG_FUN ?? ""; const T0 = performance.now();
  
  if (k.startsWith("win")) celebrate({
    challengeId: "meet_the_terminal", title: "Meet the terminal", mascotId: "pixelArt", course: { before: 0, after: 1, total: 27 }, seconds: 94, hintsUsed: 1,
    newCards: k === "winmodule" ? [] : ["whoami", "pwd", "ls"], moduleDone: k === "winmodule" ? "The terminal" : undefined,
    streak: k === "winstreak" ? { before: 2, after: 3, days: [day(0), day(1), day(2)] } : undefined, next: { kind: "challenge", id: "command_performance" },
  });
  if (k === "toast") announceCards(["whoami"]);
  if (k === "toast-many") announceCards(["whoami", "pwd", "ls"]);
  if (k === "toast-backlog") announceCards(["whoami", "pwd", "ls", "cd"], true);
  for (const ms of (process.env.GG_SEQ ?? "").split(",").filter(Boolean).map(Number)) setTimeout(() => { const a = performance.now(); renderer.captureScreenshot(`${process.env.GG_OUT}-${ms}.png`); if (process.env.GG_DEBUG) console.log(`shot ${ms} at ${Math.round(a - T0)} took ${Math.round(performance.now() - a)}`); }, ms);
  for (const c of (process.env.GG_CLICK_AT ?? "").split(";").filter(Boolean)) { const [ms, xy] = c.split(":"); const [x, y] = xy.split(",").map(Number); setTimeout(() => renderer.simulateClick(x, y), Number(ms)); }
  setTimeout(() => process.exit(0), Number(process.env.GG_RUN ?? 3500));
}, Number(process.env.GG_START ?? 1500));
