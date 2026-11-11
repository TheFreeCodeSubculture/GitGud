import { ChallengeView } from "~/views/ChallengeView";
import { DemoShell, type Cue } from "../DemoShell";

const cue = (): Cue => ({ dark: false, done: 2 });

export default function IsoLesson() {
  return (
    <DemoShell route={{ name: "challenge", id: "meet_the_terminal" }} cue={cue}>
      {(locale) => <ChallengeView id="meet_the_terminal" locale={locale} />}
    </DemoShell>
  );
}
