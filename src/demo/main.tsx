import React from "react";
import ReactDOM from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

import App from "~/App";
import { COMPANION } from "~/challenges";
import { dismissWin } from "~/lib/moments";
import "~/index.css";
import "~/content.css";

/**
 * The real app on a pretend computer, for the website's course section.
 *
 * Every Tauri command is answered from the plain state below instead of a
 * Rust backend, so the UI on the site is the shipping UI, pixel for pixel. The
 * page that embeds this (site/course.js) drives it through `window.demo`: it
 * lays out a scene with `reset`, then "runs" commands, which land in the shell
 * history, the folder tree and the repository exactly where the app's real
 * checks look for them.
 */

const HOME = "/Users/ada";
const HISTORY = `${HOME}/.zsh_history`;

interface Commit {
  hash: string;
  parents: string[];
  subject: string;
}

interface Repo {
  path: string;
  branch: string;
  heads: Record<string, string>; // local branch → commit
  remoteHeads: Record<string, string>; // "origin/main" → commit
  remotes: Record<string, string>; // name → url
  commits: Commit[]; // newest first
  tracked: string[];
  dirty: string; // `git status --porcelain`
}

interface State {
  history: string[];
  paths: Set<string>; // every file and folder that exists; folders end in "/"
  repo: Repo | null;
  config: Record<string, string>;
  pulls: { number: number; merged_at: string | null; html_url: string }[];
}

const state: State = { history: [], paths: new Set(), repo: null, config: {}, pulls: [] };

/* ---------------- files ---------------- */

const norm = (p: string) => p.replace(/\/+$/, "");

function addPath(path: string, dir: boolean) {
  const parts = norm(path).split("/");
  for (let i = 2; i < parts.length; i++) state.paths.add(`${parts.slice(0, i).join("/")}/`);
  state.paths.add(dir ? `${norm(path)}/` : norm(path));
}

function listDir(path: string) {
  const base = `${norm(path)}/`;
  if (!state.paths.has(base)) throw new Error(`No such directory: ${path}`);
  const seen = new Map<string, boolean>();
  for (const p of state.paths) {
    if (!p.startsWith(base) || p === base) continue;
    const rest = p.slice(base.length);
    const name = rest.split("/")[0];
    seen.set(name, (seen.get(name) ?? false) || rest.includes("/"));
  }
  return [...seen].map(([name, is_dir]) => ({ name, is_dir }));
}

/* ---------------- git ---------------- */

const ok = (stdout = "") => ({ stdout, stderr: "", code: 0 });
const no = (stderr = "") => ({ stdout: "", stderr, code: 1 });
let hashSeed = 0x4f2a9c1;
const nextHash = () => ((hashSeed = (hashSeed * 1103515245 + 12345) >>> 0).toString(16).padStart(8, "0") + "c0ffee1d").repeat(3).slice(0, 40);

function decorations(repo: Repo, hash: string): string {
  const refs: string[] = [];
  for (const [b, h] of Object.entries(repo.heads)) {
    if (h !== hash) continue;
    refs.push(b === repo.branch ? `HEAD -> ${b}` : b);
  }
  for (const [r, h] of Object.entries(repo.remoteHeads)) if (h === hash) refs.push(r);
  return refs.join(", ");
}

