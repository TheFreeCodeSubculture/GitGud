// Port of src/components/Shell.tsx + SidebarArt.
import { join } from "node:path";
import { useEffect, useRef, type ReactNode } from "react";
import { useWindowSize, type PublicInstance as Instance } from "@gpuix/react";
import { challengeTitle, grouped, moduleTitle } from "../../src/challenges";
import { CARDS } from "../../src/lib/cards";
import { availableLocales } from "../../src/lib/content";
import { useHeaderTitle } from "../../src/lib/headerTitle";
import { useProgress } from "../../src/lib/progress";
import { strings } from "../../src/strings";
import { PUBLIC, ROOT, renderer } from "./boot";
import { LocaleMenu } from "./nav/locale";
import { CommandPalette } from "./nav/palette";
import { OutlineColumn, OutlineRail, outlineLayout, useOutline } from "./nav/outline";
import { revealSearchHit, useFlash } from "./nav/reveal";
import { Button, EASE_OUT_STRONG, Icon, withAlpha } from "./ui";
import { FONT, MONO, type Theme } from "./theme";
import { dragArea, noDrag } from "./WindowControls";

import type { Route } from "../../src/lib/router";
export type { Route };

const SIDEBAR_W = 256;
const hoverRow = (t: Theme) => ({ backgroundColor: t.rowHover, color: t.sidebarForeground });

function Row({ t, selected, onClick, shadow = true, style, children }: {
  t: Theme; selected: boolean; onClick: () => void; shadow?: boolean; style?: object; children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 6,
        height: 32, paddingLeft: 8, paddingRight: 8, fontSize: 14, lineHeight: 20, cursor: "pointer",
        ...(selected
          ? { backgroundColor: t.rowSelected, fontWeight: 500, color: t.sidebarForeground,
              ...(shadow && { boxShadow: { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0, color: "rgba(0,0,0,0.05)" } }) }
          : { color: t.sidebarMuted, hover: hoverRow(t) }),
        ...style,
      }}
    >{children}</div>
  );
}

const PAGES = [["dictionary", "navDictionary", "book-marked"], ["resources", "navResources", "library-big"], ["about", "navAbout", "info"]] as const;

