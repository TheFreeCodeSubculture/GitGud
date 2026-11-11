// Port of components/LivePanels.tsx and components/RepoGraph.tsx.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { mountFolderFigure, type FolderItem } from "../../../src/lib/folderFigure";
import { runGit } from "../../../src/lib/git";
import { mountRepoFigure, type Ghost } from "../../../src/lib/repoFigure";
import { layout, recentCommits, snapshot, type GraphEdge, type PlacedCommit } from "../../../src/lib/repoState";
import { listDir, shellHistory, type HistoryFile } from "../../../src/lib/shell";
import { mountTerminalFigure } from "../../../src/lib/terminalFigure";
import { strings } from "../../../src/strings";
import { FONT, MONO, type Theme } from "../theme";
import { Glassy, PulseDot, Range } from "./atoms";
import { Figure } from "./Figure";
import { Runs, alpha, extra, ticks } from "./rich";
import { Icon } from "../ui";
import "./icons";

const POLL_MS = 2000; // ponytail: a file watcher would be instant

/** Re-reads `load` every 2 s, publishing only real changes. */
function usePoll<T>(load: () => Promise<T>, deps: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let last = "", alive = true;
    const tick = async () => {
      const next = await load().catch(() => null);
      const key = JSON.stringify(next);
      if (alive && key !== last) { last = key; setValue(next); }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, deps);
  return value;
}

const row = (gap: number, more: object = {}) => ({ display: "flex", flexDirection: "row", alignItems: "center", gap, ...more }) as const;
const small = (t: Theme) => ({ fontSize: 12, lineHeight: 16, color: t.mutedForeground });

