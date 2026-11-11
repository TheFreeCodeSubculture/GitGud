// Window-level key events (the original's `window.addEventListener("keydown")`).
// boot.launch forwards GPUIX's single window handler here; components subscribe.
import { useEffect, useRef } from "react";
import type { KeyEvent } from "@gpuix/react";

const handlers = new Set<(e: KeyEvent) => void>();
export const dispatchWindowKey = (e: KeyEvent) => { for (const h of [...handlers]) h(e); };

export function useWindowKeyDown(fn: (e: KeyEvent) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyEvent) => ref.current(e);
    handlers.add(h);
    return () => void handlers.delete(h);
  }, []);
}
