// Tiny parser for the well-formed HTML subset lessons use. Not a general HTML parser.
export type El = { tag: string; attrs: Record<string, string>; children: Node[] };
export type Node = string | El;

const VOID = new Set(["img", "br", "hr"]);
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–" };
export const decode = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));

export function parse(html: string): Node[] {
  const root: El = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+|<)/g;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) top.children.push(decode(m[5]));
    else if (m[2] === undefined) continue; // comment
    else if (m[1]) {
      const i = stack.findLastIndex((e) => e.tag === m[2].toLowerCase());
      if (i > 0) stack.length = i; // tolerate stray closers
    } else {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? "");
      const el: El = { tag: m[2].toLowerCase(), attrs, children: [] };
      top.children.push(el);
      if (!VOID.has(el.tag) && !m[4]) stack.push(el);
    }
  }
  return root.children;
}

export const textOf = (n: Node): string => (typeof n === "string" ? n : n.tag === "br" ? "\n" : n.children.map(textOf).join(""));
