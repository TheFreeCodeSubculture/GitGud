import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useMemo, useState, type ReactNode } from "react";
import { tokenize } from "../../src/lib/shellHighlight";
import { LinkPreviewHost } from "./challenge/LinkPreview";
import { HeadingAnchor } from "./nav/outline";
import { Runs, alpha, extra, type Run } from "./challenge/rich";
import { parse, textOf, type El, type Node } from "./lessonParse";
import { FONT, MONO, type Theme } from "./theme";

import { PUBLIC } from "./boot";
const BASE = 15, LH = Math.round(BASE * 1.65); // 24.75: GPUI lays whole-pixel lines out the same as the browser

function copy(text: string) {
  const cmd = process.platform === "win32" ? ["clip"] : Bun.which("wl-copy") ? ["wl-copy"] : ["xclip", "-selection", "clipboard"];
  try { const p = Bun.spawn(cmd, { stdin: "pipe" }); p.stdin.write(text); p.stdin.end(); return true; }
  catch (e) { console.log("copy failed:", text, e); return false; }
}

// ---- inline runs: HTML inline nodes -> Runs (see challenge/rich.tsx) ----
function runsOf(n: Node, t: Theme, base: Partial<Run> = {}): Run[] {
  if (typeof n === "string") return [{ ...base, text: n.replace(/\s+/g, " ") }];
  const kids = (b: Partial<Run>) => n.children.flatMap((c) => runsOf(c, t, b));
  switch (n.tag) {
    case "strong": case "b": return kids({ ...base, weight: 600, color: t.foreground }); // .prose strong
    case "em": case "i": return kids({ ...base, italic: true });
    case "code": return [{ ...base, text: textOf(n).replace(/\s+/g, " ").trim(), code: { bg: t.muted, border: t.border } }];
    case "a": return n.attrs.href ? kids({ ...base, href: n.attrs.href, color: t.primary }) : kids(base);
    case "br": return [{ text: "", br: true }];
    default: return kids(base);
  }
}

function Inline({ nodes, t, size = BASE, bold, color, spacing }: { nodes: Node[]; t: Theme; size?: number; bold?: boolean; color: string; spacing?: number }) {
  const runs = useMemo(() => nodes.flatMap((n) => runsOf(n, t, { ...(bold ? { weight: 600 } : {}), ...(spacing ? { spacing } : {}) })), [nodes, t, bold, spacing]);
  // Edges of the paragraph: leading/trailing spaces are not content.
  if (!runs.some((r) => r.text.trim() || r.br)) return null;
  return <Runs runs={runs} color={color} size={size} lineHeight={Math.round(size * 1.65)} style={{ width: "100%" }} />;
}

// ---- blocks ----
type Ctx = { t: Theme; color: string; size?: number };
type Block = { el: ReactNode; mt: number; mb: number };
export type { Block };
const BLOCK = new Set(["p", "div", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "img", "pre", "hr"]);
const cls = (e: El) => (e.attrs.class ?? "").split(/\s+/);
const isCodeBlock = (n: Node): n is El => typeof n !== "string" && n.tag === "code" && (cls(n).includes("shell") || cls(n).includes("comment"));
const isBlock = (n: Node): n is El => typeof n !== "string" && (BLOCK.has(n.tag) || isCodeBlock(n) || cls(n).includes("inline-tip"));

/** Stack blocks with CSS-like collapsed margins (max of adjacent), none at the outer edges. */
export function Flow({ blocks }: { blocks: Block[] }) {
  return <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
    {blocks.map((b, i) => <div key={i} style={{ width: "100%", marginTop: i ? Math.max(blocks[i - 1].mb, b.mt) : 0 }}>{b.el}</div>)}
  </div>;
}

/** `m`: margin of the anonymous run boxes, 10 inside a <p> (`.prose p`), none directly in a div or li. */
function blocksOf(nodes: Node[], c: Ctx, m = 0): Block[] {
  const out: Block[] = [];
  let run: Node[] = [];
  const flush = () => {
    if (run.map(textOf).join("").trim()) out.push({ el: <Inline nodes={run} t={c.t} size={c.size} color={c.color} />, mt: m, mb: m });
    run = [];
  };
  for (const n of nodes) {
    if (!isBlock(n)) { run.push(n); continue; }
    flush();
    out.push(...blockOf(n, c));
  }
  flush();
  return out;
}

