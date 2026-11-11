// Build-time image prep for the GPUIX build, using the repo's own `sharp`.
//  - GPUI samples images bilinearly (no `image-rendering: pixelated`), so pixel
//    art is pre-upscaled with nearest-neighbour: downscaling a sharp big image
//    stays crisp, upscaling a small one would smear.
//  - GPUI has no backdrop-filter, so the home landscape is pre-blurred (+sat)
//    to the same radius as `--glass-blur`; glass panels draw slices of it.
const sharp = require("../../node_modules/sharp");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const PUB = join(__dirname, "../../public");
const OUT = join(__dirname, "../assets/baked");
mkdirSync(OUT, { recursive: true });

const PANE = 944; // typical main-pane width at the default 1200px window
const themes = {
  light: { file: "home-bg-light.webp", sky: "#379ed9", blur: 12, sat: 1.14 },
  dark: { file: "home-bg-dark.webp", sky: "#182650", blur: 16, sat: 1.08 },
};

(async () => {
  for (const [name, t] of Object.entries(themes)) {
    const src = sharp(join(PUB, "brand", t.file));
    const { width, height } = await src.metadata();
    await sharp(join(PUB, "brand", t.file)).resize(width * 3, height * 3, { kernel: "nearest" })
      .png().toFile(join(OUT, `home-bg-${name}.png`));
    // Blur in image pixels = CSS px * (image px per CSS px). Pad the top with sky
    // so the blur near the horizon of the band above the art matches the browser.
    const sigma = t.blur * (width / PANE);
    const pad = Math.ceil(sigma * 3);
    // sharp applies extract before extend in one pipeline, so pad first.
    const padded = await sharp(join(PUB, "brand", t.file))
      .extend({ top: pad, background: t.sky }).flatten({ background: t.sky }).png().toBuffer();
    const blurred = await sharp(padded).blur(sigma).modulate({ saturation: t.sat }).png().toBuffer();
    const { data, info } = await sharp(blurred).extract({ left: 0, top: pad, width, height })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    writeFileSync(join(OUT, `home-bg-${name}.blur.rgba`), data);
    writeFileSync(join(OUT, `home-bg-${name}.blur.json`), JSON.stringify({ width: info.width, height: info.height }));
  }
  const art = await sharp(join(PUB, "brand/header-art.png")).metadata();
  await sharp(join(PUB, "brand/header-art.png")).resize(art.width * 3, art.height * 3, { kernel: "nearest" }).png().toFile(join(OUT, "header-art.png"));
  for (const f of ["mario", "coin"]) await sharp(join(PUB, `brand/${f}.svg`), { density: 288 }).png().toFile(join(OUT, `${f}.png`));
  console.log("baked", OUT);
})();
