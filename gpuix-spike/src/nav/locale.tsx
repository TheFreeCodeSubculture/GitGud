// Port of src/components/LocaleMenu.tsx. The Select parts give the popup, focus,
// Escape and arrow-key handling; the look is the original's panel-glass menu.
import { Select, SelectContent, SelectItem, SelectTrigger } from "@gpuix/react";
import { LOCALES } from "../../../src/lib/content";
import { strings } from "../../../src/strings";
import { Icon } from "../ui";
import { withAlpha } from "../ui";
import type { Theme } from "../theme";

export function LocaleMenu({ t, locale, locales, onChange }: { t: Theme; locale: string; locales: string[]; onChange: (l: string) => void }) {
  return (
    <Select value={locale} onValueChange={onChange} items={locales.map((value) => ({ value, label: LOCALES[value] ?? value }))}>
      <SelectTrigger style={({ open }) => ({
        display: "flex", flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingLeft: 10, paddingRight: 10, borderRadius: 8,
        borderWidth: 1, borderColor: t.input, fontSize: 14, color: t.foreground, cursor: "pointer", whiteSpace: "nowrap",
        backgroundColor: open ? (t.dark ? "rgba(255,255,255,0.05)" : "rgba(244,244,245,0.5)") : t.dark ? "rgba(255,255,255,0.032)" : t.popover,
        boxShadow: { offsetX: 0, offsetY: 1, blurRadius: 2, spreadRadius: 0, color: "rgba(0,0,0,0.05)" },
        hover: { backgroundColor: t.dark ? "rgba(255,255,255,0.05)" : "rgba(244,244,245,0.5)" },
      })}>
        <Icon name="globe" size={14} color={t.mutedForeground} />
        <div style={{ whiteSpace: "nowrap" }}>{LOCALES[locale] ?? locale}</div>
      </SelectTrigger>
      <SelectContent side="bottom" align="end" sideOffset={6} style={{
        minWidth: 176, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: t.glassBorder, backgroundColor: withAlpha(t.glass, 1.18),
        boxShadow: { offsetX: 0, offsetY: 12, blurRadius: 32, spreadRadius: -8, color: "rgba(0,0,0,0.25)" },
      }}>
        <div style={{ height: 28, display: "flex", flexDirection: "row", alignItems: "center", paddingLeft: 8, paddingRight: 8, fontSize: 12, fontWeight: 500, color: t.mutedForeground, whiteSpace: "nowrap" }}>{strings(locale).langLabel}</div>
        <div style={{ height: 1, marginLeft: -4, marginRight: -4, marginTop: 4, marginBottom: 4, backgroundColor: t.border }} />
        {locales.map((code) => (
          <SelectItem key={code} value={code} style={({ highlighted }) => ({
            display: "flex", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 6, paddingLeft: 8, paddingRight: 8, height: 32,
            fontSize: 14, cursor: "pointer", color: highlighted || code === locale ? t.foreground : t.mutedForeground,
            backgroundColor: highlighted ? t.accent : undefined,
          })}>
            <div style={{ whiteSpace: "nowrap" }}>{LOCALES[code] ?? code}</div>
            <div style={{ flexGrow: 1 }} />
            {code === locale && <Icon name="check" size={14} color={t.primary} />}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