function Sidebar({ t, locale, route, go, onSearch }: { t: Theme; locale: string; route: Route; go: (r: Route) => void; onSearch: () => void }) {
  const s = strings(locale);
  const groups = grouped();
  const { progress, isComplete, completedCount, total } = useProgress();
  const art = join(ROOT, "assets", "baked", "header-art.png");
  return (
    <div style={{ position: "relative", width: SIDEBAR_W, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", backgroundColor: t.sidebar, borderRightWidth: 1, borderColor: t.sidebarBorder, fontFamily: FONT }}>
      {/* SidebarArt: the CSS stacks a mask and an 8-stop wash; one 2-stop wash
          in the panel colour over the art gets the same dissolve. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, overflow: "hidden", pointerEvents: "none" }}>
        <img src={art} objectFit="cover" style={{ width: 256, height: 80, opacity: t.dark ? 0.55 : 1 }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: { type: "linear-gradient", angle: 180, stops: [{ color: withAlpha(t.sidebar, 0), position: 0.28 }, { color: t.sidebar, position: 0.92 }] } }} />
      </div>

      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}>
        <img src={join(PUBLIC, "brand", "mark.png")} style={{ width: 22, height: 22 }} />
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.35, color: t.sidebarForeground }}>Git Gud</div>
        <div style={{ flexGrow: 1 }} />
        <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 12, color: t.mutedForeground }}>{`${completedCount} / ${total}`}</div>
      </div>

      <div style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 8 }}>
        <div onClick={onSearch} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, height: 32, paddingLeft: 10, paddingRight: 6, borderRadius: 8, borderWidth: 1, borderColor: t.input, backgroundColor: t.dark ? "rgba(255,255,255,0.03)" : t.popover, cursor: "pointer",
          boxShadow: { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0, color: "rgba(0,0,0,0.05)" },
          hover: { backgroundColor: t.dark ? "rgba(255,255,255,0.05)" : "rgba(244,244,245,0.5)" } }}>
          <Icon name="search" size={14} color={t.mutedForeground} />
          <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 14, color: t.mutedForeground }}>{s.searchLabel}</div>
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 10, lineHeight: 14, fontFamily: MONO, color: t.mutedForeground, backgroundColor: t.muted, borderWidth: 1, borderColor: t.border, borderRadius: 4, paddingLeft: 4, paddingRight: 4 }}>Ctrl K</div>
        </div>
      </div>

      <div style={{ position: "relative", flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <div style={{ height: "100%", overflowY: "scroll", scrollbarWidth: 0, padding: 8, paddingBottom: 16 }}>
          <Row t={t} selected={route.name === "home"} onClick={() => go({ name: "home" })}>
            <Icon name="house" color={route.name === "home" ? t.sidebarForeground : t.sidebarMuted} />{s.navHome}
          </Row>
          {groups.map(({ module, items }) => {
            const doneCount = items.filter((i) => isComplete(i.challenge.id)).length;
            const moduleDone = doneCount === items.length;
            const tint = moduleDone ? t.successForeground : t.sidebarMuted;
            return (
              <div key={module.id} style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", paddingLeft: 8, paddingRight: 8, paddingTop: 1, paddingBottom: 6 }}>
                  <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, lineHeight: 16.5, fontWeight: 500, letterSpacing: 0.77, color: tint }}>{moduleTitle(module, locale).toUpperCase()}</div>
                  <div style={{ flexGrow: 1 }} />
                  {moduleDone
                    ? <Icon name="check" size={12} color={tint} />
                    : <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 10, lineHeight: 16, color: withAlpha(t.sidebarMuted, 0.7) }}>{`${doneCount}/${items.length}`}</div>}
                </div>
                {items.map(({ challenge, index }) => {
                  const current = route.name === "challenge" && route.id === challenge.id;
                  const done = isComplete(challenge.id);
                  return (
                    <div key={challenge.id} style={{ borderLeftWidth: 2, borderColor: current ? t.primary : done ? withAlpha(t.success, 0.55) : t.sidebarBorder, paddingLeft: 8 }}>
                      <Row t={t} selected={current} onClick={() => go({ name: "challenge", id: challenge.id })} style={{ gap: 10, paddingLeft: 6 }}>
                        <div style={{ width: 16, flexShrink: 0, display: "flex", flexDirection: "row", justifyContent: "center", fontSize: 10, lineHeight: 14, color: done ? t.successForeground : current ? t.foreground : withAlpha(t.sidebarMuted, 0.6) }}>
                          {done ? <Icon name="check" size={14} color={t.successForeground} /> : String(index + 1)}
                        </div>
                        <div style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", lineHeight: 20 }}>{challengeTitle(challenge, locale)}</div>
                      </Row>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 16, pointerEvents: "none",
          background: { type: "linear-gradient", angle: 0, stops: [{ color: t.sidebar, position: 0 }, { color: withAlpha(t.sidebar, 0), position: 1 }] } }} />
      </div>

      <div style={{ flexShrink: 0, borderTopWidth: 1, borderColor: t.sidebarBorder, padding: 8 }}>
        <Row t={t} selected={route.name === "deck"} shadow={false} onClick={() => go({ name: "deck" })}>
          <Icon name="layers" color={t.sidebarMuted} />{s.navDeck}
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 11, color: withAlpha(t.sidebarMuted, 0.7) }}>{`${CARDS.filter((c) => progress.cards[c.id]).length}/${CARDS.length}`}</div>
        </Row>
        {PAGES.map(([page, key, icon]) => (
          <Row key={page} t={t} selected={route.name === "page" && route.page === page} shadow={false} onClick={() => go({ name: "page", page })}>
            <Icon name={icon} color={t.sidebarMuted} />{s[key]}
          </Row>
        ))}
        {/* Version readout + UpdateButton: the original hides both while the install
            kind is "unsupported", which is always the case here (no updater backend). */}
      </div>
    </div>
  );
}

export function Shell({ t, locale, onLocale, route, go, dark, onDark, scene, children, onScroll, palette, onPalette, controls, banners }: {
  t: Theme; locale: string; onLocale: (l: string) => void; route: Route; go: (r: Route) => void; dark: boolean; onDark: (d: boolean) => void;
  scene?: ReactNode; children: ReactNode; onScroll?: (y: number) => void;
  palette: boolean; onPalette: (open: boolean) => void;
  /** Right end of the title bar: <WindowControls/>, flush to the edge as in the original. */
  controls?: ReactNode;
  /** Warning strips above the page, full width (App.tsx puts them before the view). */
  banners?: ReactNode;
}) {
  const home = route.name === "home";
  const s = strings(locale);
  const win = useWindowSize();
  const promoted = useHeaderTitle();
  const locales = availableLocales();
  const scroller = useRef<Instance>(null), content = useRef<Instance>(null), row = useRef<Instance>(null);
  const outline = useOutline(scroller, content, row);
  const flash = useFlash();

  // The page scrolls inside <main>, so a new route starts at the top only if this resets it.
  const routeKey = route.name === "challenge" ? route.id : route.name === "page" ? route.page : route.name;
  useEffect(() => { if (scroller.current) renderer.scrollTo(scroller.current.id, 0, 0); }, [routeKey]);

  const paneW = win.width - SIDEBAR_W;
  const layout = outlineLayout({ x: SIDEBAR_W, w: paneW });
  const showOutline = route.name === "challenge" && outline.headings.length >= 2;
  const pick = (hit: { challengeId: string; headingId: string }, query: string) => {
    onPalette(false);
    go({ name: "challenge", id: hit.challengeId });
    revealSearchHit({ scroller: () => scroller.current, headingId: hit.headingId, query });
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "row", width: "100%", height: "100%", backgroundColor: t.background, color: t.foreground, fontFamily: FONT }}>
      <Sidebar t={t} locale={locale} route={route} go={go} onSearch={() => onPalette(true)} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, height: "100%" }}>
        {scene}
        <div {...dragArea} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, height: 52, flexShrink: 0,
          // surface-glass over a solid page is the page colour; on home the sky shows through.
          backgroundColor: home ? undefined : t.headerGlass }}>
          {/* The promoted heading fades in as the real one leaves the viewport. */}
          <div style={{ flexGrow: 1, minWidth: 0, paddingLeft: 16, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, pointerEvents: "none" }}
            motion={{ initial: { opacity: 0 }, animate: { opacity: promoted ? 1 : 0 }, transition: { duration: 0.2, ease: EASE_OUT_STRONG } }}>
            {promoted?.mascotId && <img src={join(PUBLIC, "mascots", `${promoted.mascotId}.svg`)}
              style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, padding: 1 }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, lineHeight: 13.75, color: t.mutedForeground, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{promoted?.eyebrow ?? ""}</div>
              <div style={{ fontSize: 14, lineHeight: 17.5, fontWeight: 600, letterSpacing: -0.35, color: t.foreground, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{promoted?.title ?? ""}</div>
            </div>
          </div>
          {locales.length > 1 && <div {...noDrag}><LocaleMenu t={t} locale={locale} locales={locales} onChange={onLocale} /></div>}
          <div {...noDrag}><Button t={t} variant="ghost" size="icon" onClick={() => onDark(!dark)}>
            <Icon name={dark ? "sun" : "moon"} color={t.mutedForeground} />
          </Button></div>
          {controls}
        </div>
        <div style={{ position: "relative", flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <div ref={scroller} style={{ height: "100%", overflowY: "scroll", display: "flex", flexDirection: "column", alignItems: "center" }}
            highlight={flash ? flash.terms.map((query) => ({ query, color: withAlpha(t.primary, 0.35 * flash.alpha) })) : null}
            onScroll={(e) => onScroll?.(e.scrollY ?? 0)} onScrollChange={outline.measure}>
            {/* The row the original's `max-w-6xl justify-center gap-6 px-6` makes: content, then the outline's column. */}
            <div ref={content} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              {banners}
              {route.name === "challenge" ? (
                <div ref={row} style={{ width: "100%", maxWidth: 1152, paddingLeft: 24, paddingRight: 24, display: "flex", flexDirection: "row", justifyContent: "center", gap: 24 }}>
                  <div style={{ width: 672, flexShrink: 1, minWidth: 0, maxWidth: 672 }}>{children}</div>
                  {!layout.narrow && <div style={{ width: 192, flexShrink: 0 }} />}
                </div>
              ) : children}
            </div>
          </div>
          {/* topbar-scroll-fade: a mask in CSS. On a solid page, fading content
              to transparent over the page colour is the same as painting the
              page colour over it, which GPUIX can do. */}
          {!home && <div style={{ position: "absolute", top: 0, left: 0, right: 6, height: 32, pointerEvents: "none",
            background: { type: "linear-gradient", angle: 180, stops: [{ color: t.background, position: 0 }, { color: withAlpha(t.background, 0), position: 1 }] } }} />}
          {showOutline && !layout.narrow && (
            <OutlineColumn t={t} headings={outline.headings} active={outline.active} onJump={outline.jump}
              left={layout.left - SIDEBAR_W} top={outline.top} height={win.height - 128} />
          )}
        </div>
      </div>
      {showOutline && layout.narrow && <OutlineRail t={t} headings={outline.headings} active={outline.active} onJump={outline.jump} winH={win.height} />}
      <CommandPalette t={t} locale={locale} open={palette} onOpenChange={onPalette} onPick={pick} />
    </div>
  );
}
