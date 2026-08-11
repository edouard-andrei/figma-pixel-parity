// Minimal parity loop. Here both PNGs come from one page for a self-contained demo;
// in real use figma.png is the Figma node export and only actual.png is captured.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const out = new URL('evidence/', import.meta.url).pathname;
const page$ = new URL('form.html', import.meta.url).href;
const maxDiffPixelRatio = 0.005;

mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

for (const [variant, file] of [['design', 'figma.png'], ['render', 'actual.png']]) {
  await page.goto(`${page$}?variant=${variant}`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-figma-parity="component"]').screenshot({
    path: `${out}${file}`, animations: 'disabled', caret: 'hide', scale: 'css', omitBackground: true,
  });
}
await browser.close();

const read = (file) => PNG.sync.read(readFileSync(`${out}${file}`));
const expected = read('figma.png');
const actual = read('actual.png');

if (expected.width !== actual.width || expected.height !== actual.height) {
  throw new Error(`Size mismatch: ${expected.width}x${expected.height} vs ${actual.width}x${actual.height}`);
}

const diff = new PNG({ width: expected.width, height: expected.height });
const mismatchedPixels = pixelmatch(
  expected.data, actual.data, diff.data, expected.width, expected.height,
  { threshold: 0.1, includeAA: false },
);
writeFileSync(`${out}diff.png`, PNG.sync.write(diff));

// Anaglyph: Figma ink in red, render ink in cyan. Gray = match, fringing = offset.
const flat = (png) => {
  const rgb = new Uint8Array(png.width * png.height * 3);
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) rgb[(i / 4) * 3 + c] = png.data[i + c] * a + 255 * (1 - a);
  }
  return rgb;
};
const luma = (rgb, i) => 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
const [e, a] = [flat(expected), flat(actual)];
const anaglyph = new PNG({ width: expected.width, height: expected.height });
for (let p = 0; p < expected.width * expected.height; p++) {
  anaglyph.data[p * 4] = luma(e, p * 3);
  anaglyph.data[p * 4 + 1] = anaglyph.data[p * 4 + 2] = luma(a, p * 3);
  anaglyph.data[p * 4 + 3] = 255;
}
writeFileSync(`${out}anaglyph.png`, PNG.sync.write(anaglyph));

// Blink GIF: flatten both onto white so GitHub shows them on any theme.
const opaque = (rgb, png, file) => {
  const flatPng = new PNG({ width: png.width, height: png.height });
  for (let p = 0; p < png.width * png.height; p++) {
    for (let c = 0; c < 3; c++) flatPng.data[p * 4 + c] = rgb[p * 3 + c];
    flatPng.data[p * 4 + 3] = 255;
  }
  writeFileSync(`${out}${file}`, PNG.sync.write(flatPng));
};
opaque(e, expected, 'f1.png');
opaque(a, actual, 'f2.png');
execFileSync('ffmpeg', ['-y', '-framerate', '1.25', '-i', `${out}f%d.png`,
  '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=none',
  '-loop', '0', `${out}blink.gif`], { stdio: 'ignore' });

const comparedPixels = expected.width * expected.height;
const mismatchRatio = mismatchedPixels / comparedPixels;
const metrics = {
  size: `${expected.width}x${expected.height}`,
  mismatchedPixels, comparedPixels,
  mismatchRatio: +mismatchRatio.toFixed(5),
  score: +(100 * (1 - mismatchRatio)).toFixed(3),
  threshold: 0.1, maxDiffPixelRatio,
  pass: mismatchRatio <= maxDiffPixelRatio,
};
writeFileSync(`${out}metrics.json`, JSON.stringify(metrics, null, 2));
console.log(metrics);
if (!metrics.pass) process.exitCode = 1;
