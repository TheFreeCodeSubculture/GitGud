// Resolved from the real index.css tokens in Chromium (oklch/color-mix → sRGB),
// because GPUIX styles take plain colours only. Regenerate if index.css changes.
export const LIGHT = {
  background: "rgba(252,252,252,1)", foreground: "rgba(39,39,42,1)",
  card: "rgba(255,255,255,1)", popover: "rgba(255,255,255,1)",
  primary: "rgba(27,78,216,1)", primaryForeground: "#ffffff",
  muted: "rgba(250,250,250,1)", mutedForeground: "rgba(113,113,123,1)",
  accent: "rgba(244,244,245,1)", border: "rgba(228,228,231,1)", input: "rgba(212,212,216,1)",
  success: "rgba(0,188,125,1)", successForeground: "rgba(0,122,85,1)",
  sidebar: "rgba(250,250,250,1)", sidebarForeground: "rgba(39,39,42,1)",
  sidebarMuted: "rgba(113,113,123,1)", sidebarBorder: "rgba(228,228,231,1)",
  rowHover: "rgba(252,252,252,1)", rowSelected: "rgba(255,255,255,1)",
  codeCommand: "rgba(27,78,216,1)", codeFlag: "rgba(127,34,254,1)", codeString: "rgba(0,122,85,1)",
  codePlaceholder: "rgba(187,77,0,1)", codePunct: "rgba(113,113,123,1)",
  // panel-glass: popover at 80% + 10% foreground border + soft drop shadow
  glass: "rgba(255,255,255,0.8)", glassBorder: "rgba(39,39,42,0.1)",
  headerGlass: "rgba(252,252,252,0.8)",
  sky: "#379ed9",
  dark: false,
};
export const DARK: typeof LIGHT = {
  background: "rgba(10,10,10,1)", foreground: "rgba(245,245,245,1)",
  card: "rgba(17,17,17,1)", popover: "rgba(17,17,17,1)",
  primary: "rgba(52,107,241,1)", primaryForeground: "#ffffff",
  muted: "rgba(255,255,255,0.031)", mutedForeground: "rgba(161,161,161,1)",
  accent: "rgba(255,255,255,0.039)", border: "rgba(255,255,255,0.059)", input: "rgba(255,255,255,0.102)",
  success: "rgba(0,188,125,1)", successForeground: "rgba(0,212,146,1)",
  sidebar: "rgba(17,17,17,1)", sidebarForeground: "rgba(245,245,245,1)",
  sidebarMuted: "rgba(161,161,161,1)", sidebarBorder: "rgba(255,255,255,0.059)",
  rowHover: "rgba(255,255,255,0.031)", rowSelected: "rgba(255,255,255,0.059)",
  codeCommand: "rgba(142,197,255,1)", codeFlag: "rgba(196,180,255,1)", codeString: "rgba(94,233,181,1)",
  codePlaceholder: "rgba(255,210,48,1)", codePunct: "rgba(161,161,161,1)",
  glass: "rgba(17,17,17,0.8)", glassBorder: "rgba(255,255,255,0.08)",
  headerGlass: "rgba(10,10,10,0.8)",
  sky: "#182650",
  dark: true,
};
export type Theme = typeof LIGHT;

export const FONT = "SF Pro Display";
export const MONO = "JetBrainsMono Nerd Font Mono";
