// Harness: confetti on the app background. GG_SEQ="ms,ms,..." → <GG_SHOT>-<ms>.png after firing at 500ms.
import "../tauri-shim";
import { launch, renderer } from "../boot";
import { ConfettiLayer, cannons, confettiStats } from "./Confetti";
import { LIGHT } from "../theme";

launch(
  <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: LIGHT.background }}>
    <ConfettiLayer />
  </div>,
);
const scale = Number(process.env.GG_BIG ?? 1);
setTimeout(() => {
  renderer.setDebugFrameOverlay("minimal");
  renderer.resetDebugFrameOverlayStats();
  const t0 = performance.now();
  cannons(scale);
  for (const ms of (process.env.GG_SEQ ?? "").split(",").filter(Boolean).map(Number)) {
    setTimeout(() => renderer.captureScreenshot(`${process.env.GG_OUT}-${ms}.png`), ms);
  }
  setTimeout(() => {
    const s = renderer.getDebugFrameOverlayStats();
    const secs = (performance.now() - t0) / 1000;
    console.log(`[confetti] frames/s=${(s.frames / secs).toFixed(1)} p90=${s.p90Ms?.toFixed(1)}ms p99=${s.p99Ms?.toFixed(1)}ms max=${s.maxMs?.toFixed(1)}ms | js tick avg=${(confettiStats.ms / confettiStats.frames).toFixed(2)}ms over ${confettiStats.frames}`);
    process.exit(0);
  }, Number(process.env.GG_RUN ?? 4000));
}, 500);
