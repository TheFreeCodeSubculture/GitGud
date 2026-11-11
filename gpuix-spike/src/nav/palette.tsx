// Port of src/components/CommandPalette.tsx. Dialog gives the layer, focus and
// Escape; search.ts ranks, unchanged. Opening a result is router + reveal.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogBackdrop, DialogPopup, DialogPortal, useWindowSize } from "@gpuix/react";
import type { PublicInstance as Instance } from "@gpuix/react";
import { search, type SearchHit } from "../../../src/lib/search";
import { strings } from "../../../src/strings";
import { Icon, withAlpha } from "../ui";
import { FONT, type Theme } from "../theme";

export function CommandPalette({ t, locale, open, onOpenChange, onPick }: {
  t: Theme; locale: string; open: boolean; onOpenChange: (o: boolean) => void; onPick: (hit: SearchHit, query: string) => void;
}) {
  const s = strings(locale);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rows = useRef<(Instance | null)[]>([]);
  const input = useRef<Instance>(null);
  const win = useWindowSize();
  const hits = useMemo(() => (open ? search(locale, query) : []), [open, locale, query]);
  const q = query.trim();

  useEffect(() => setActive(0), [query]);
  useEffect(() => { rows.current[active]?.scrollIntoView?.(); }, [active]);

  const onKey = (e: { key?: string; preventDefault(): void }) => {
    if (e.key === "down") { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "up") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
  };
  const empty = (text: string) => <div style={{ paddingTop: 24, paddingBottom: 24, paddingLeft: 10, paddingRight: 10, textAlign: "center", fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>{text}</div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal style={{ fontFamily: FONT }}>
        <DialogBackdrop style={{ backgroundColor: withAlpha(t.background, 0.8) }} />
        <DialogPopup initialFocus={input} style={{
          // fixed top-[12vh] left-1/2 w-[min(38rem,100vw-2rem)] -translate-x-1/2
          position: "absolute", top: Math.round(win.height * 0.12), left: (win.width - Math.min(608, win.width - 32)) / 2, width: Math.min(608, win.width - 32), overflow: "hidden", borderRadius: 12, borderWidth: 1, borderColor: t.glassBorder, backgroundColor: withAlpha(t.glass, 1.18),
          boxShadow: { offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -16, color: "rgba(0,0,0,0.35)" },
        }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, borderBottomWidth: 1, borderColor: t.border }}>
            <Icon name="search" size={16} color={t.mutedForeground} />
            <input ref={input} autoFocus value={query} placeholder={s.searchPlaceholder}
              theme={{ text: t.foreground, textMuted: t.mutedForeground, caret: t.foreground, bg: "rgba(0,0,0,0)", appearance: t.dark ? "dark" : "light", fontSans: FONT }}
              onChange={(e) => setQuery(e.value ?? "")} onKeyDown={onKey} onSubmit={() => hits[active] && onPick(hits[active], query)}
              style={{ flexGrow: 1, height: 48, fontSize: 14, lineHeight: 20, color: t.foreground, fontFamily: FONT }} />
            {query && <div style={{ flexShrink: 0, fontSize: 12, color: t.mutedForeground }}>{String(hits.length)}</div>}
          </div>

          <div style={{ maxHeight: Math.round(win.height * 0.52), overflowY: "scroll", scrollbarWidth: 0, padding: 6 }}>
            {q.length < 2 && empty(s.searchNeedTwo)}
            {q.length >= 2 && hits.length === 0 && empty(s.searchNothingMatches.replace("{query}", q))}
            {hits.map((hit, i) => (
              <div key={`${hit.challengeId}-${hit.headingId}-${i}`} ref={(el) => { rows.current[i] = el; }}
                onMouseMove={() => setActive(i)} onClick={() => onPick(hit, query)}
                style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 6, cursor: "pointer", backgroundColor: active === i ? t.accent : undefined }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <div style={{ flexShrink: 1, minWidth: 0, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontSize: 14, lineHeight: 20, fontWeight: 500, color: t.foreground }}>{hit.heading || hit.challengeTitle}</div>
                  <div style={{ flexGrow: 1 }} />
                  <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, lineHeight: 16, color: t.mutedForeground }}>{`${hit.challengeIndex + 1}. ${hit.challengeTitle}`}</div>
                </div>
                {/* <mark>: a native highlight over explicit ranges, bg primary/20 as in the original. */}
                <div highlight={{ ranges: hit.ranges.map((r) => [r.at, r.at + r.length] as [number, number]), color: withAlpha(t.primary, 0.2) }}
                  style={{ marginTop: 3.5, fontSize: 12, lineHeight: 19.5, color: t.mutedForeground, lineClamp: 2 }}>{hit.snippet}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderTopWidth: 1, borderColor: t.border, fontSize: 11, lineHeight: 16, color: t.mutedForeground }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="corner-down-left" size={12} color={t.mutedForeground} /><div style={{ whiteSpace: "nowrap" }}>{s.searchOpen}</div></div>
            <div style={{ whiteSpace: "nowrap" }}>{`↑↓ ${s.searchNavigate}`}</div>
            <div style={{ whiteSpace: "nowrap" }}>{`esc ${s.searchClose}`}</div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
