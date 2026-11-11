// Tokens the shared theme.ts lacks (from tokens.json, light/dark).
import type { Theme } from "../theme";
export const warning = (_t: Theme) => "rgba(254,154,0,1)";
export const warningForeground = (t: Theme) => (t.dark ? "rgba(255,185,0,1)" : "rgba(187,77,0,1)");
export const errorForeground = (t: Theme) => (t.dark ? "rgba(255,100,103,1)" : "rgba(193,0,7,1)");
export const errorSurface = (t: Theme) => (t.dark ? "rgba(255,64,77,0.078)" : "rgba(255,38,51,0.078)");
/** --secondary, --muted */
export const secondary = (t: Theme) => (t.dark ? "rgba(255,255,255,0.031)" : "rgba(250,250,250,1)");
