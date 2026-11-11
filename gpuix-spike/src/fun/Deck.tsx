// Port of views/Deck.tsx.
import { useState } from "react";
import { byId, challengeTitle, MODULES, moduleTitle } from "../../../src/challenges";
import { CARDS } from "../../../src/lib/cards";
import { useProgress } from "../../../src/lib/progress";
import { strings } from "../../../src/strings";
import { FONT, type Theme } from "../theme";
import { Rise, track } from "./anim";
import { CommandCard, MODULE_COLOR, moduleColor } from "./CommandCard";

/** The deck: every card, by module, face up once played. */
export function Deck({ t, locale }: { t: Theme; locale: string }) {
  const s = strings(locale);
  const { progress } = useProgress();
  const have = progress.cards;
  const count = CARDS.filter((c) => have[c.id]).length;
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const [gw, setGw] = useState(624);
  const col = (gw - 36) / 4;

  return (
    <div style={{ width: "100%", maxWidth: 672, paddingLeft: 24, paddingRight: 24, paddingTop: 40, paddingBottom: 40, fontFamily: FONT }}>
      <div style={{ fontSize: 24, lineHeight: 32, fontWeight: 600, letterSpacing: -0.6, color: t.foreground }}>{s.deckTitle}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 22.75, color: t.mutedForeground }}>{s.deckIntro}</div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }} onLayout={(e) => setGw(e.width ?? 624)}>
        <div style={{ flexGrow: 1, flexBasis: 0, height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: t.muted }}>
          <div style={{ height: 8, borderRadius: 4, backgroundColor: t.success, width: `${(count / CARDS.length) * 100}%` }} />
        </div>
        <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 12, lineHeight: 16, color: t.mutedForeground }}>
          {s.deckCount.replace("{n}", String(count)).replace("{total}", String(CARDS.length))}
        </div>
      </div>

      {MODULES.map((m) => {
        const cards = CARDS.filter((c) => c.module === m.id);
        const got = cards.filter((c) => have[c.id]).length;
        return (
          <div key={m.id} style={{ marginTop: 36 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <div style={{ whiteSpace: "nowrap", fontSize: 13, lineHeight: 19.5, fontWeight: 700, letterSpacing: 0.325, color: moduleColor(m.id as keyof typeof MODULE_COLOR) }}>{moduleTitle(m, locale).toUpperCase()}</div>
              <div style={{ whiteSpace: "nowrap", fontSize: 12, lineHeight: 16, fontWeight: 500, color: t.mutedForeground }}>{`${got}/${cards.length}`}</div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: 4, gap: 12 }}>
              {cards.map((c, i) => {
                const at = have[c.id], lesson = byId(c.taught);
                return (
                  <Rise key={c.id} d={i * 40} w={col}>
                    <CommandCard t={t} card={c} collected={Boolean(at)} w={col}
                      note={at ? s.deckCollected.replace("{date}", date.format(new Date(`${at}T12:00:00`))) : s.deckTaughtIn.replace("{title}", lesson ? challengeTitle(lesson, locale) : "")} />
                  </Rise>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
