import { Home } from "~/views/Home";
import { DemoShell, type Cue } from "../DemoShell";

/** Challenges complete one after another between these times. */
const FIRST_MS = 900;
const LAST_MS = 5400;
const cue = (t: number): Cue => ({
  dark: true,
  done: Math.max(0, Math.min(16, Math.floor(((t - FIRST_MS) / (LAST_MS - FIRST_MS)) * 16) + 1)),
});

export default function ProgressHyperlapse() {
  return (
    <DemoShell route={{ name: "home" }} cue={cue} open>
      {(locale) => <Home locale={locale} />}
    </DemoShell>
  );
}