function blockOf(e: El, c: Ctx): Block[] {
  const { t } = c, x = extra(t), kids = e.children;
  const classes = cls(e);
  switch (e.tag) {
    case "p": return blocksOf(kids, c, 10);
    case "h1": case "h2": case "h3": case "h4": {
      const [size, mt, mb] = { h1: [24, 0, 12], h2: [18, 0, 8], h3: [16, 0, 8], h4: [14, 16, 6] }[e.tag]!;
      const el = <Inline nodes={kids} t={t} size={size} bold spacing={e.tag === "h1" ? -0.36 : 0} color={c.color} />;
      // h2/h3 are the outline's entries.
      return [{ el: e.tag === "h2" || e.tag === "h3" ? <HeadingAnchor level={e.tag === "h2" ? 2 : 3} text={textOf(e).replace(/\s+/g, " ").trim()}>{el}</HeadingAnchor> : el, mt, mb }];
    }
    case "ul": case "ol": {
      const plain = classes.includes("no-list-style");
      const items = kids.filter((k): k is El => typeof k !== "string" && k.tag === "li");
      // `.prose li {margin: 5px 0}`: item margins collapse with their children's, like the browser's.
      const lis = items.map((li) => blocksOf(li.children, c));
      const first = lis[0]?.[0]?.mt ?? 0, last = lis.at(-1)?.at(-1)?.mb ?? 0;
      const el = <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {lis.map((bl, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "row", marginTop: i ? Math.max(5, lis[i - 1].at(-1)?.mb ?? 0, bl[0]?.mt ?? 0) : 0 }}>
            {!plain && <div style={{ width: 20, flexShrink: 0, textAlign: "right", paddingRight: 6, color: c.color, fontSize: c.size ?? BASE, lineHeight: Math.round((c.size ?? BASE) * 1.65) }}>
              {e.tag === "ol" ? `${i + 1}.` : "•"}
            </div>}
            <div style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}><Flow blocks={bl} /></div>
          </div>))}
      </div>;
      return [{ el, mt: Math.max(10, 5, first), mb: Math.max(10, 5, last) }];
    }
    case "li": return blocksOf(kids, c);
    case "blockquote":
      return [{ el: <div style={{ borderLeftWidth: 3, borderColor: t.border, paddingLeft: 14, width: "100%" }}>
        <Flow blocks={blocksOf(kids, { ...c, color: t.mutedForeground })} /></div>, mt: 12, mb: 12 }];
    case "img": return [{ el: <Img e={e} t={t} />, mt: 12, mb: 12 }];
    case "pre": return [{ el: <CodeBlock text={textOf(e)} shell={false} t={t} />, mt: 12, mb: 12 }];
    case "code": return [{ el: <CodeBlock text={textOf(e).trim()} shell={classes.includes("shell")} t={t} />, mt: 12, mb: 12 }];
    case "hr": return [{ el: <div style={{ height: 1, backgroundColor: t.border }} />, mt: 16, mb: 16 }];
  }
  // div / span with lesson classes
  const has = (k: string) => classes.includes(k);
  const inner = (color = c.color, size = c.size) => <Flow blocks={blocksOf(kids, { ...c, color, size })} />;
  const box = (bg: string, border: string, mt: number, goal = false): Block => ({
    el: <div style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, padding: 14, paddingLeft: 16, paddingRight: 16, width: "100%" }}>{inner(c.color, goal ? 16 : c.size)}</div>, mt, mb: mt,
  });
  if (has("chal-goal")) return [box(alpha(t.primary, 0.05), alpha(t.primary, 0.22), 16, true)]; // 1rem text
  if (has("chal-tip")) return [box(x.warningSurface, alpha(x.warning, 0.28), 20)];
  if (has("chal-no-pass")) return [box(x.errorSurface, alpha(x.error, 0.28), 20)];
  if (has("chal-step")) return [{ el: inner(), mt: 24, mb: 24 }];
  if (has("chal-background") || has("light-blue")) return [{ el: inner(t.mutedForeground), mt: 20, mb: 20 }];
  if (has("inline-tip"))
    return [{ el: <div style={{ borderLeftWidth: 2, borderColor: alpha(x.warning, 0.5), paddingLeft: 14, width: "100%" }}>{inner(t.mutedForeground)}</div>, mt: 8, mb: 8 }];
  return blocksOf(kids, c);
}

