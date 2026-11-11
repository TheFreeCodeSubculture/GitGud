// The two warning strips App.tsx puts above the page: Git missing, saved progress unreadable.
import { useEffect, useState } from "react";
import { gitVersion } from "../../../src/lib/git";
import { useProgressUnreadable } from "../../../src/lib/progress";
import { strings } from "../../../src/strings";
import { Icon, withAlpha } from "../ui";
import type { Theme } from "../theme";

// --warning / --warning-foreground, resolved from the real CSS (tokens.json).
const WARNING = "rgba(254,154,0,1)";

function Banner({ t, children }: { t: Theme; children: string }) {
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 10,
      borderBottomWidth: 1, borderColor: t.border, backgroundColor: withAlpha(WARNING, 0.06), fontSize: 14, lineHeight: 20, color: t.dark ? "rgba(255,185,0,1)" : "rgba(187,77,0,1)" }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}><Icon name="triangle-alert" size={16} color={t.dark ? "rgba(255,185,0,1)" : "rgba(187,77,0,1)"} /></div>
      <div style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Banners({ t, locale }: { t: Theme; locale: string }) {
  const s = strings(locale);
  const [gitMissing, setGitMissing] = useState(false);
  const unreadable = useProgressUnreadable();
  useEffect(() => { gitVersion().then((v) => setGitMissing(!v)).catch(() => setGitMissing(true)); }, []);
  return (
    <>
      {gitMissing && <Banner t={t}>{s.gitMissing}</Banner>}
      {unreadable && <Banner t={t}>{`${s.saveUnreadable} ${s.saveKeptPrefix} user-data.corrupt.json ${s.saveKeptSuffix}`}</Banner>}
    </>
  );
}