function Panel({ t, icon, title, live, aside, children }: { t: Theme; icon: string; title: string; live: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Glassy t={t}>
      <div style={{ ...row(8), fontSize: 14, lineHeight: 20 }}>
        <Icon name={icon} size={16} color={t.mutedForeground} />
        <div style={{ whiteSpace: "nowrap", fontWeight: 500, color: t.foreground }}>{title}</div>
        <div style={{ ...row(4, { flexShrink: 0 }), ...small(t) }}><PulseDot color={t.success} />{live}</div>
        {aside !== undefined && <><div style={{ flexGrow: 1 }} /><div style={{ ...small(t), flexShrink: 1, minWidth: 0, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{aside}</div></>}
      </div>
      {children}
    </Glassy>
  );
}

const side = { flexGrow: 1, flexBasis: 0, minWidth: 0 } as const;
const readout = (t: Theme) => ({ marginTop: 4, display: "flex", flexDirection: "row", borderRadius: 6, backgroundColor: t.muted, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, fontFamily: MONO, fontSize: 14, lineHeight: 20, whiteSpace: "nowrap", overflow: "hidden" }) as const;

const LINES = 24;

/** The learner's terminal: their real recent commands, as Hairline's terminal figure. */
export function TerminalPanel({ t, locale }: { t: Theme; locale: string }) {
  const s = strings(locale);
  const [active, setActive] = useState<number | null>(null);
  const pick = useRef<{ path: string; tails: Record<string, string> }>({ path: "", tails: {} });
  const file = usePoll<HistoryFile | null>(async () => {
    const files = (await shellHistory()).filter((f) => f.commands.length > 0);
    if (!files.length) return null;
    const seen = pick.current;
    const moved = files.find((f) => seen.tails[f.path] !== undefined && seen.tails[f.path] !== f.commands[f.commands.length - 1]);
    seen.tails = Object.fromEntries(files.map((f) => [f.path, f.commands[f.commands.length - 1] ?? ""]));
    const chosen = moved ?? files.find((f) => f.path === seen.path) ?? [...files].sort((a, b) => b.commands.length - a.commands.length)[0];
    seen.path = chosen.path;
    return { ...chosen, commands: chosen.commands.slice(-LINES) };
  }, []);
  if (!file) return null;
  const lines = file.commands;
  const shown = active ?? lines.length - 1;
  return (
    <Panel t={t} icon="square-terminal" title={s.termTitle} live={s.repoLive} aside={file.shell}>
      <div style={{ ...row(16), marginTop: 8 }}>
        <Figure t={t} width={320} deps={[JSON.stringify(lines)]} mount={(st, sv) => mountTerminalFigure(st, sv, lines, setActive)} />
        <div style={side}>
          <div style={small(t)}>{active === null ? s.termLast : s.termLine}</div>
          <div style={readout(t)}><div style={{ color: t.successForeground, marginRight: 8, flexShrink: 0 }}>$</div><div style={{ color: t.foreground, flexGrow: 1, flexBasis: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{lines[shown]}</div></div>
          <div style={{ ...small(t), marginTop: 12, lineHeight: 19.5 }}>{s.termHint}</div>
        </div>
      </div>
    </Panel>
  );
}

const MAX_ITEMS = 16;

/** The learner's folder, as things on a tray: boxes for folders, sheets for files. */
export function FolderPanel({ t, dir, locale }: { t: Theme; dir: string; locale: string }) {
  const s = strings(locale);
  const [active, setActive] = useState<number | null>(null);
  const items = usePoll<FolderItem[]>(async () => {
    const entries = (await listDir(dir)).filter((e) => !e.name.startsWith(".")).slice(0, MAX_ITEMS);
    entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    return Promise.all(entries.map(async (e) => ({
      name: e.name, isDir: e.isDir,
      count: e.isDir ? (await listDir(`${dir}/${e.name}`).catch(() => [])).filter((c) => !c.name.startsWith(".")).length : 0,
    })));
  }, [dir]);
  if (!items) return null;
  const it = active === null ? null : items[active];
  return (
    <Panel t={t} icon="folder-open" title={s.folderTitle} live={s.repoLive} aside={dir.split(/[\\/]/).filter(Boolean).pop()}>
      <div style={{ ...row(16), marginTop: 8 }}>
        <Figure t={t} width={320} deps={[JSON.stringify(items)]} mount={(st, sv) => mountFolderFigure(st, sv, items, setActive)} />
        <div style={side}>
          {items.length === 0 ? <Runs runs={ticks(s.folderEmpty, t.muted)} color={t.mutedForeground} />
            : it ? <>
              <div style={small(t)}>{it.isDir ? s.folderIsDir : s.folderIsFile}</div>
              <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 14, lineHeight: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.foreground }}>{`${it.name}${it.isDir ? "/" : ""}`}</div>
              {it.isDir && <div style={{ ...small(t), marginTop: 4 }}>{s.folderHolds.replace("{n}", String(it.count))}</div>}
            </> : <Runs size={12} lineHeight={19.5} color={t.mutedForeground}
              runs={[{ text: s.folderSummary.replace("{d}", String(items.filter((x) => x.isDir).length)).replace("{f}", String(items.filter((x) => !x.isDir).length)) }]} />}
        </div>
      </div>
    </Panel>
  );
}

// ---- RepoGraph ----
const ROW = 26;
const LIMIT = 12; // enough history to read at a glance

interface View {
  repo: boolean; head: string; commits: number; dirty: number;
  nodes: PlacedCommit[]; edges: GraphEdge[]; lanes: number;
  remote: string[] | null;
}

async function read(dir: string): Promise<View> {
  const [snap, commits] = await Promise.all([snapshot(dir), recentCommits(dir, LIMIT)]);
  let remote: string[] | null = null;
  if (Object.keys(snap.remotes).length > 0) {
    const out = await runGit(["rev-list", "--remotes", "-n", "200"], dir);
    remote = out.code === 0 ? out.stdout.split("\n").filter(Boolean) : [];
  }
  return { repo: snap.repo, head: snap.head, commits: snap.commits, dirty: snap.dirty, remote, ...layout(commits) };
}

const isHead = (c: PlacedCommit) => c.refs.some((r) => r === "HEAD" || r.startsWith("HEAD -> "));

/** What the lesson is about to ask for, as dashed commits on the board. */
function goalFor(challengeId: string, view: View): Ghost[] {
  const head = view.nodes.findIndex(isHead);
  const lane = head >= 0 ? view.nodes[head].lane : 0;
  if (challengeId === "commit_to_it") {
    const need = Math.max(0, 2 - view.commits);
    return Array.from({ length: need }, (_, k) => ({ lane, parent: k === 0 && head >= 0 ? head : "prev" }));
  }
  if (challengeId === "branches_arent_just_for_birds" && head >= 0 && /^(main|master)?$/.test(view.head)) return [{ lane: view.lanes, parent: head }];
  return [];
}

/** The learner's real repository, drawn as a hairline figure and kept live while they work. */
export function RepoGraph({ t, dir, locale, challengeId }: { t: Theme; dir: string; locale: string; challengeId: string }) {
  const s = strings(locale);
  const x = extra(t);
  const view = usePoll<View>(() => read(dir), [dir]);
  if (!view) return null;
  return (
    <Glassy t={t}>
      <div style={{ ...row(8), fontSize: 14, lineHeight: 20 }}>
        <Icon name="git-branch" size={16} color={t.mutedForeground} />
        <div style={{ fontWeight: 500, color: t.foreground, whiteSpace: "nowrap" }}>{s.repoTitle}</div>
        <div style={{ ...row(4), ...small(t) }}><PulseDot color={t.success} />{s.repoLive}</div>
        {view.repo && <><div style={{ flexGrow: 1 }} />
          <div style={{ ...small(t), color: view.dirty ? x.warningForeground : t.mutedForeground }}>{view.dirty ? `${view.dirty} ${s.repoDirty}` : view.nodes.length > 0 ? s.repoClean : ""}</div></>}
      </div>
      <Graph t={t} view={view} ghosts={goalFor(challengeId, view)} locale={locale} />
    </Glassy>
  );
}

function Graph({ t, view, ghosts, locale }: { t: Theme; view: View; ghosts: Ghost[]; locale: string }) {
  const s = strings(locale), x = extra(t);
  const [active, setActive] = useState<number | null>(null);
  const [cut, setCut] = useState(0);
  const head = view.nodes.findIndex(isHead);
  const n = view.nodes.length;
  const safeCut = Math.min(cut, Math.max(0, n - 1));
  const remote = view.remote ? new Set(view.remote) : null;
  const ghostKey = JSON.stringify(ghosts);
  useEffect(() => setCut(0), [n]); // new commits land at "now"
  const lit = active ?? (safeCut > 0 ? safeCut : head);
  const caption = [remote && s.repoBoards, ghosts.length > 0 && s.repoGhosts].filter(Boolean).join(" · ");
  return (
    <div style={{ ...row(16), marginTop: 12 }}>
      <div style={{ width: 304, flexShrink: 0 }}>
        <Figure t={t} width={304} deps={[view, head, ghostKey, safeCut]}
          mount={(st, sv) => mountRepoFigure(st, sv, { repo: view.repo, nodes: view.nodes, edges: view.edges, head, ghosts, remote, cut: safeCut }, setActive)} />
        {caption && <div style={{ ...small(t), fontSize: 11, marginTop: -8, textAlign: "center" }}>{caption}</div>}
        {n >= 2 && (
          <div style={{ ...row(8), marginTop: 8, paddingLeft: 24, paddingRight: 24, fontSize: 11, lineHeight: 16, color: t.mutedForeground }}>
            <Icon name="history" size={14} color={t.mutedForeground} />
            <Range t={t} min={0} max={n - 1} value={n - 1 - safeCut} onChange={(v) => setCut(n - 1 - v)} />
            <div style={{ width: 64, flexShrink: 0, textAlign: "right" }}>{safeCut === 0 ? s.repoNow : s.repoAgo.replace("{n}", String(safeCut))}</div>
          </div>
        )}
      </div>
      {!view.repo || n === 0
        ? <div style={side}><Runs color={t.mutedForeground} runs={[...ticks(view.repo ? s.repoNoCommits : s.repoNotYet, t.muted), ...(view.dirty > 0 ? [{ text: `(${view.dirty} ${s.repoDirty})` }] : [])]} /></div>
        : <div style={{ ...side, fontFamily: MONO, fontSize: 12 }}>
            {view.nodes.map((c, i) => (
              <div key={c.hash} style={{ ...row(6), height: ROW - 4, paddingLeft: 6, paddingRight: 6, whiteSpace: "nowrap", fontSize: 12, lineHeight: 16,
                backgroundColor: i === lit ? t.muted : undefined, color: i === lit ? t.foreground : t.mutedForeground, opacity: i < safeCut ? 0.4 : 1 }}>
                <div style={{ flexShrink: 0 }}>{c.hash.slice(0, 7)}</div>
                {c.refs.map((r) => <RefChip key={r} t={t} decoration={r} />)}
                {remote && !remote.has(c.hash) && <div style={{ flexShrink: 0, borderWidth: 1, borderStyle: "dashed", borderColor: alpha(x.warning, 0.6), paddingLeft: 4, paddingRight: 4, fontFamily: FONT, fontSize: 10, lineHeight: 16, color: x.warningForeground }}>{s.repoUnpushed}</div>}
                <div style={{ fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flexShrink: 1 }}>{c.subject}</div>
              </div>
            ))}
          </div>}
    </div>
  );
}

function RefChip({ t, decoration }: { t: Theme; decoration: string }) {
  const x = extra(t);
  const head = decoration.startsWith("HEAD -> ");
  const name = head ? decoration.slice(8) : decoration.replace(/^tag: /, "");
  const kind = head || decoration === "HEAD" ? "head" : decoration.startsWith("tag: ") ? "tag" : name.includes("/") ? "remote" : "local";
  const look = {
    head: { borderColor: t.primary, backgroundColor: t.primary, color: t.primaryForeground },
    local: { borderColor: alpha(t.primary, 0.6), color: t.primary },
    remote: { borderColor: alpha(t.mutedForeground, 0.6), borderStyle: "dashed" as const, color: t.mutedForeground },
    tag: { borderColor: alpha(x.warning, 0.6), color: x.warningForeground },
  }[kind];
  return <div style={{ flexShrink: 0, borderWidth: 1, paddingLeft: 4, paddingRight: 4, fontSize: 12, lineHeight: 16, ...look }}>{head ? `HEAD → ${name}` : name}</div>;
}
