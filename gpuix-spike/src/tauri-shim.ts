// Every `@tauri-apps/*` call ends in `window.__TAURI_INTERNALS__.invoke(cmd, args)`.
// Answering those commands here lets the app's own `src/lib` (git, shell probes,
// progress, verifiers, opener, dialog) run unchanged in the GPUIX build, with no
// fork of any of it. Import this first: the Tauri modules read it at call time.
//
// The `run_git` / `list_dir` / `shell_history` / progress commands go to the same
// Rust the Tauri build uses (native-core, a napi addon) when it is present.
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { renderer } from "./boot";

const IDENTIFIER = "com.jyotirmoydas.gitgud"; // src-tauri/tauri.conf.json
const VERSION = "0.3.0";

/** Tauri's `app_data_dir()`, so both builds read and write the same progress file. */
export function appDataDir() {
  const base = process.platform === "win32"
    ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
    : process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, IDENTIFIER);
}

type Core = { runGit(args: string[], cwd?: string): Promise<unknown>; listDir(path: string): Promise<unknown>; shellHistory(home: string): Promise<unknown> };
export let core: Core | null = null;
export let coreError: unknown = null;
try {
  const triple = { win32: "win32-x64-msvc", linux: "linux-x64-gnu" }[process.platform as string];
  core = require(process.env.GG_CORE_NODE ?? join(import.meta.dir, "..", "native-core", `gg-core.${triple}.node`)) as Core;
} catch (e) { coreError = e; /* fall through to the JS stand-ins below */ }

/** A Rust `Err(String)` surfaces as an Error; Tauri's invoke rejects with the bare string. */
async function native<T>(f: () => Promise<T>): Promise<T> {
  try { return await f(); } catch (e) { throw e instanceof Error ? e.message : e; }
}

/** JS stand-ins, used only when native-core is missing. Same env as `git.rs`. */
function runGit({ args, cwd }: { args: string[]; cwd?: string }) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, LANG: "C", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }, windowsHide: true });
  if (r.error) throw (r.error as NodeJS.ErrnoException).code === "ENOENT"
    ? "Git was not found on your PATH. Complete challenge 1 to install it." : `Could not run Git: ${r.error.message}`;
  return { stdout: r.stdout, stderr: r.stderr, code: r.status };
}

const listeners = new Map<string, Set<number>>();
const callbacks = new Map<number, (payload: unknown) => void>();
let nextId = 1;

/** Fire a Tauri event (`listen()` subscribers), e.g. `tauri://resize`. */
export function emit(event: string, payload: unknown = null) {
  for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
}

const commands: Record<string, (a: any) => unknown> = {
  run_git: (a) => core ? native(() => core!.runGit(a.args, a.cwd)) : runGit(a),
  git_version: async () => {
    const out = await commands.run_git({ args: ["--version"] }) as { stdout: string; code: number | null };
    const v = out.code === 0 ? out.stdout.trim() : "";
    return v.startsWith("git version") ? v : null;
  },
  list_dir: (a) => native(() => core!.listDir(a.path)),
  home_dir: () => homedir(),
  shell_history: () => core ? native(() => core!.shellHistory(homedir())) : [],
  read_progress: () => {
    const path = join(appDataDir(), "user-data.json");
    let raw: string;
    try { raw = readFileSync(path, "utf8"); } catch { return null; }
    const text = raw.replace(/^﻿/, "").trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) {
      const aside = path.replace(/\.json$/, ".corrupt.json");
      try { renameSync(path, aside); } catch {}
      throw `Saved progress could not be read (${e}). The old file has been kept as ${aside}.`;
    }
  },
  write_progress: ({ progress }) => {
    mkdirSync(appDataDir(), { recursive: true });
    const path = join(appDataDir(), "user-data.json");
    writeFileSync(path + ".tmp", JSON.stringify(progress, null, 2));
    renameSync(path + ".tmp", path);
  },
  install_kind: () => "unsupported",

  "plugin:app|version": () => VERSION,
  "plugin:opener|open_url": ({ url }) => {
    const [cmd, ...pre] = process.platform === "win32" ? ["cmd", "/c", "start", ""] : process.platform === "darwin" ? ["open"] : ["xdg-open"];
    spawnSync(cmd, [...pre, url], { stdio: "ignore", windowsHide: true });
  },
  "plugin:dialog|open": async ({ options }) => {
    const paths = await renderer.promptForPaths({ directories: !!options?.directory, files: !options?.directory, multiple: !!options?.multiple, prompt: options?.title });
    return paths ? (options?.multiple ? paths : paths[0]) : null;
  },
  "plugin:window|minimize": () => renderer.minimizeWindow(),
  "plugin:window|toggle_maximize": () => renderer.zoomWindow(),
  "plugin:window|close": () => process.exit(0),
  "plugin:window|is_maximized": () => false, // ponytail: GPUIX has no query yet; the fork adds one
  "plugin:window|start_dragging": () => (renderer as any).startWindowMove?.(),
  "plugin:event|listen": ({ event, handler }) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return handler;
  },
  "plugin:event|unlisten": ({ event, eventId }) => { listeners.get(event)?.delete(eventId); },
};

const g = globalThis as any;
g.window ??= g;
g.__TAURI_INTERNALS__ = {
  metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
  transformCallback(cb: (p: unknown) => void, once = false) {
    const id = nextId++;
    callbacks.set(id, once ? (p) => { callbacks.delete(id); cb(p); } : cb);
    return id;
  },
  unregisterCallback: (id: number) => callbacks.delete(id),
  async invoke(cmd: string, args: unknown = {}) {
    const fn = commands[cmd];
    if (!fn) throw `GPUIX build: no handler for ${cmd}`;
    return fn(args); // a thrown string rejects, as a Rust `Err(String)` does
  },
  convertFileSrc: (p: string) => p,
};
g.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event: string, id: number) => listeners.get(event)?.delete(id) };

// The webview's storage. The progress file is the source of truth (progress.ts),
// so an in-memory stand-in loses nothing.
if (!g.localStorage) {
  const m = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, String(v)), removeItem: (k: string) => m.delete(k), clear: () => m.clear() };
}
g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
