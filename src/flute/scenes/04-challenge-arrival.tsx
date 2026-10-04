import { ChallengeView } from "~/views/ChallengeView";
import { DemoShell, type Cue } from "../DemoShell";

// Straight after "Start challenge one": nothing done yet, still night.
const cue = (): Cue => ({ dark: true, done: 0 });

export default function ChallengeArrival() {
  return (
    <DemoShell route={{ name: "challenge", id: "meet_the_terminal" }} cue={cue}>
      {(locale) => <ChallengeView id="meet_the_terminal" locale={locale} />}
    </DemoShell>
  );
}
