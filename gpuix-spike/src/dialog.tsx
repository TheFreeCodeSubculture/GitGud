// Port of components/ConfirmDialogHost.tsx. Mount once, anywhere under the root:
// `<ConfirmDialogHost t={t} />`, so lib/confirmDialog's requestConfirmDialog has a surface.
import { useSyncExternalStore } from "react";
import { Dialog, DialogBackdrop, DialogPopup, DialogPortal, DialogDescription, DialogTitle } from "@gpuix/react";
import { readConfirmDialogState, readIdleConfirmDialogState, respondToConfirmDialog, subscribeConfirmDialog } from "../../src/lib/confirmDialog";
import { Btn } from "./challenge/atoms";
import { FONT, type Theme } from "./theme";

export function ConfirmDialogHost({ t }: { t: Theme }) {
  const state = useSyncExternalStore(subscribeConfirmDialog, readConfirmDialogState, readIdleConfirmDialogState);
  const confirming = state.status === "confirming";
  const destructive = confirming && state.variant === "destructive";
  return (
    <Dialog open={confirming} onOpenChange={(open) => { if (!open) respondToConfirmDialog(false); }}>
      <DialogPortal>
        <DialogBackdrop style={{ backgroundColor: t.dark ? "rgba(10,10,10,0.64)" : "rgba(252,252,252,0.6)" }} />
        {confirming && (
          <DialogPopup style={{ width: 512, maxWidth: "100%", borderRadius: 18, borderWidth: 1, backgroundColor: t.background, fontFamily: FONT, color: t.foreground, overflow: "hidden",
            borderColor: t.dark ? "rgba(255,255,255,0.08)" : "rgba(39,39,42,0.1)",
            boxShadow: t.dark ? [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadRadius: 0, color: "rgba(255,255,255,0.04)", inset: true }, { offsetX: 0, offsetY: 24, blurRadius: 72, spreadRadius: -20, color: "rgba(0,0,0,0.9)" }]
              : { offsetX: 0, offsetY: 24, blurRadius: 64, spreadRadius: -24, color: "rgba(0,0,0,0.65)" } }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 24, paddingBottom: 16 }}>
              <DialogTitle style={{ fontSize: 18, lineHeight: 18, fontWeight: 600 }}>{state.title}</DialogTitle>
              {state.description && (
                <DialogDescription style={{ display: "flex", flexDirection: "column", fontSize: 14, lineHeight: 20, color: t.mutedForeground }}>
                  {state.description.split("\n").map((l, i) => <div key={i}>{l || " "}</div>)}
                </DialogDescription>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, borderColor: t.border, borderBottomLeftRadius: 17, borderBottomRightRadius: 17,
              backgroundColor: t.dark ? "rgba(255,255,255,0.022)" : "rgba(250,250,250,0.72)" }}>
              <Btn t={t} variant="outline" onClick={() => respondToConfirmDialog(false)}>Cancel</Btn>
              <Btn t={t} onClick={() => respondToConfirmDialog(true)}
                style={destructive ? { backgroundColor: t.dark ? "rgba(251,65,74,1)" : "rgba(251,44,54,1)", borderColor: t.dark ? "rgba(251,65,74,1)" : "rgba(251,44,54,1)" } : undefined}>Confirm</Btn>
            </div>
          </DialogPopup>
        )}
      </DialogPortal>
    </Dialog>
  );
}