function git(args: string[], cwd?: string) {
  const [cmd, ...rest] = args;
  if (cmd === "--version") return ok("git version 2.47.1\n");
  if (cmd === "config") return state.config[rest[0]] ? ok(`${state.config[rest[0]]}\n`) : no();

  const repo = state.repo && cwd && norm(cwd) === norm(state.repo.path) ? state.repo : null;
  if (!repo) return { stdout: "", stderr: "fatal: not a git repository", code: 128 };
  const head = repo.heads[repo.branch];

  switch (cmd) {
    case "rev-parse":
      if (rest[0] === "--is-inside-work-tree") return ok("true\n");
      if (rest[0] === "--verify") {
        const ref = rest[rest.length - 1];
        const h = repo.heads[ref] ?? repo.remoteHeads[ref];
        return h ? ok(`${h}\n`) : no();
      }
      return ok();
    case "branch":
      if (rest[0] === "--show-current") return ok(`${repo.branch}\n`);
      if (rest[0] === "--list") return ok(repo.heads[rest[1]] ? `  ${rest[1]}\n` : "");
      return ok(Object.keys(repo.heads).join("\n"));
    case "remote":
      if (rest[0] === "get-url") return repo.remotes[rest[1]] ? ok(`${repo.remotes[rest[1]]}\n`) : no(`error: No such remote '${rest[1]}'`);
      if (rest[0] === "-v")
        return ok(Object.entries(repo.remotes).map(([n, u]) => `${n}\t${u} (fetch)\n${n}\t${u} (push)`).join("\n"));
      return ok(Object.keys(repo.remotes).join("\n"));
    case "rev-list": {
      if (rest.includes("--remotes")) return ok(Object.values(repo.remoteHeads).join("\n"));
      const range = rest[rest.length - 1];
      if (range.includes("..")) return ok("0\n");
      return ok(`${head ? (rest.includes("--max-count=1") ? 1 : repo.commits.length) : 0}\n`);
    }
    case "ls-files": {
      const dir = rest[rest.length - 1];
      return ok(repo.tracked.filter((f) => f.startsWith(`${dir}/`)).join("\n"));
    }
    case "status":
      return ok(repo.dirty);
    case "for-each-ref":
      return ok(
        [
          ...Object.entries(repo.heads).map(([b, h]) => `refs/heads/${b}\t${h}`),
          ...Object.entries(repo.remoteHeads).map(([r, h]) => `refs/remotes/${r}\t${h}`),
        ].join("\n"),
      );
    case "log":
      return ok(repo.commits.map((c) => [c.hash, c.parents.join(" "), decorations(repo, c.hash), c.subject].join("\x1f")).join("\n"));
    default:
      return ok(); // fetch, pull and the rest succeed quietly
  }
}

/* ---------------- GitHub and the quilt ---------------- */

const PALETTES = [
  ["#f3ead7", "#c97ba5", "#4a7a63"],
  ["#f6efe2", "#e07a5f", "#3d405b"],
  ["#eef3f8", "#5b8fd6", "#f2b84b"],
  ["#f4eef8", "#8e6cc8", "#4fb3a3"],
  ["#fbf1e6", "#d9534f", "#2f6f8f"],
  ["#eef6ee", "#5aa469", "#e8a33d"],
];

/** A quilt patch in the spirit of the bot's DiceBear "Patchwork" (CC0) art. */
function patchSvg(seed: number): string {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const [bg, a, b] = PALETTES[Math.floor(r() * PALETTES.length)];
  const block = (x: number, y: number) => {
    const rot = Math.floor(r() * 4) * 90;
    const [f, g] = r() < 0.5 ? [a, b] : [b, a];
    const shapes = [
      `<path d="M0 50h50L25 0Z" fill="${f}"/>`,
      `<path d="M0 0h50v50H0Zm12.5 12.5v25h25v-25Z" fill="${f}" fill-rule="evenodd"/><path d="M25 12.5 37.5 25 25 37.5 12.5 25Z" fill="${g}"/>`,
      `<path d="M0 0h50L0 50Z" fill="${f}"/>`,
      `<circle cx="25" cy="25" r="14" fill="${f}"/>`,
      `<path d="M0 0h50v16.6H0Zm0 33.3h50V50H0Z" fill="${f}"/>`,
    ];
    return `<g transform="translate(${x} ${y}) rotate(${rot} 25 25)">${shapes[Math.floor(r() * shapes.length)]}</g>`;
  };
  const body = block(0, 0) + block(50, 0) + block(0, 50) + block(50, 50);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${body}</svg>`)}`;
}

const CLASSMATES = ["mira", "tomasz", "kenji", "lucia", "ofelia", "sam", "priya", "jun", "noor", "felix", "ines", "kwame", "yuki", "dara", "beto", "anya", "omar", "lena", "theo", "ravi", "sol", "hana", "ezra"];
const FAKE_PATCH = "demo-patch:";
const patchFor = new Map<string, string>();

