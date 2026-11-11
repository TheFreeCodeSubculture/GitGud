// The webview's localStorage survives restarts; the shim's is in memory. Back it
// with a file next to the progress file, so locale, theme and anything else the
// app keeps there (git-gud:locale, git-gud:theme, ...) persist the same way.
// Import right after ./tauri-shim and before anything that reads localStorage.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appDataDir } from "../tauri-shim";

const file = join(appDataDir(), "local-storage.json");
const ls = (globalThis as any).localStorage as Storage;
try { for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, "utf8")))) ls.setItem(k, String(v)); } catch {}

const dump = () => {
  const all: Record<string, string> = {};
  // The shim's stand-in has no key()/length; keep our own mirror instead.
  for (const k of known) all[k] = ls.getItem(k)!;
  try { mkdirSync(appDataDir(), { recursive: true }); writeFileSync(file, JSON.stringify(all)); } catch {}
};
const known = new Set<string>();
try { for (const k of Object.keys(JSON.parse(readFileSync(file, "utf8")))) known.add(k); } catch {}
const { setItem, removeItem } = ls;
ls.setItem = (k, v) => { setItem.call(ls, k, v); known.add(k); dump(); };
ls.removeItem = (k) => { removeItem.call(ls, k); known.delete(k); dump(); };
