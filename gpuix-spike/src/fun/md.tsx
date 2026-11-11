// Inline rich text (bold/links wrapping mid-sentence) is only possible through native <markdown>.
import { useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FONT, MONO, type Theme } from "../theme";

export const esc = (s: string) => s.replace(/([\\`*_\[\]<>~|#])/g, "\\$1");

export function Md({ t, src, size = 14, lineHeight, color }: { t: Theme; src: string; size?: number; lineHeight?: number; color?: string }) {
  const theme = useMemo(() => ({
    appearance: t.dark ? ("dark" as const) : ("light" as const), bg: "rgba(0,0,0,0)",
    text: color ?? t.mutedForeground, textMuted: t.mutedForeground, accent: t.primary, linkColor: t.primary, codeText: t.foreground,
    codeWash: t.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", fontSans: FONT, fontMono: MONO,
    metrics: { mdTextSize: size, mdLineHeight: lineHeight ?? Math.round(size * 1.5), mdBlockGap: 0, mdInlineCodeRadius: 4, mdInlineCodeScale: 0.875 },
  }), [t, color, size, lineHeight]);
  // @ts-expect-error <markdown> is a host element
  return <markdown source={src} theme={theme} onLinkClick={(e: { value: string }) => void openUrl(e.value)} style={{ width: "100%", fontFamily: FONT }} />;
}
