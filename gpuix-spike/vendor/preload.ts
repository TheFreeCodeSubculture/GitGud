// Point @gpuix/native at the patched build in vendor/gpuix-native/ when one exists
// for this platform (see NATIVE.md). NAPI_RS_NATIVE_LIBRARY_PATH is read when
// @gpuix/native is first imported, so this must run first: bunfig.toml preloads it,
// and boot.ts imports it as a second line of defence. No vendor file = stock prebuilt.
import { existsSync } from "node:fs";
import { join } from "node:path";

const target: Record<string, string> = {
  "linux-x64": "linux-x64-gnu",
  "linux-arm64": "linux-arm64-gnu",
  "win32-x64": "win32-x64-msvc",
};
const t = target[`${process.platform}-${process.arch}`];
const file = t && join(import.meta.dir, "gpuix-native", `gpuix.${t}.node`);
if (file && !process.env.NAPI_RS_NATIVE_LIBRARY_PATH && existsSync(file)) {
  process.env.NAPI_RS_NATIVE_LIBRARY_PATH = file;
}
