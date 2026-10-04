import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
// @ts-expect-error type error without @types/node package
import { execFile } from "node:child_process";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

/**
 * Demo branch only: real Git for Flute scenes running in a plain browser.
 *
 * The app runs Git through Tauri's `run_git`; a browser tab has no Tauri, so
 * this stands in for it during `vite dev`. Read-only subcommands only, and
 * only for requests from this machine.
 */
function readOnlyGit(args: unknown): args is string[] {
  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) return false;
  const [cmd, ...rest] = args as string[];
  switch (cmd) {
    case "--version": return rest.length === 0;
    case "config": return rest.length === 1 && !rest[0].startsWith("-");
    case "branch": return rest[0] === "--show-current" || rest[0] === "--list";
    case "remote": return rest.length === 0 || (rest[0] === "-v" && rest.length === 1) || (rest[0] === "get-url" && rest.length === 2);
    case "rev-parse": case "rev-list": case "ls-files": case "status": case "log": case "for-each-ref": return true;
    default: return false;
  }
}

function demoGit(): Plugin {
  return {
    name: "demo-git",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__demo/git", (req: any, res: any) => {
        const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
        let body = "";
        req.on("data", (chunk: string) => (body += chunk));
        req.on("end", () => {
          let parsed: { args?: unknown; cwd?: string } = {};
          try { parsed = JSON.parse(body); } catch { /* rejected below */ }
          const { args, cwd } = parsed;
          if (req.method !== "POST" || !local || !readOnlyGit(args)) {
            res.statusCode = 403;
            return res.end();
          }
          execFile("git", args, { cwd, windowsHide: true }, (error: any, stdout: string, stderr: string) => {
            res.setHeader("content-type", "application/json");
            const code = error ? (typeof error.code === "number" ? error.code : null) : 0;
            res.end(JSON.stringify({ stdout, stderr, code }));
          });
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), demoGit()],

  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
