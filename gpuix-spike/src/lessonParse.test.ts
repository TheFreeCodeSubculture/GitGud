import { test, expect } from "bun:test";
import { parse, textOf } from "./lessonParse";
test("parses nesting, void tags, entities, attrs", () => {
  const [p] = parse('<p class="a b">x &amp; <code class="shell">git "a"</code><br><img src="/i.png" width=5></p>');
  expect(p).toMatchObject({ tag: "p", attrs: { class: "a b" } });
  expect(textOf(p)).toBe('x & git "a"\n');
  expect((p as any).children[3].attrs).toEqual({ src: "/i.png", width: "5" });
});
