import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./boot";
import { Lesson } from "./lesson";
import { DARK, LIGHT } from "./theme";

const root = join(import.meta.dir, "..", "..");
const file = process.env.GG_LESSON ?? "t1_meet_the_terminal.html"; // first challenge in challenges.ts
const html = readFileSync(join(root, "src", "content", "en-US", "challenges", file), "utf8");
const theme = process.env.GG_DARK === "1" ? DARK : LIGHT;

launch(
  <div style={{ width: "100%", height: "100%", backgroundColor: theme.background, overflow: "scroll", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div style={{ width: "100%", maxWidth: 720, padding: 24, paddingTop: 32, marginTop: -Number(process.env.GG_Y ?? 0), paddingBottom: 48 }}>
      <Lesson html={html} theme={theme} />
    </div>
  </div>,
);