// ---- images: PNG header gives the aspect ratio (GPUIX needs a definite size) ----
function pngSize(path: string): [number, number] | null {
  try { const b = readFileSync(path); if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch {}
  return null;
}
function Img({ e, t }: { e: El; t: Theme }) {
  const src = e.attrs.src ?? "";
  const path = /^https?:|^data:/.test(src) ? src : join(PUBLIC, src);
  const dim = pngSize(path);
  const w = Number(e.attrs.width) || dim?.[0] || 600;
  return <img src={path} alt={e.attrs.alt} objectFit="contain" style={{
    width: w, maxWidth: "100%", aspectRatio: dim ? dim[0] / dim[1] : undefined, // ponytail: non-PNG gets no ratio
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: t.border, borderRadius: 8,
  }} />;
}

// ---- code blocks (shell: tokens from the real src/lib/shellHighlight.ts; copy button) ----
const ICON = (d: string, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const COPY = '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';

function CodeBlock({ text, shell, t }: { text: string; shell: boolean; t: Theme }) {
  const [done, setDone] = useState(false);
  const color = { command: t.codeCommand, subcommand: t.foreground, flag: t.codeFlag, string: t.codeString, placeholder: t.codePlaceholder, text: t.foreground };
  const mono = { fontFamily: MONO, fontSize: 12.1875, lineHeight: 20 }; // .prose code: 0.8125em
  const words = tokenize(text).filter((k) => k.text.trim());
  return <div style={{ borderWidth: t.dark ? 0 : 1, borderColor: t.border, borderRadius: 8, backgroundColor: extra(t).blockBg, overflow: "hidden", width: "100%" }}>
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingRight: 6, paddingTop: 4, height: 32 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 0.22, color: t.mutedForeground }}>{shell ? "terminal" : "output"}</div>
      {shell && <div onClick={() => { if (copy(text)) { setDone(true); setTimeout(() => setDone(false), 1600); } }}
        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, cursor: "pointer", hover: { backgroundColor: t.accent } }}>
        <svg source={ICON(done ? CHECK : COPY, "black")} style={{ width: 14, height: 14, color: done ? t.successForeground : t.mutedForeground }} />
      </div>}
    </div>
    <div style={{ padding: 12, paddingTop: 4, paddingBottom: 10, ...mono, color: shell ? t.foreground : t.mutedForeground }}>
      {shell
        ? <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", columnGap: 7.3125 }}>
            <div style={{ ...mono, color: t.mutedForeground }}>$</div>
            {words.map((k, i) => <div key={i} style={{ ...mono, color: color[k.kind], fontWeight: k.kind === "command" || k.kind === "subcommand" ? 600 : 400, fontStyle: k.kind === "placeholder" ? "italic" : undefined }}>{k.text}</div>)}
          </div>
        : text.split("\n").map((l, i) => <div key={i} style={{ ...mono, whiteSpace: "nowrap" }}>{l.replace(/ /g, " ") || " "}</div>)}
    </div>
  </div>;
}

/** A lesson's HTML as margin-collapsing blocks, so callers can interleave their own. */
export function lessonBlocks(html: string, theme: Theme): Block[] {
  return blocksOf(parse(html), { t: theme, color: theme.foreground });
}

export function Lesson({ html, theme }: { html: string; theme: Theme }) {
  const blocks = useMemo(() => lessonBlocks(html, theme), [html, theme]);
  return <LinkPreviewHost t={theme}><div style={{ width: "100%", maxWidth: 672, fontFamily: FONT, fontSize: BASE, lineHeight: LH, color: theme.foreground }}>
    <Flow blocks={blocks} />
  </div></LinkPreviewHost>;
}