/** The app joins pages URL + patch path; point the classmates' paths at inline art instead. */
new MutationObserver(() => {
  for (const img of document.querySelectorAll<HTMLImageElement>(`img[src*="${FAKE_PATCH}"]`)) {
    const key = img.getAttribute("src")!.split(FAKE_PATCH)[1];
    img.src = patchFor.get(key) ?? "";
  }
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

  if (url.includes("/pulls?")) return json(state.pulls);
  if (url.includes("api.github.com/users/"))
    return json({ login: decodeURIComponent(url.split("/users/")[1]), name: null, avatar_url: "" });
  if (url.endsWith("/collaborators.json")) return json({ collaborators: [] });
  if (url.endsWith("/contributors.json")) {
    const real = await realFetch(url, init).then((r) => r.json()).catch(() => ({ contributors: [] }));
    const fake = [...CLASSMATES, state.config["user.username"]].filter(Boolean).map((username, i) => {
      patchFor.set(username, patchSvg(i * 7 + 3));
      return { username, at: null, patch: `${FAKE_PATCH}${username}` };
    });
    const contributors = [...(real.contributors ?? []), ...fake];
    return json({ total: contributors.length, contributors });
  }
  return realFetch(input, init);
};

/* The app focuses buttons (the celebration's Continue). Inside an iframe, a
 * plain focus() also scrolls the page around it; the visitor is reading that
 * page, so the demo's focus never scrolls anything. */
const focusEl = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (options?: FocusOptions) {
  focusEl.call(this, { ...options, preventScroll: true });
};

/* Same for scrollIntoView (a search hit jumps to its heading): scroll the
 * app's own pane, never the page the visitor is reading. */
Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
  const opts: ScrollIntoViewOptions = typeof arg === "object" ? arg : { block: arg === false ? "end" : "start" };
  for (let box = this.parentElement; box; box = box.parentElement) {
    const style = getComputedStyle(box);
    if (!/(auto|scroll)/.test(style.overflowY) || box.scrollHeight <= box.clientHeight) continue;
    const r = this.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const margin = Number.parseFloat(getComputedStyle(this).scrollMarginTop) || 0;
    let top = box.scrollTop + r.top - b.top - margin;
    if (opts.block === "center") top -= (b.height - r.height) / 2;
    else if (opts.block === "end") top -= b.height - r.height;
    else if (opts.block === "nearest" && r.top >= b.top && r.bottom <= b.bottom) return;
    box.scrollTo({ top, behavior: opts.behavior ?? "auto" });
    return;
  }
};

/* The app's chimes (cards, celebrations, a right guess) are Web Audio notes
 * sent to `audio.destination`. Here every context sends them through one
 * master gain instead, so the website can turn the demo down: it does while
 * the visitor flings the page past several scenes at once. */
let volume = 1;
const masters = new Set<GainNode>();
const BaseAudioContext = window.AudioContext;
class DemoAudioContext extends BaseAudioContext {
  readonly #master: GainNode;
  constructor(options?: AudioContextOptions) {
    super(options);
    this.#master = super.createGain();
    this.#master.gain.value = volume;
    this.#master.connect(super.destination);
    masters.add(this.#master);
  }
  // A gain node stands in for the destination; the app only ever connects to it.
  override get destination(): AudioDestinationNode {
    return this.#master as unknown as AudioDestinationNode;
  }
}
window.AudioContext = DemoAudioContext;
function setVolume(v: number) {
  volume = v;
  for (const m of masters) m.gain.setTargetAtTime(v, m.context.currentTime, 0.05);
}

/* While a visitor drives on the website, only what the current tasks need
 * answers the pointer; the rest of the app stays visible but still. */
const allowStyle = document.createElement("style");
document.head.append(allowStyle);
function allow(selectors: string | null) {
  allowStyle.textContent = selectors
    ? `:where(body *) { pointer-events: none !important; }
       main, ${selectors} { pointer-events: auto !important; }`
    : "";
}

/* ---------------- the IPC every command goes through ---------------- */

mockWindows("main");
mockIPC(
  (cmd, payload) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    switch (cmd) {
      case "read_progress":
        return progress;
      case "write_progress":
        progress = args.progress as typeof progress;
        return null;
      case "shell_history":
        return state.history.length ? [{ shell: "zsh", path: HISTORY, commands: [...state.history] }] : [];
      case "home_dir":
        return HOME;
      case "list_dir":
        return listDir(String(args.path));
      case "git_version":
        return "2.47.1";
      case "run_git":
        return git(args.args as string[], args.cwd as string | undefined);
      case "plugin:app|version":
        return "0.3.0";
      case "plugin:dialog|open":
        return state.repo?.path ?? HOME;
      default:
        return null; // updater, opener, process: nothing to do on a web page
    }
  },
  { shouldMockEvents: true },
);

/* ---------------- what the website drives ---------------- */

let progress: {
  completed: Record<string, boolean>;
  saved_dir: string | null;
  invited_friend: string | null;
  days: string[];
  cards: Record<string, string>;
} | null = null;

export interface Scene {
  route: string; // "#/challenge/make_it_so"
  locale?: string;
  completed?: string[];
  dir?: string | null;
  cards?: string[];
  history?: string[];
  paths?: string[]; // folders end in "/"
  repo?: Partial<Repo> & { path: string; commits?: string[] };
  username?: string;
}

