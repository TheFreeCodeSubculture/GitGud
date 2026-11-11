// Source rewrites that let the app's own src/ run unchanged under Bun (preloaded by
// bunfig.toml):
//  1. `import.meta.glob` (src/lib/content.ts, hence search.ts) does not exist in Bun;
//     turn that one call into a read of the same files.
//  2. src/ imports "react" from the repo root while the renderer uses the spike's
//     copy; two Reacts is "Invalid hook call". Point src/ at the spike's.
import { plugin, type BunPlugin } from "bun";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const SPIKE = join(import.meta.dir, "..", "..");
const APP_SRC = resolve(SPIKE, "..", "src") + sep;
const REACT = resolve(SPIKE, "node_modules", "react").replaceAll("\\", "/");

const HELPER = String.raw`import { readFileSync as __r, readdirSync as __d } from "node:fs";
import { join as __j } from "node:path";
function __glob(dir, pattern) {
  // "../content/*/challenges/*.html" -> every <locale>/<kind>/<file> under dir/../content
  const [, kind, ext] = pattern.match(/^\.\.\/content\/\*\/(\w+)\/\*(\.\w+)$/);
  const out = {};
  // A packaged build has no source tree: GG_ROOT/../src/content (see boot.ts).
  const root = process.env.GG_ROOT ? __j(process.env.GG_ROOT, "..", "src", "content") : __j(dir, "..", "content");
  for (const l of __d(root)) for (const f of __d(__j(root, l, kind))) if (f.endsWith(ext)) out["../content/" + l + "/" + kind + "/" + f] = __r(__j(root, l, kind, f), "utf8");
  return out;
}
`;

/** Also passed to Bun.build by scripts/build.ts, since a compiled binary skips bunfig preloads. */
export const appSrc: BunPlugin = {
  name: "app-src",
  setup(build) {
    // (Bun's filters don't match patterns with a slash, so test the path in code.)
    build.onLoad({ filter: /\.tsx?$/ }, (args) => {
      let src = readFileSync(args.path, "utf8");
      const loader = args.path.endsWith("x") ? "tsx" : "ts";
      if (!args.path.startsWith(APP_SRC)) return { contents: src, loader }; // onLoad must return something
      src = src.replace(/(from\s+|import\s+)(["'])react(\/[\w-]+)?\2/g, (_, a, _q, sub = "") => `${a}${JSON.stringify(REACT + sub)}`);
      // 3. Vite's `?raw` (src/lib/hairline.ts) is Bun's text import.
      src = src.replace(/(["'])~\/([^"']+)\?raw\1/g, (_, _q, p) => `${JSON.stringify(resolve(APP_SRC, p).replaceAll("\\", "/"))} with { type: "text" }`);
      if (/lib[\\/]content\.ts$/.test(args.path)) src = HELPER + src.replaceAll("import.meta.glob(", `__glob(${JSON.stringify(dirname(args.path))}, `);
      return { contents: src, loader };
    });
  },
};

plugin(appSrc);
