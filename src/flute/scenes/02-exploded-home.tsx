import { Home } from "~/views/Home";
import { DemoShell, type Cue } from "../DemoShell";

const cue = (): Cue => ({ dark: false, done: 0 });

export default function ExplodedHome() {
  return (
    <DemoShell route={{ name: "home" }} cue={cue} open>
      {(locale) => <Home locale={locale} />}
    </DemoShell>
  );
}
