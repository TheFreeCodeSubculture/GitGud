import { useLayoutEffect, useRef, useState } from "react";
import { useSceneTime } from "@webprodigies/flute";

import { ChallengeView } from "~/views/ChallengeView";
import { DemoShell, type Cue } from "../DemoShell";

/** When the Verify button is pressed: just after the layers plate together. */
const CLICK_MS = 2600;

/** A real folder with `git init` run in it; the check runs real Git against it. */
const REPO = String.raw`D:\temp_prs\hello-world`;

const cue = (t: number): Cue => ({
  dark: false,
  scroll: 1222,
  ...(t < CLICK_MS && { done: 6, savedDir: REPO }),
});

/** Presses the real Verify button at CLICK_MS; rewinding puts the page back. */
function VerifyCue({ onRewind }: { onRewind: () => void }) {
  const t = useSceneTime();
  const pressed = useRef(false);

  useLayoutEffect(() => {
    if (t >= CLICK_MS && !pressed.current) {
      pressed.current = true;
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-flute-id="content"] section.alert-glass button');
      buttons[buttons.length - 1]?.click();
    } else if (t < CLICK_MS && pressed.current) {
      pressed.current = false;
      onRewind();
    }
  });
  return null;
}

export default function IsoVerify() {
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
