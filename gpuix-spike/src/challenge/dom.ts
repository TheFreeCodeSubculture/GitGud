// Just enough DOM for the Hairline kernel (src/vendor/hairline-kernel.js) and the
// figure libs to run unchanged: an element tree that can be serialised to an SVG
// string, plus the globals the kernel's frame loop reads (rAF, IntersectionObserver).
// Import for the side effect before `lib/hairline` is first used.
const g = globalThis as any;

type Listener = (e: any) => void;
export class FEl {
  nodeType = 1;
  attrs: Record<string, string> = {};
  children: FEl[] = [];
  parent: FEl | null = null;
  listeners: Record<string, Listener[]> = {};
  rect = { left: 0, top: 0, width: 400, height: 320 };
  onDirty?: () => void;
  text = "";
  constructor(public tag: string) {}
  get root(): FEl { return this.parent ? this.parent.root : this; }
  dirty() { this.root.onDirty?.(); }
  setAttribute(k: string, v: string) { if (this.attrs[k] !== String(v)) { this.attrs[k] = String(v); this.dirty(); } }
  getAttribute(k: string) { return this.attrs[k] ?? null; }
  set textContent(v: string) { this.text = v; }
  get textContent() { return this.text; }
  get classList() {
    const cls = () => new Set((this.attrs.class ?? "").split(/\s+/).filter(Boolean));
    const put = (s: Set<string>) => this.setAttribute("class", [...s].join(" "));
    return { add: (c: string) => put(cls().add(c)), remove: (c: string) => { const s = cls(); s.delete(c); put(s); }, contains: (c: string) => cls().has(c) };
  }
  appendChild(c: FEl) { c.parent = this; this.children.push(c); this.dirty(); return c; }
  append(...cs: FEl[]) { cs.forEach((c) => this.appendChild(c)); }
  replaceChildren() { this.children.forEach((c) => (c.parent = null)); this.children = []; this.dirty(); }
  addEventListener(t: string, f: Listener) { (this.listeners[t] ??= []).push(f); }
  removeEventListener(t: string, f: Listener) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  emit(t: string, e: any) { for (const f of this.listeners[t] ?? []) f(e); }
  getBoundingClientRect() { return this.rect; }
}

g.document ??= {};
Object.assign(g.document, {
  nodeType: 9,
  visibilityState: g.document.visibilityState ?? "visible",
  createElementNS: g.document.createElementNS ?? ((_: string, tag: string) => new FEl(tag)),
  createElement: g.document.createElement ?? ((tag: string) => new FEl(tag)),
  head: g.document.head ?? new FEl("head"),
});
g.requestAnimationFrame ??= (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
g.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
g.IntersectionObserver ??= class {
  constructor(private cb: (es: any[]) => void) {}
  observe(target: unknown) { queueMicrotask(() => this.cb([{ target, isIntersecting: true }])); }
  unobserve() {} disconnect() {}
};

// --- serialisation: the kernel's stylesheet (css() in the kernel), applied by hand ---
export const PALETTE = {
  light: { plate: "#ffffff", hi: "#232327", edge: "#a4a4ac", mid: "#c3c3c9", lo: "#e0e0e4" },
  // index.css: "Hairline's dark palette is drawn for a black page; on this glass it reads..."
  dark: { plate: "#08090a", hi: "#d0d6e0", edge: "#7d7f88", mid: "#50525a", lo: "#34353b" },
};
type Pal = typeof PALETTE.light;

function style(e: FEl, p: Pal, inGhost: boolean) {
  let fill = p.plate, stroke = p.mid, dash = "";
  const c = new Set((e.attrs.class ?? "").split(/\s+/));
  // Same order as the stylesheet: later rules of equal specificity win.
  if (c.has("nf")) fill = "none";
  if (c.has("fo")) stroke = "none";
  if (c.has("sil")) stroke = p.edge;
  if (c.has("hi")) stroke = p.hi;
  if (c.has("lo")) stroke = p.lo;
  if (c.has("dash")) dash = "1 3";
  if (c.has("dot")) { stroke = "none"; fill = c.has("off") ? p.lo : c.has("m") ? p.edge : p.hi; }
  if (inGhost) { fill = "none"; stroke = p.mid; }
  return { fill, stroke, dash };
}

/** The element tree as an SVG document, `px` wide on screen, rasterised at 2x. */
export function toSvg(root: FEl, dark: boolean, px: number) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  const unit = 400 / px; // one CSS px in viewBox units; non-scaling-stroke is 0.9 of them
  const sw = (0.9 * unit).toFixed(3);
  const walk = (e: FEl, ghost: boolean): string => {
    const attrs = Object.entries(e.attrs).filter(([k]) => k !== "class").map(([k, v]) => `${k}="${v}"`).join(" ");
    let extra = "";
    if (["path", "polygon", "ellipse", "line"].includes(e.tag)) {
      const s = style(e, p, ghost);
      extra = ` fill="${s.fill}" stroke="${s.stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${unit.toFixed(3)} ${(3 * unit).toFixed(3)}"` : ""}`;
    }
    const inner = e.children.map((c) => walk(c, ghost || (e.attrs.class ?? "").includes("ghost"))).join("");
    return `<${e.tag} ${attrs}${extra}>${inner}</${e.tag}>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="800" height="640">${root.children.map((c) => walk(c, false)).join("")}</svg>`;
}
