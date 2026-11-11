// Smoke check: the app's own src/lib runs through the shim. `bun run src/shim-check.ts`
import { core, coreError } from "./tauri-shim";
import { runGit, gitVersion } from "../../src/lib/git";
import { hydrate, currentProgress } from "../../src/lib/progress";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
if (!core) throw new Error("native core failed to load (JS fallback would mask it): " + coreError);
const v = await gitVersion();
if (!v?.startsWith("git version")) throw new Error("gitVersion: " + v);
const s = await runGit(["status"], "..");
if (s.code !== 0 || !s.stdout.includes("On branch")) throw new Error("status: " + JSON.stringify(s));
const dir = await invoke<{ name: string; is_dir: boolean }[]>("list_dir", { path: "." });
if (!dir.length || typeof dir[0].is_dir !== "boolean" || !dir.some((e) => e.name === "src" && e.is_dir)) throw new Error("list_dir: " + JSON.stringify(dir));
const hist = await invoke<unknown[]>("shell_history");
if (!Array.isArray(hist)) throw new Error("shell_history: " + JSON.stringify(hist));
let msg: unknown;
try { await invoke("list_dir", { path: "./nope" }); } catch (e) { msg = e; }
if (typeof msg !== "string" || !msg.includes("does not exist")) throw new Error("error not a plain string: " + String(msg));
console.log("ok", v, (await hydrate(), Object.keys(currentProgress().completed).length), typeof openUrl, `dir=${dir.length} history=${hist.length}`);
process.exit(0);
