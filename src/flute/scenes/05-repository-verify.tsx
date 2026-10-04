import { useLayoutEffect, useRef, useState } from "react";
import { useSceneTime } from "@webprodigies/flute";

import { ChallengeView } from "~/views/ChallengeView";
import { DemoShell, ease, type Cue } from "../DemoShell";

/** When the Verify button is pressed. */
const CLICK_MS = 5600;

/** The lesson scrolls down to the verify box between these times. */
const SCROLL = { from: 3600, to: 5000, px: 1222 };

/** A real folder with `git init` run in it; the check runs real Git against it. */
const REPO = String.raw`D:\temp_prs\hello-world`;

// Six challenges behind the learner, Repository next. After the click the
// verifier owns completion, so the cue stops enforcing it.
const cue = (t: number): Cue => ({
  dark: true,
  scroll: ease(0, SCROLL.px, t, SCROLL.from, SCROLL.to),
  ...(t < CLICK_MS && { done: 6, savedDir: REPO }),
});

/** Presses the real Verify button at CLICK_MS; rewinding puts the page back. */
function VerifyCue({ onRewind }: { onRewind: () => void }) {
  const t = useSceneTime();
  const pressed = useRef(false);

  useLayoutEffect(() => {
    if (t >= CLICK_MS && !pressed.current) {
      pressed.current = true;
      // The Verify button is the last one in the verify box until it passes.
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-flute-id="content"] section.alert-glass button');
      buttons[buttons.length - 1]?.click();
    } else if (t < CLICK_MS && pressed.current) {
      pressed.current = false;
      onRewind();
    }
  });
  return null;
}

export default function RepositoryVerify() {
  const [take, setTake] = useState(0);
  return (
    <>
      <VerifyCue onRewind={() => setTake((n) => n + 1)} />
      <DemoShell route={{ name: "challenge", id: "repository" }} cue={cue}>
        {(locale) => <ChallengeView key={take} id="repository" locale={locale} />}
      </DemoShell>
    </>
  );
}
