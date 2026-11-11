// Lucide icons the challenge page draws (same geometry the web build uses).
import { __iconData as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { __iconData as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.mjs";
import { __iconData as check } from "lucide-react/dist/esm/icons/check.mjs";
import { __iconData as circle } from "lucide-react/dist/esm/icons/circle.mjs";
import { __iconData as folderOpen } from "lucide-react/dist/esm/icons/folder-open.mjs";
import { __iconData as gitBranch } from "lucide-react/dist/esm/icons/git-branch.mjs";
import { __iconData as history } from "lucide-react/dist/esm/icons/rotate-ccw-clock.mjs";
import { __iconData as lightbulb } from "lucide-react/dist/esm/icons/lightbulb.mjs";
import { __iconData as loader } from "lucide-react/dist/esm/icons/loader-circle.mjs";
import { __iconData as rotateCcw } from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import { __iconData as sparkles } from "lucide-react/dist/esm/icons/sparkles.mjs";
import { __iconData as squareTerminal } from "lucide-react/dist/esm/icons/square-terminal.mjs";
import { __iconData as x } from "lucide-react/dist/esm/icons/x.mjs";
import { readFileSync } from "node:fs";
import { registerIcon } from "../ui";

const ours = { "arrow-left": arrowLeft, "arrow-right": arrowRight, circle, "folder-open": folderOpen, "git-branch": gitBranch, history, lightbulb, loader, "rotate-ccw": rotateCcw, sparkles, "square-terminal": squareTerminal };
for (const [n, d] of Object.entries(ours)) registerIcon(n, d);
registerIcon("check", check);
registerIcon("check", check, 3); // Predict's badge
registerIcon("x", x);
registerIcon("x", x, 3);

/** A lucide icon's geometry; some names are aliases that re-export another file. */
function iconData(name: string): { node: any } {
  const file = `lucide-react/dist/esm/icons/${name}.mjs`;
  const m = require(file);
  if (m.__iconData) return m.__iconData;
  return iconData(readFileSync(require.resolve(file), "utf8").match(/from '\.\/(.+)\.mjs'/)![1]);
}

/** Register a `LucideIcon` component's geometry (cards.ts hands us components) and return its name. */
export function lucide(component: { displayName?: string }, strokeWidth = 2): string {
  const name = (component.displayName ?? "").replace(/([a-z])([A-Z0-9])/g, "$1-$2").replace(/([0-9])([A-Z])/g, "$1-$2").toLowerCase();
  registerIcon(name, iconData(name), strokeWidth);
  return name;
}
