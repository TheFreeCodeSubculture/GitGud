// A Hairline figure (src/lib/*Figure.ts) in GPUIX. The figure code draws into
// the fake DOM from ./dom; each change is serialised to SVG and pushed into an
// <img>. Pointer events from GPUIX are replayed as the DOM events the kernel's
// `pointer()` listens for.
import { useEffect, useRef } from "react";
import type { ImgInstance } from "@gpuix/react";
import { renderer } from "../boot";
import type { Theme } from "../theme";
import { FEl, toSvg } from "./dom";

export function Figure({ t, width, mount, deps }: { t: Theme; width: number; mount: (stage: any, svg: any) => () => void; deps: unknown[] }) {
  const img = useRef<ImgInstance>(null);
  const stage = useRef<FEl>(new FEl("div"));
  const svg = useRef<FEl>(new FEl("svg"));
  const dark = useRef(t.dark);
  dark.current = t.dark;

  const paint = () => img.current?.setImage(Buffer.from(toSvg(svg.current, dark.current, width)));
  useEffect(() => {
    let queued = false;
    svg.current.onDirty = () => { if (!queued) { queued = true; setTimeout(() => { queued = false; paint(); }, 0); } };
    const dispose = mount(stage.current, svg.current);
    return () => { dispose(); svg.current.onDirty = undefined; };
  }, deps);
  useEffect(paint, [t.dark]);

  const wrap = useRef<{ id: number }>(null);
  const emit = (type: string, e: { x?: number; y?: number }) => {
    const b = wrap.current && renderer.getElementBounds(wrap.current.id);
    if (!b) return;
    stage.current.rect = { left: b.x, top: b.y, width: b.width, height: b.height };
    stage.current.emit(type, { clientX: e.x ?? 0, clientY: e.y ?? 0, pointerType: "mouse" });
  };
  // The handlers live on a wrapper: an <img> itself takes no pointer events.
  return (
    <div ref={wrap as never} style={{ width, height: width * 0.8, flexShrink: 0 }}
      onMouseMove={(e) => emit("pointermove", e)} onMouseDown={(e) => emit("pointerdown", e)} onMouseLeave={(e) => emit("pointerleave", e)}>
      <img ref={img as never} style={{ width, height: width * 0.8, pointerEvents: "none" }} />
    </div>
  );
}
