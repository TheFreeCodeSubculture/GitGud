import type { ReactNode } from "react";
import type { PreviewHot } from "@webprodigies/flute/preview";

export function FluteProjectPreview(props: {
  children?: ReactNode;
  enabled: boolean;
  active?: boolean;
  hot?: PreviewHot;
}): ReactNode;
