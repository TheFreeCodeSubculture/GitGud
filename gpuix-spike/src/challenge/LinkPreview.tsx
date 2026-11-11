// Port of components/LinkPreview.tsx (hover card with a screenshot of the link) and
// the site icon Html.tsx puts in front of every external link.
//
// The web version delegates mouseover on the content root. GPUIX has no inline
// links to hit-test, so each link word (see rich.tsx) reports enter/leave through
// this context, with its own element id, and the card anchors to that word.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ImgInstance } from "@gpuix/react";
import { renderer } from "../boot";
import { FONT, type Theme } from "../theme";

export const LinkCtx = createContext<{ enter(href: string, id: number): void; leave(): void } | null>(null);

const CARD_H = 178; // 4 + 143.75 image + host row, inside a 1 px border
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

const shotUrl = (url: string) => `https://api.microlink.io/?${new URLSearchParams({
  url, screenshot: "true", meta: "false", embed: "screenshot.url", colorScheme: "dark",
  "viewport.isMobile": "true", "viewport.deviceScaleFactor": "1", "viewport.width": "720", "viewport.height": "450",
})}`;

/** Wrap the lesson: owns the one card, with the 450 ms dwell in and 120 ms grace out. */
export function LinkPreviewHost({ t, children }: { t: Theme; children: ReactNode }) {
  const [card, setCard] = useState<{ href: string; x: number; y: number; below: boolean } | null>(null);
  const timers = useRef<{ open?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }>({});
  const api = useRef({
    enter(href: string, id: number) {
      clearTimeout(timers.current.close); clearTimeout(timers.current.open);
      timers.current.open = setTimeout(() => {
        const b = renderer.getElementBounds(id);
        // Base UI flips to the bottom when the card does not fit above the link.
        if (b) setCard(b.y - 8 - CARD_H >= 8 ? { href, x: b.x + b.width / 2, y: b.y - 8, below: false } : { href, x: b.x + b.width / 2, y: b.y + b.height + 8, below: true });
      }, 450);
    },
    leave() {
      clearTimeout(timers.current.open);
      timers.current.close = setTimeout(() => setCard(null), 120);
    },
  });
  useEffect(() => () => { clearTimeout(timers.current.open); clearTimeout(timers.current.close); }, []);
  return <LinkCtx.Provider value={api.current}>{children}{card && <Card t={t} {...card} />}</LinkCtx.Provider>;
}

function Card({ t, href, x, y, below }: { t: Theme; href: string; x: number; y: number; below: boolean }) {
  const img = useRef<ImgInstance>(null);
  const [state, setState] = useState<"pending" | "ok" | "failed">("pending");
  useEffect(() => {
    let alive = true;
    setState("pending");
    fetch(shotUrl(href))
      .then((r) => (r.ok && r.headers.get("content-type")?.startsWith("image") ? r.arrayBuffer() : Promise.reject()))
      .then((b) => { if (alive) { img.current?.setImage(Buffer.from(b)); setState("ok"); } })
      .catch(() => alive && setState("failed"));
    return () => { alive = false; };
  }, [href]);
  return (
    <anchored position={{ x, y }} anchor={below ? "topCenter" : "bottomCenter"} fit="snap" snapMargin={8} deferred priority={1} style={{ pointerEvents: "none", borderRadius: 12 }}>
      <div style={{ width: 240, borderRadius: 12, borderWidth: 1, borderColor: t.dark ? "rgba(255,255,255,0.08)" : "rgba(39,39,42,0.1)", backgroundColor: t.popover, padding: 4, overflow: "hidden", fontFamily: FONT,
        boxShadow: t.dark ? [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.05)", inset: true }, { offsetX: 0, offsetY: 24, blurRadius: 72, spreadRadius: -20, color: "rgba(0,0,0,0.8)" }]
          : { offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -24, color: "rgba(0,0,0,0.28)" } }}>
        <div style={{ position: "relative", width: 230, height: 143.75, borderRadius: 8, backgroundColor: t.muted, overflow: "hidden" }}>
          {state !== "ok" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: t.mutedForeground }}>{state === "failed" ? "No preview" : "Loading…"}</div>}
          <img ref={img as never} objectFit="cover" style={{ position: "absolute", top: 0, left: 0, width: 230, height: 143.75, opacity: state === "ok" ? 1 : 0 }} />
        </div>
        <div style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 2, fontSize: 11, lineHeight: 16.5, color: t.mutedForeground, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hostOf(href)}</div>
      </div>
    </anchored>
  );
}

/** Use inside a link word: handlers that drive the card. */
export function useLinkHover(href: string) {
  const ctx = useContext(LinkCtx);
  const el = useRef<{ id: number }>(null);
  return { ref: el, onMouseEnter: () => el.current && ctx?.enter(href, el.current.id), onMouseLeave: () => ctx?.leave(), onMouseDown: () => ctx?.leave() };
}

// ---- site icon ----
const GITHUB = '<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 5 18 5.3 18 5.3c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>';
const GLOBE = '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>';
const failed = new Set<string>(); // hosts whose favicon already failed this session
const fav = (body: string, fill: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill ? "black" : "none"}" stroke="${fill ? "none" : "black"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** GitHub gets its mark in the link colour, everything else Google's favicon, with a globe as the fallback. */
export function Favicon({ href, color }: { href: string; color: string }) {
  const host = (() => { try { return new URL(href).hostname.toLowerCase(); } catch { return ""; } })();
  const gh = host === "github.com" || host.endsWith(".github.com");
  const img = useRef<ImgInstance>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (gh || !host || failed.has(host)) return;
    let alive = true;
    fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => { if (alive) { img.current?.setImage(Buffer.from(b)); setOk(true); } })
      .catch(() => failed.add(host));
    return () => { alive = false; };
  }, [host]);
  // One stable <img> (the fetched icon lands in it); the vector fallback sits under it until then.
  return (
    <div style={{ position: "relative", width: 14, height: 14, flexShrink: 0, marginRight: 4.5, marginTop: 3, borderRadius: 3, overflow: "hidden" }}>
      {!ok && <svg source={fav(gh ? GITHUB : GLOBE, gh)} style={{ position: "absolute", top: 0, left: 0, width: 14, height: 14, color }} />}
      <img ref={img as never} style={{ position: "absolute", top: 0, left: 0, width: 14, height: 14 }} />
    </div>
  );
}
