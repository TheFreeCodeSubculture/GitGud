// Port of components/CommandCard.tsx: a playing card in pixel dress, framed in its
// module's colour with stepped corners, face down until collected.
// Not ported: `tilt` (the lean toward the pointer and the glare need 3D transforms and
// blend modes). The dithered art panel and the checkered back are painted as pixels.
import { useEffect, useRef, type ReactNode } from "react";
import type { ImgInstance } from "@gpuix/react";
import type { Card } from "../../../src/lib/cards";
import { MONO, type Theme } from "../theme";
import { Icon } from "../ui";
import { lucide } from "./icons";

/** One colour per module, from the same Duolingo palette as the celebration. */
export const MODULE_COLOR: Record<Card["module"], string> = { terminal: "#1cb0f6", files: "#ce82ff", git: "#f05033" };

const rgb = (c: string) => (c.startsWith("#") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g)!.slice(0, 3).map(Number));
/** `color-mix(in srgb, a k, b)`. */
const mix = (a: string, k: number, b: string) => { const [x, y] = [rgb(a), rgb(b)]; return `rgb(${x.map((v, i) => Math.round(v * k + y[i] * (1 - k))).join(",")})`; };

/** The CSS patterns, rasterised once at 2x: dots (art panel) or a 4 px checker (card back), `m` at `k` over `base`. */
function Tex({ w, h, base, m, kind }: { w: number; h: number; base: string; m: string; kind: "dots" | "checker" }) {
  const img = useRef<ImgInstance>(null);
  useEffect(() => {
    const S = 2, W = w * S, H = h * S, px = Buffer.alloc(W * H * 4);
    const b = rgb(base), c = rgb(m);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / S, v = y / S;
      let a: number;
      if (kind === "checker") { const tx = u % 8, ty = v % 8; a = (tx >= 4) !== (ty >= 4) ? 0.16 : 0; }
      else { const d = Math.hypot((u % 6) - 3, (v % 6) - 3); a = 0.3 * (d <= 1 ? 1 : d >= 1.5 ? 0 : 1 - (d - 1) / 0.5); }
      const o = (y * W + x) * 4;
      for (let i = 0; i < 3; i++) px[o + i] = Math.round(b[i] * (1 - a) + c[i] * a);
      px[o + 3] = 255;
    }
    img.current?.setImagePixels(W, H, px);
  }, [w, h, base, m, kind]);
  return <img ref={img as never} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }} />;
}

/** A box with the card's stepped corners: a plus-shaped union of two rects, `s` px steps. */
function Stepped({ s, bg, w, h, children, style }: { s: number; bg: string; w: number; h: number; children?: ReactNode; style?: object }) {
  return (
    <div style={{ position: "relative", width: w, height: h, flexShrink: 0, ...style }}>
      <div style={{ position: "absolute", left: s, right: s, top: 0, bottom: 0, backgroundColor: bg }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: s, bottom: s, backgroundColor: bg }} />
      {children}
    </div>
  );
}

export function CommandCard({ t, card, collected, size = "md", note }: { t: Theme; card: Card; collected: boolean; size?: "sm" | "md"; note?: string; tilt?: boolean }) {
  const sm = size === "sm";
  const W = sm ? 56 : 148, H = Math.round((W * 204) / 148);
  const m = MODULE_COLOR[card.module];
  const iconName = lucide(card.icon, sm ? 2.25 : 1.75);
  const inW = W - 6, inH = H - 6;
  const artH = sm ? inH : 86;
  return (
    <div style={{ width: W, height: H, flexShrink: 0, boxShadow: { offsetX: 0, offsetY: 6, blurRadius: 10, spreadRadius: 0, color: "rgba(0,0,0,0.18)" } }}>
      <Stepped s={4} bg={m} w={W} h={H}>
        <div style={{ position: "absolute", left: 3, top: 3 }}>
          {collected ? (
            <Stepped s={3} bg={t.card} w={inW} h={inH}>
              <div style={{ position: "absolute", left: 0, top: 0, width: inW, height: inH, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", height: artH, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...(sm ? {} : { borderBottomWidth: 2, borderColor: mix(m, 0.4, t.card) }) }}>
                  <Tex w={inW} h={sm ? inH : 84} base={mix(m, 0.14, t.card)} m={m} kind="dots" />
                  <Icon name={iconName} size={sm ? 20 : 40} strokeWidth={sm ? 2.25 : 1.75} color={m} />
                </div>
                {!sm && (
                  <div style={{ padding: 10, paddingTop: 8, paddingBottom: 10, textAlign: "left" }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, lineHeight: 20, color: t.foreground, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.cmd}</div>
                    <div style={{ marginTop: 4, minHeight: 30, fontSize: 11, lineHeight: 15, color: t.mutedForeground }}>{card.does}</div>
                    {note && <div style={{ marginTop: 8, fontSize: 10, lineHeight: 15, color: mix(t.mutedForeground, 0.8, t.card) }}>{note}</div>}
                  </div>
                )}
              </div>
            </Stepped>
          ) : (
            <Stepped s={3} bg={mix(m, 0.22, t.card)} w={inW} h={inH}>
              <div style={{ position: "absolute", left: 0, top: 0, width: inW, height: inH, overflow: "hidden" }}><Tex w={inW} h={inH} base={mix(m, 0.22, t.card)} m={m} kind="checker" /></div>
              <div style={{ position: "absolute", left: 0, top: 0, width: inW, height: inH, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: sm ? 16 : 36, lineHeight: sm ? 24 : 40, fontWeight: 700, color: m }}>?</div>
                {!sm && note && <div style={{ position: "absolute", left: 8, right: 8, bottom: 10, textAlign: "center", fontSize: 10, lineHeight: 13.75, color: t.mutedForeground }}>{note}</div>}
              </div>
            </Stepped>
          )}
        </div>
      </Stepped>
    </div>
  );
}
