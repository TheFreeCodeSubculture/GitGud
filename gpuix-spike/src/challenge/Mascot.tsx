// Port of components/Mascot.tsx: the guide character, clickable to re-roll.
import { join } from "node:path";
import { Tooltip, TooltipContent, TooltipTrigger } from "@gpuix/react";
import manifest from "../../../src/mascots.json";
import { PUBLIC } from "../boot";
import { FONT, type Theme } from "../theme";
import { Runs } from "./rich";

export interface MascotMeta { id: string; title: string; creator: string; license: string; licenseUrl: string; source: string }
export const MASCOTS = manifest as MascotMeta[];

/** Picked by position, not by hashing: distinct guides per challenge, the same face on a revisit. */
export function mascotAt(index: number, offset = 0): MascotMeta | undefined {
  return MASCOTS[(index + offset) % MASCOTS.length];
}

export const mascotSrc = (id: string) => join(PUBLIC, "mascots", `${id}.svg`);

export function Mascot({ t, index, offset = 0, onCycle }: { t: Theme; index: number; offset?: number; onCycle?: () => void }) {
  const mascot = mascotAt(index, offset);
  if (!mascot) return null;
  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <div onClick={onCycle} style={{ flexShrink: 0, cursor: "pointer", padding: 2, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, hover: { borderColor: t.primary } }}>
          <img src={mascotSrc(mascot.id)} style={{ width: 48, height: 48, borderRadius: 24 }} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} style={{ backgroundColor: t.popover, borderWidth: 1, borderColor: t.border, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontFamily: FONT, fontSize: 12, lineHeight: 16, color: t.foreground, whiteSpace: "nowrap" }}>
        {`${mascot.title} by ${mascot.creator} — click for a different one`}
      </TooltipContent>
    </Tooltip>
  );
}

/** Attribution for every style shipped in the pool, built from the manifest. */
export function MascotCredits({ t }: { t: Theme }) {
  const byLicense = new Map<string, MascotMeta[]>();
  for (const m of MASCOTS) byLicense.set(m.license, [...(byLicense.get(m.license) ?? []), m]);
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {[...byLicense.entries()].map(([license, items]) => (
        <Runs key={license} color={t.mutedForeground}
          runs={[{ text: license, weight: 500, color: t.foreground }, { text: "—" }, { text: `${[...new Set(items.map((i) => `${i.title} by ${i.creator}`))].join("; ")}.` }]} />
      ))}
    </div>
  );
}