const root = document.getElementById("root")!;
let reactRoot: ReactDOM.Root | null = null;

const demo = {
  /** Lay out a scene and start the app fresh on it. */
  reset(scene: Scene) {
    const day = new Date().toISOString().slice(0, 10);
    state.history = [...(scene.history ?? [])];
    state.paths = new Set();
    for (const d of ["Desktop", "Documents", "Downloads", "Music", "Pictures"]) addPath(`${HOME}/${d}`, true);
    for (const p of scene.paths ?? []) addPath(p, p.endsWith("/"));
    state.config = scene.username
      ? { "user.name": "Ada Lovelace", "user.email": "ada@example.com", "user.username": scene.username }
      : {};
    state.pulls = [];
    state.repo = null;
    if (scene.repo) {
      const { commits = [], ...rest } = scene.repo;
      const repo: Repo = { branch: "main", heads: {}, remoteHeads: {}, remotes: {}, commits: [], tracked: [], dirty: "", ...rest };
      state.repo = repo;
      for (const subject of [...commits].reverse()) demo.commit(subject);
      if (rest.remoteHeads === undefined)
        for (const name of Object.keys(repo.remotes)) repo.remoteHeads[`${name}/${repo.branch}`] = repo.heads[repo.branch];
      addPath(repo.path, true);
    }
    progress = {
      completed: Object.fromEntries((scene.completed ?? []).map((id) => [id, true])),
      saved_dir: scene.dir ?? null,
      invited_friend: null,
      days: scene.completed?.length ? [day] : [],
      cards: Object.fromEntries((scene.cards ?? []).map((id) => [id, day])),
    };
    localStorage.setItem("git-gud:locale", scene.locale ?? "en-US");
    localStorage.setItem("git-gud:theme", "dark");
    dismissWin();
    window.location.hash = scene.route;
    reactRoot?.unmount();
    root.replaceChildren();
    reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  },

  /** A command reached the shell: it is now in the history file. */
  ran(command: string) {
    state.history.push(command);
  },
  mkdir: (path: string) => addPath(path, true),
  touch: (path: string) => addPath(path, false),
  /** Limit the app's clickable parts to these selectors (null: everything). */
  allow,
  /** 0 to 1: how loud the app's chimes are. */
  volume: setVolume,
  /** For the visitor's shell on the website: what `ls` and `cd` see. */
  exists: (path: string) => state.paths.has(`${norm(path)}/`),
  ls(path: string): string[] | null {
    try {
      return listDir(path).map((e) => e.name).sort();
    } catch {
      return null;
    }
  },

  commit(subject: string, files: string[] = []) {
    const repo = state.repo!;
    const parent = repo.heads[repo.branch];
    const hash = nextHash();
    repo.commits.unshift({ hash, parents: parent ? [parent] : [], subject });
    repo.heads[repo.branch] = hash;
    repo.tracked = [...new Set([...repo.tracked, ...files])];
    repo.dirty = "";
  },
  stage(porcelain: string) {
    state.repo!.dirty = porcelain;
  },
  checkout(branch: string, create = false) {
    const repo = state.repo!;
    if (create) repo.heads[branch] = repo.heads[repo.branch];
    repo.branch = branch;
  },
  merge(branch: string) {
    const repo = state.repo!;
    const hash = nextHash();
    repo.commits.unshift({ hash, parents: [repo.heads[repo.branch], repo.heads[branch]], subject: `Merge branch '${branch}'` });
    repo.heads[repo.branch] = hash;
  },
  deleteBranch(branch: string) {
    delete state.repo!.heads[branch];
  },
  push(remote: string, branch: string) {
    const repo = state.repo!;
    repo.remoteHeads[`${remote}/${branch}`] = repo.heads[branch];
  },
  /** Upstream merged the pull request; `git pull upstream` brings the file down. */
  pullUpstream(file: string) {
    demo.commit(`Merge pull request #42 from ${state.config["user.username"]}/add-${state.config["user.username"]}`, [file]);
  },
  pullRequest(merged: boolean) {
    state.pulls = [{ number: 42, merged_at: merged ? new Date().toISOString() : null, html_url: `https://github.com/${COMPANION.owner}/${COMPANION.repo}/pull/42` }];
  },
};

declare global {
  interface Window {
    demo: typeof demo;
  }
}
window.demo = demo;
window.parent.postMessage({ type: "gitgud-demo-ready" }, "*");
