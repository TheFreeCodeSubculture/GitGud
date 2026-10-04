import { Home } from "~/views/Home";
import { DemoShell, type Cue } from "../DemoShell";

// Everything done, night sky: the app at rest.
const cue = (): Cue => ({ dark: true, done: 16 });

export default function Finale() {
  return (
    <DemoShell route={{ name: "home" }} cue={cue} open>
      {(locale) => <Home locale={locale} />}
    </DemoShell>
  );
}
