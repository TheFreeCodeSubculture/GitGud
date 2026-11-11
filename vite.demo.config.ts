import { mergeConfig, type Plugin } from "vite";
import base from "./vite.config";

/**
 * The site's demo build: the real app UI on a fake backend (src/demo/main.tsx),
 * emitted into site/demo/ so the landing page can play it in an iframe.
 *
 * The app names its public files root-absolute ("/mascots/x.svg"), which is
 * right inside the Tauri window but points at the domain root once the build
 * lives under /GitGud/demo/. This rewrites those to "./" in source and lesson
 * HTML for this build only; CSS urls are already handled by `base`.
 */
const relativePublic: Plugin = {
  name: "demo-relative-public",
  enforce: "pre",
  transform(code, id) {
    if (id.includes("node_modules") || /\.css(\?|$)/.test(id)) return null;
    const out = code.replace(/(["'`(])\/(mascots|brand|gitty|imgs)\//g, "$1./$2/");
    return out === code ? null : { code: out, map: null };
  },
};

export default mergeConfig(base({ command: "build", mode: "production" }), {
  base: "./",
  plugins: [relativePublic],
  build: {
    outDir: "site/demo",
    emptyOutDir: true,
    rollupOptions: { input: "demo.html" },
  },
});
