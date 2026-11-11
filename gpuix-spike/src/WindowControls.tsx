// Port of src/components/WindowControls.tsx: minimise / maximise / close for the undecorated window.
// 46x32 like Windows' own controls; icons are the same lucide minus / square / copy / x.
// Only drawn when the native window really has no frame (`decorations: "client"` took effect,
// i.e. the patched build on Linux); everywhere else the OS keeps its title bar.
import { useEffect, useState } from "react";
import { __iconData as copy } from "lucide-react/dist/esm/icons/copy.mjs";
import { __iconData as minus } from "lucide-react/dist/esm/icons/minus.mjs";
import { __iconData as square } from "lucide-react/dist/esm/icons/square.mjs";
import { __iconData as x } from "lucide-react/dist/esm/icons/x.mjs";
import { renderer } from "./boot";
import type { Theme } from "./theme";
import { Icon, registerIcon } from "./ui";

registerIcon("minus", minus, 2.5);
registerIcon("square", square, 2.5);
registerIcon("copy", copy, 2.5);
registerIcon("x", x, 2);

// Stock @gpuix/native has none of these methods; the patched build has all of them.
type WindowApi = { hasClientDecorations(): boolean; isMaximized(): boolean; minimizeWindow(): void; zoomWindow(): void; closeWindow(): void };
const win = renderer as unknown as Partial<WindowApi>;

/** Whether the app must draw its own title bar and window buttons. */
export const hasClientDecorations = (): boolean => { try { return win.hasClientDecorations?.() === true; } catch { return false; } };

/** Spread on the header: dragging it moves the window, double click maximises (native, see NATIVE.md). */
export const dragArea = { windowDragArea: true } as object;
/** Spread on every interactive child of the header (buttons, links) so pressing it does not start a window move. */
export const noDrag = { windowNoDrag: true } as object;

/** `rgba(r,g,b,a)` with its alpha replaced: Tailwind's `text-foreground/80`. */
const withAlpha = (c: string, a: number) => c.replace(/rgba?\(([^)]+)\)/, (_, v: string) => `rgba(${v.split(",").slice(0, 3).join(",")},${a})`);

export function WindowControls({ t }: { t: Theme }) {
  // Wayland settles on client decorations a moment after the window opens, so this is polled, not read once.
  const [available, setAvailable] = useState(hasClientDecorations);
  const [maximized, setMaximized] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  // The WebView build listens to onResized; there is no resize event here, so sample the (cheap) query.
  useEffect(() => {
    if (!win.hasClientDecorations) return; // stock native build: nothing to poll
    const sync = () => { setAvailable(hasClientDecorations()); try { setMaximized(win.isMaximized?.() === true); } catch {} };
    sync();
    const id = setInterval(sync, 200);
    return () => clearInterval(id);
  }, []);

  // Nothing to control while the OS owns the frame.
  if (!available) return null;

  const controls = [
    { label: "Minimise", icon: "minus", size: 14, sw: 2.5, onClick: () => win.minimizeWindow?.(), danger: false },
    // Two overlapping squares read as "restore"; one reads as "maximise".
    { label: maximized ? "Restore" : "Maximise", icon: maximized ? "copy" : "square", size: 14, sw: 2.5, onClick: () => { win.zoomWindow?.(); setTimeout(() => { try { setMaximized(win.isMaximized?.() === true); } catch {} }, 150); }, danger: false },
    { label: "Close", icon: "x", size: 16, sw: 2, onClick: () => (win.closeWindow ? win.closeWindow() : process.exit(0)), danger: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", alignSelf: "stretch" }}>
      {controls.map((c) => {
        const on = hover === c.label;
        return (
          <div key={c.label} {...noDrag} aria-label={c.label} onClick={c.onClick}
            onMouseEnter={() => setHover(c.label)} onMouseLeave={() => setHover((h) => (h === c.label ? null : h))}
            style={{
              width: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default",
              // hover:bg-[#c42b1c] hover:text-white  /  hover:bg-accent hover:text-foreground
              backgroundColor: on ? (c.danger ? "#c42b1c" : t.accent) : "transparent",
            }}>
            <Icon name={c.icon} size={c.size} strokeWidth={c.sw} color={on ? (c.danger ? "#ffffff" : t.foreground) : withAlpha(t.foreground, 0.8)} />
          </div>
        );
      })}
    </div>
  );
}
