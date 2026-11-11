# Patched `@gpuix/native`

The spike runs on npm `@gpuix/react` 0.11.0 + `@gpuix/native` 0.11.0. Four things the WebView build does have no
equivalent in that release, so the native addon is rebuilt with a small patch set. The JS packages stay stock.

| Feature | Where |
|---|---|
| Custom title bar: `decorations: "client"`, `windowDragArea`, resize borders, `startWindowMove/Resize`, `isMaximized`, `closeWindow` | gpuix + gpui window code (already in GPUI) |
| CSS `letter-spacing` as the `letterSpacing` style key (px) | gpui fork (port of [zed#53475](https://github.com/zed-industries/zed/pull/53475)) |
| `<markdown>` link colour: theme `linkColor` | gpuix |
| `<markdown>` inline code size: theme `metrics.mdInlineCodeScale` (CSS `.875em` is `0.875`) | gpui fork + gpuix |

Everything is opt-in. With the stock addon (no file in `vendor/gpuix-native/`) the app still runs: unknown style keys,
theme keys and `init` options are ignored, `WindowControls` stays hidden because `hasClientDecorations` does not exist,
so the OS keeps the title bar.

## Loading

`bunfig.toml` preloads `vendor/preload.ts`, and `src/boot.ts` imports it too. It sets `NAPI_RS_NATIVE_LIBRARY_PATH` to
`vendor/gpuix-native/gpuix.<platform>.node` when that file exists (`linux-x64-gnu`, `linux-arm64-gnu`, `win32-x64-msvc`).
`@gpuix/native` reads that variable the first time it is imported, so it must be set before that. A compiled binary
(`bun build --compile`) does not run the preload: set the variable in the launcher. `bun run native:check` prints
which addon will load.

`boot.ts` also adds `windowDragArea` / `windowNoDrag` to `UNIVERSAL_PROPS` from `@gpuix/native/host`; the stock
reconciler otherwise drops unknown props on `<div>`.

## What was patched

Two repos, patches in this folder (`git format-patch`, apply with `git am`):

| Repo | Base | Branch | Patches |
|---|---|---|---|
| `remorses/gpuix` | `0ce4f41` (= 0.11.0, single-commit clone) | `gg/linux-csd` | `gpuix-0001-*`, `gpuix-0002-*` |
| `remorses/zed` (GPUI fork, branch `gpuix`) | `f77e5cf` (pinned by gpuix 0.11.0) | `gg/linux-csd` | `zed-0001-*`, `zed-0002-*` |

* `zed-0001` letter spacing: `TextStyle.letter_spacing` (+ `Styled::letter_spacing`), `TextRun`/`FontRun.letter_spacing`,
  Linux (cosmic-text `Attrs::letter_spacing`, which is em, so the px value is divided by the span's size), Windows
  (`IDWriteTextLayout1::SetCharacterSpacing`) and macOS (`kCTKernAttributeName`). It is spacing in the shaped glyph
  advances, so measuring, wrapping, painting and hit-testing all agree. `text_transform` from the upstream PR is left out.
* `zed-0002` per-run font size: `TextRun`/`FontRun`/`ShapedRun.font_size`. A run can be drawn smaller than its line
  (inline code). Implemented for Linux/cosmic-text and Windows/DirectWrite (`SetFontSize` per range); macOS accepts and ignores it.
* `gpuix-0001` window: `WindowOptions.decorations = "client"` (`WindowDecorations::Client`), napi
  `startWindowMove()`, `startWindowResize(edge)`, `isMaximized()`, `hasClientDecorations()`, `closeWindow()`, the
  `windowDragArea` / `windowNoDrag` props, and resize borders (5 px, cursor + capture-phase press, as Zed's
  `client_side_decorations`) added to the root only while the window really is client-decorated. `letterSpacing` style key.
* `gpuix-0002` `<markdown>`: theme `linkColor` (text and underline), `metrics.mdInlineCodeScale`.

`windowDragArea` starts the move on the first drag motion after the press and maximises on a double click. Starting it
on the press itself would let the compositor take the pointer and swallow the second click. Wayland keeps the press
serial, so a move started a moment later is accepted. `windowNoDrag` claims the press for a child (the window buttons,
header buttons), like CSS `-webkit-app-region: no-drag`.

X11 without a compositing manager cannot do client decorations: GPUI falls back to the native frame and
`hasClientDecorations()` is false, so no duplicate buttons are drawn.

## Rebuild (Linux, Fedora 44 in WSL)

```sh
dnf install -y git clang cmake make perl-core pkgconf-pkg-config libxkbcommon-devel libxkbcommon-x11-devel \
  wayland-devel libxcb-devel libX11-devel vulkan-loader-devel fontconfig-devel freetype-devel openssl-devel \
  alsa-lib-devel mesa-libEGL-devel libdrm-devel mesa-libgbm-devel libzstd-devel xcb-util-devel libglvnd-devel
# rustup with the toolchain from gpuix/rust-toolchain.toml (1.97.1); build on the Linux filesystem, not /mnt/d.
git clone https://github.com/remorses/gpuix && cd gpuix && git checkout 0ce4f41 && git switch -c gg/linux-csd
rmdir zed && git clone --filter=blob:none https://github.com/remorses/zed zed && git -C zed checkout -b gg/linux-csd f77e5cf
V=<repo>/gpuix-spike/vendor/gpuix-native
git -C zed am $V/zed-000*.patch
git am $V/gpuix-000*.patch
cd packages/native
CARGO_PROFILE_RELEASE_LTO=off cargo build --release -j12   # drop the LTO override for the final build
cp target/release/libgpuix_native.so $V/gpuix.linux-x64-gnu.node
```

Windows is the same with MSVC (`cargo build --release`, then copy
`gpuix_native.dll` to `gpuix.win32-x64-msvc.node`). The `zed` submodule must be a full checkout (not sparse): the
workspace needs `gpui_windows`, `gpui_wgpu`, `reqwest_client` and the rest. 16 cores / 11 GB RAM is enough for
`-j12`; a cold build is about 15 minutes, an incremental one 10-20 s without LTO.

The `.node` files are git-ignored (60 MB each). The patches are the source of truth.

## Limits

* Letter spacing is not applied by `<input>`/`<textarea>` text (they shape through a path that takes no spacing) and the
  `textOverflow` truncation estimate ignores it. Both are rare in this app. Spacing is in px; `em` is not accepted
  (multiply by the font size in JS).
* Inline code size: macOS keeps the body size (untouched, no build there).
* The builds use the default cargo features (`test-support`, like the published addon) so `captureScreenshot` works on Windows.
* `captureScreenshot` does not work on Linux, so Linux checks are layout measurements and event logs; the pixels
  were checked on the Windows build.
