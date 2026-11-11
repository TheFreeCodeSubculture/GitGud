// Port of views/PageView.tsx: about / dictionary / resources, rendered by the lesson renderer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Bug, ExternalLink } from "lucide-react";
import { COMPANION } from "../../../src/challenges";
import mascots from "../../../src/mascots.json";
import { strings } from "../../../src/strings";
import { CONTENT } from "../boot";
import { Lesson } from "../lesson";
import { FONT, type Theme } from "../theme";
import { Button } from "../ui";
import { LIcon } from "./anim";
import { Md, esc } from "./md";

const REPO = `https://github.com/${COMPANION.owner}/${COMPANION.repo}`;

function load(locale: string, page: string) {
  for (const l of [locale, "en-US"]) { try { return readFileSync(join(CONTENT, l, "pages", `${page}.html`), "utf8"); } catch { /* fall back */ } }
  return "";
}
// The dictionary keeps its <code> blocks directly inside <ul>; the lesson renderer only
// reads <li> there, so those lists become plain flows (li and code stack the same way).
const flatten = (html: string) => html.replace(/<ul class="no-list-style">((?:(?!<\/ul>)[\s\S])*?<code[\s\S]*?)<\/ul>/g, "<div>$1</div>");

export function PageView({ t, locale, page }: { t: Theme; locale: string; page: string }) {
  const s = strings(locale);
  const html = useMemo(() => flatten(load(locale, page)), [locale, page]);
  const title = page === "about" ? s.pageAbout : page === "dictionary" ? s.pageDictionary : page === "resources" ? s.pageResources : page;
  const [pre, post] = s.avatarDesc.split("DiceBear");

  const byLicense = new Map<string, { title: string; creator: string }[]>();
  for (const m of mascots as { license: string; title: string; creator: string }[]) byLicense.set(m.license, [...(byLicense.get(m.license) ?? []), m]);

  return (
    <div style={{ width: "100%", maxWidth: 672, paddingLeft: 24, paddingRight: 24, paddingTop: 32, paddingBottom: 32, fontFamily: FONT }}>
      <div style={{ fontSize: 24, lineHeight: 32, fontWeight: 600, letterSpacing: -0.6, color: t.foreground }}>{title}</div>
      <div style={{ marginTop: 24 }}><Lesson html={html} theme={t} /></div>
      {page === "about" && (
        <>
          <div style={{ marginTop: 24, fontSize: 14, lineHeight: 20, fontWeight: 600, color: t.foreground }}>{s.avatarStyles}</div>
          <div style={{ marginTop: 4 }}><Md t={t} src={`${esc(pre)}[DiceBear](https://www.dicebear.com)${esc(post ?? "")}`} /></div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {[...byLicense.entries()].map(([license, items]) => (
              <Md key={license} t={t} src={`**${esc(license)}** — ${esc([...new Set(items.map((i) => `${i.title} by ${i.creator}`))].join("; "))}.`} />
            ))}
          </div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([[ExternalLink, s.projectGithub, REPO], [Bug, s.reportIssue, `${REPO}/issues/new`]] as const).map(([Icon, label, url]) => (
              <Button key={label} t={t} variant="outline" onClick={() => void openUrl(url)}><LIcon C={Icon} size={14} color={t.foreground} />{label}</Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
