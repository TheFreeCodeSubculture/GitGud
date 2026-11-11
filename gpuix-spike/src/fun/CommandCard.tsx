// Port of components/CommandCard.tsx (the card face). Stepped pixel corners are two
// overlapping rects (same trick as Home's Tile); the dotted art panel and the checker
// back are pre-rendered into pixels. No tilt/glare: GPUIX has no 3-D transforms.
import type { Card } from "../../../src/lib/cards";
import { MONO, type Theme } from "../theme";
import { LIcon, alpha, mix, useImagePixels } from "./anim";

/** One colour per module, from the same Duolingo palette as the celebration. */
export const MODULE_COLOR: Record<Card["module"], string> = { terminal: "#1cb0f6", files: "#ce82ff", git: "#f05033" };
const rgba = (hex: string) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},1)`;
export const moduleColor = (m: Card["module"]) => rgba(MODULE_COLOR[m]);

const cache = new Map<string, Buffer>();
/** `kind`: art = dotted panel, back = checker. 2x supersampled; returns [w,h,pixels]. */
function pattern(kind: "art" | "back", w: number, h: number, m: string, card: string): [number, number, Buffer] {
  const K = 2, W = w * K, H = h * K, key = `${kind}${w}x${h}${m}${card}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = Buffer.alloc(W * H * 4);
    const bg = (kind === "art" ? mix(m, card, 0.14) : mix(m, card, 0.22)).match(/[\d.]+/g)!.map(Number);
    const fg = (kind === "art" ? mix(m, mix(m, card, 0.14), 0.3) : mix(m, mix(m, card, 0.22), 0.16)).match(/[\d.]+/g)!.map(Number);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / K, py = (y + 0.5) / K, o = (y * W + x) * 4;
      let k = 0; // 0 → bg, 1 → fg
      if (kind === "back") k = (Math.floor(px / 4) + Math.floor(py / 4)) % 2 === 1 ? 1 : 0;
      else { const d = Math.hypot(((px % 6) + 6) % 6 - 3, ((py % 6) + 6) % 6 - 3); k = Math.min(1, Math.max(0, (1.5 - d) / 0.5)); }
      for (let c = 0; c < 3; c++) buf[o + c] = bg[c] + (fg[c] - bg[c]) * k;
      buf[o + 3] = 255;
    }
    cache.set(key, buf);
  }
  return [W, H, buf];
}
function Pattern({ kind, w, h, m, card, style }: { kind: "art" | "back"; w: number; h: number; m: string; card: string; style: object }) {
  const ref = useImagePixels(() => pattern(kind, Math.round(w), Math.round(h), m, card), [kind, Math.round(w), Math.round(h), m, card]);
  return <img ref={ref as never} style={{ position: "absolute", width: w, height: h, ...style }} />;
}

/** A rect with the 4 corner pixels notched: two overlapping bars. */
function Stepped({ n, color, style, children }: { n: number; color?: string; style?: object; children?: React.ReactNode }) {
  const bar = { position: "absolute", backgroundColor: color } as const;
  return (
    <div style={{ position: "relative", ...style }}>
      {color && <><div style={{ ...bar, left: 0, right: 0, top: n, bottom: n }} /><div style={{ ...bar, top: 0, bottom: 0, left: n, right: n }} /></>}
      {children}
    </div>
  );
}

/** The 3px notches of the face, painted in the frame colour. */
function Corners({ at, color, fw, fh }: { at: string[]; color: string; fw: number; fh: number }) {
  return <>{at.map((c) => <div key={c} style={{ position: "absolute", width: 3, height: 3, backgroundColor: color, top: c[0] === "t" ? 0 : fh - 3, left: c[1] === "l" ? 0 : fw - 3 }} />)}</>;
}

export function CommandCard({ t, card, collected, size = "md", note, w }: { t: Theme; card: Card; collected: boolean; size?: "sm" | "md"; note?: string; w?: number }) {
  const sm = size === "sm", W = w ?? (sm ? 56 : 148), H = (W * 204) / 148, m = moduleColor(card.module);
  const fw = W - 6, fh = H - 6, artH = sm ? fh : 86;
  return (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 4, boxShadow: { offsetX: 0, offsetY: 6, blurRadius: 10, spreadRadius: 0, color: "rgba(0,0,0,0.18)" } }} />
      <Stepped n={4} color={m} style={{ width: W, height: H }}>
        <div style={{ position: "absolute", left: 3, top: 3, width: fw, height: fh }}>
          <Stepped n={3} color={collected ? t.card : undefined} style={{ width: fw, height: fh }}>
            {collected ? (
              <>
                {/* art panel: notched on top, 2px rule under it (md) */}
                <Pattern kind="art" w={fw} h={artH} m={m} card={t.card} style={{ top: 0, left: 0 }} />
                <Corners at={["tl", "tr"]} color={m} fw={fw} fh={fh} />
                {!sm && <div style={{ position: "absolute", top: artH - 2, left: 0, width: fw, height: 2, backgroundColor: mix(m, t.card, 0.4) }} />}
                <div style={{ position: "absolute", top: 0, left: 0, width: fw, height: sm ? artH : artH - (sm ? 0 : 0), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LIcon C={card.icon} size={sm ? 20 : 40} color={m} strokeWidth={sm ? 2.25 : 1.75} />
                </div>
                {!sm && (
                  <div style={{ position: "absolute", top: artH, left: 0, width: fw, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 10 }}>
                    <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 19.5, fontWeight: 700, color: t.foreground, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.cmd}</div>
                    <div style={{ marginTop: 4, minHeight: 30, fontSize: 11, lineHeight: 15.125, color: t.mutedForeground }}>{card.does}</div>
                    {note && <div style={{ marginTop: 8, fontSize: 10, lineHeight: 15, color: alpha(t.mutedForeground, 0.8) }}>{note}</div>}
                  </div>
                )}
              </>
            ) : (
              <>
                <Pattern kind="back" w={fw} h={fh} m={m} card={t.card} style={{ top: 0, left: 0 }} />
                <Corners at={["tl", "tr", "bl", "br"]} color={m} fw={fw} fh={fh} />
                <div style={{ position: "absolute", top: 0, left: 0, width: fw, height: fh, display: "flex", alignItems: "center", justifyContent: "center", fontSize: sm ? 16 : 36, fontWeight: 900, color: m }}>?</div>
                {!sm && note && <div style={{ position: "absolute", left: 8, right: 8, bottom: 10, textAlign: "center", fontSize: 10, lineHeight: 13.75, color: t.mutedForeground }}>{note}</div>}
              </>
            )}
          </Stepped>
        </div>
      </Stepped>
    </div>
  );
}
