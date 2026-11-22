// Builds the painted area icons in public/icons/ from the masters in art-src/icons/.
// Each master has a solid dark background: it is keyed out by colour distance from
// the border's median colour, cropped to a padded square, then written at 512 and
// 128 px as WebP and AVIF. Run with `bun scripts/icons.ts` after changing a master.
import { readdir, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'art-src/icons';
const OUT = 'public/icons';
const SIZES = [512, 128];
// Pixels closer than SOLID to the background colour are faded out over a FEATHER-wide band.
const SOLID = 28;
const FEATHER = 18;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function cutOut(path: string): Promise<Buffer> {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x: number, y: number) => (y * w + x) * 3;

  const border: number[][] = [[], [], []];
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) for (let c = 0; c < 3; c++) border[c].push(data[at(x, y) + c]);
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) for (let c = 0; c < 3; c++) border[c].push(data[at(x, y) + c]);
  const bg = border.map(median);

  const rgba = Buffer.alloc(w * h * 4);
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
      const alpha =
        d < SOLID ? Math.min(1, Math.max(0, (d - (SOLID - FEATHER)) / FEATHER)) * 255 : 255;
      const o = (y * w + x) * 4;
      rgba[o] = data[i];
      rgba[o + 1] = data[i + 1];
      rgba[o + 2] = data[i + 2];
      rgba[o + 3] = Math.round(alpha);
      if (alpha > 0)
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }

  const [cw, ch] = [x1 - x0 + 1, y1 - y0 + 1];
  const side = Math.round(Math.max(cw, ch) * 1.04);
  const crop = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .png()
    .toBuffer();
  return sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: crop, left: Math.floor((side - cw) / 2), top: Math.floor((side - ch) / 2) },
    ])
    .png()
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
for (const file of (await readdir(SRC)).filter((f) => f.endsWith('.webp')).sort()) {
  const area = file.replace(/\.webp$/, '');
  const square = await cutOut(`${SRC}/${file}`);
  for (const size of SIZES) {
    const resized = sharp(square).resize(size, size, { kernel: 'lanczos3' });
    await resized
      .clone()
      .webp({ quality: 88, alphaQuality: 100, effort: 6 })
      .toFile(`${OUT}/${area}-${size}.webp`);
    await resized.clone().avif({ quality: 60, effort: 6 }).toFile(`${OUT}/${area}-${size}.avif`);
  }
  console.log(area);
}
