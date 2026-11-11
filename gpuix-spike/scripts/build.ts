// Single-file binary for packaging: `bun scripts/build.ts <outfile> [bun-linux-x64]`.
// `bun build --compile` on the CLI would skip bunfig.toml's preloads, which the
// app's own src/ needs (see nav/content-glob.ts), so build through the API.
import { appSrc } from "../src/nav/content-glob";

const [outfile = "dist/git-gud", target = "bun-linux-x64"] = process.argv.slice(2);
const r = await Bun.build({ entrypoints: [`${import.meta.dir}/../src/main.tsx`], compile: { target: target as any, outfile }, plugins: [appSrc] });
if (!r.success) { for (const l of r.logs) console.error(l); process.exit(1); }
console.log("built", outfile);
