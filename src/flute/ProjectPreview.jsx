"use client";
import React from "react";
import { ProjectPreview } from "@webprodigies/flute/preview";
import { sceneModules } from "./catalog";
// Host-owned development flag: no process, Vite or Electron globals in this adapter.
export function FluteProjectPreview({ children, enabled, active, ...props }) {
  if (!enabled) return children;
  return <ProjectPreview {...props} projectId="40b8f392-c774-474a-aa77-b30fbbf0dcaa" enabled={enabled} active={active} sceneModules={sceneModules}>{children}</ProjectPreview>;
}
