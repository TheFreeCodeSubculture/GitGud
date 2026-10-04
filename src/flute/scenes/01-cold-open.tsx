import { Home } from "~/views/Home";
import { DemoShell, type Cue } from "../DemoShell";

// Day, nothing done yet: the first thing a new learner sees.
const cue = (): Cue => ({ dark: false, done: 0 });

export default function ColdOpen() {
  return (
    <DemoShell route={{ name: "home" }} cue={cue} open>
      {(locale) => <Home locale={locale} />}
    </DemoShell>
  );
}
