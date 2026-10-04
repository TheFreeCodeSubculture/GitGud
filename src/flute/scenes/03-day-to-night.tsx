import { Home } from "~/views/Home";
import { DemoShell, type Cue } from "../DemoShell";

/** When the theme flips. Gitty casts her spell on the change. */
const NIGHT_MS = 2600;
const cue = (t: number): Cue => ({ dark: t >= NIGHT_MS, done: 0 });

export default function DayToNight() {
  return (
    <DemoShell route={{ name: "home" }} cue={cue} open>
      {(locale) => <Home locale={locale} />}
    </DemoShell>
  );
}
