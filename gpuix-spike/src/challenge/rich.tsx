// Inline runs (colour, weight, code, links) that wrap like a sentence. GPUIX has no
// inline flow outside <markdown>, and <markdown> can't draw a bordered code chip,
// a coloured run or a hoverable link, so each unbreakable word is its own flex
// item and the row wraps. Words are glued across run boundaries ("(`x`)" stays one
// item) and the gap is the font's real space advance, so lines break where the
// browser's do.
import type { StyleDesc } from "@gpuix/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FONT, MONO, type Theme } from "../theme";
import { Favicon, useLinkHover } from "./LinkPreview";

export interface Run {
  text: string; color?: string; weight?: number; italic?: boolean; size?: number; /** letter-spacing, px */ spacing?: number;
  /** An inline code chip: background, and optionally a border colour and text colour. */
  code?: { bg: string; border?: string; color?: string };
  /** An external link. */
  href?: string;
  /** A <br>: ends the line. */
  br?: boolean;
}

/** "a `b` c" -> runs, with `code` runs on `wash`. */
export function ticks(text: string, wash: string, base: Partial<Run> = {}): Run[] {
  return text.split(/`([^`]+)`/).map((p, i): Run => (i % 2 ? { ...base, text: p, code: { bg: wash } } : { ...base, text: p }));
}

type Seg = { r: Run; text: string };
/** Split runs into unbreakable atoms: whitespace in plain text breaks, code chips and run edges do not. */
function atoms(runs: Run[]): Seg[][] {
  const out: Seg[][] = [];
  let cur: Seg[] = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (const r of runs) {
    if (r.br) { flush(); out.push([{ r, text: "" }]); continue; }
    if (r.code) { cur.push({ r, text: r.text }); continue; }
    r.text.split(/(\s+)/).forEach((part, i) => {
      if (i % 2) flush();
      else if (part) cur.push({ r, text: part });
    });
  }
  flush();
  return out;
}

function Word({ s, size, lh, color, first }: { s: Seg; size: number; lh: number; color: string; first: boolean }) {
  const { r, text } = s;
  const link = useLinkHover(r.href ?? "");
  if (r.br) return <div style={{ width: "100%", height: 0 }} />;
  if (r.code) {
    return <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: MONO, fontSize: size * 0.8125, lineHeight: size * 0.8125 * 1.5, marginTop: (lh - size * 0.8125 * 1.5) / 2, paddingLeft: size * 0.35, paddingRight: size * 0.35, borderRadius: 6,
      backgroundColor: r.code.bg, borderWidth: r.code.border ? 1 : 0, borderColor: r.code.border, color: r.code.color ?? r.color ?? color, fontWeight: r.weight }}>{text}</div>;
  }
  const style: StyleDesc = { flexShrink: 0, whiteSpace: "nowrap", fontSize: r.size ?? size, lineHeight: lh, color: r.color ?? color, fontWeight: r.weight, ...(r.spacing ? { letterSpacing: r.spacing } : {}), ...(r.italic ? { fontStyle: "italic" } : {}) } as StyleDesc;
  if (!r.href) return <div style={style}>{text}</div>;
  const open = () => void openUrl(r.href!);
  return (
    <div ref={link.ref as never} onClick={open} onMouseEnter={link.onMouseEnter} onMouseLeave={link.onMouseLeave} onMouseDown={link.onMouseDown}
      style={{ display: "flex", flexDirection: "row", cursor: "pointer", flexShrink: 0 }}>
      {first && /^https?:/i.test(r.href) && <Favicon href={r.href} color={r.color ?? color} />}
      <div style={{ ...style, textDecoration: "underline" }}>{text}</div>
    </div>
  );
}

/** Runs laid out as wrapping text. `color` is the default; a run's own colour wins. */
export function Runs({ runs, color, size = 14, lineHeight = 20, style }: { runs: Run[]; color: string; size?: number; /** letter-spacing, px */ spacing?: number; lineHeight?: number; style?: StyleDesc }) {
  // The favicon sits before a link's first atom only.
  let prevHref: string | undefined;
  return (
    <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", columnGap: size * 0.205, alignItems: "flex-start", ...style }}>
      {atoms(runs).map((a, i) => {
        const startsLink = !!a[0].r.href && a[0].r.href !== prevHref;
        prevHref = a[0].r.href;
        return <div key={i} style={{ display: "flex", flexDirection: "row", flexShrink: 0 }}>
          {a.map((s, j) => <Word key={j} s={s} size={size} lh={lineHeight} color={color} first={j === 0 && startsLink} />)}
        </div>;
      })}
    </div>
  );
}

/** Tokens content.css / theme.ts lack, resolved from tokens.json (light/dark). */
export const extra = (t: Theme) => ({
  warning: "rgba(254,154,0,1)", warningForeground: t.dark ? "rgba(255,185,0,1)" : "rgba(187,77,0,1)", warningSurface: "rgba(255,153,0,0.078)",
  error: t.dark ? "rgba(251,65,74,1)" : "rgba(251,44,54,1)", errorForeground: t.dark ? "rgba(255,100,103,1)" : "rgba(193,0,7,1)",
  errorSurface: t.dark ? "rgba(255,64,77,0.078)" : "rgba(255,38,51,0.078)",
  info: "rgba(43,127,255,1)", infoForeground: t.dark ? "rgba(80,162,255,1)" : "rgba(20,71,230,1)",
  successSurface: "rgba(0,191,128,0.078)",
  blockBg: t.dark ? "rgba(255,255,255,0.033)" : "rgba(250,250,250,1)", // --secondary
});
export const alpha = (rgba: string, a: number) => rgba.replace(/,[\d.]+\)$/, `,${a})`).replace(/^rgb\(/, "rgba(");
export { FONT };
