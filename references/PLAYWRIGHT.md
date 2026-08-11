# Playwright comparison pattern

Adapt this pattern to the repository rather than creating a second app or test stack.

## Capture

Use a stable Storybook iframe or dedicated component route:

```ts
const component = page.locator('[data-figma-parity="component"]');

await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
await page.goto(storyUrl);
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images]
      .filter((image) => !image.complete)
      .map((image) => new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      })),
  );
});

for (const font of ['500 16px Inter', '500 18px "JetBrains Mono"']) {
  if (!await page.evaluate((value) => document.fonts.check(value), font)) {
    throw new Error(`Required font did not load: ${font}`);
  }
}

await component.screenshot({
  path: `${evidenceDir}/actual.png`,
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
  omitBackground: true,
});
```

Use Chromium with a fixed viewport and `deviceScaleFactor: 1`. Capture twice and byte-compare the PNGs before trusting the diff.

## Compare

Decode `figma.png` and `actual.png` with `pngjs`. Fail immediately when dimensions differ. Run Pixelmatch with the declared options:

```ts
const mismatchedPixels = pixelmatch(
  expected.data,
  actual.data,
  diff.data,
  expected.width,
  expected.height,
  { threshold: 0.1, includeAA: false },
);

const comparedPixels = expected.width * expected.height;
const mismatchRatio = mismatchedPixels / comparedPixels;
const score = 100 * (1 - mismatchRatio);
```

Write the diff PNG and metrics JSON before asserting:

```ts
expect(mismatchRatio, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(maxDiffPixelRatio);
```

Start `maxDiffPixelRatio` at `0.005`. Calibrate it upward only after the diff proves every remaining hotspot is glyph rasterization and the geometry/token gate passes; record the calibrated value and residual classification in `metrics.json`.

Before calibration, count mismatches per meaningful region and save each region's mismatch bounding box. Require zero unexplained mismatch in non-text regions. This prevents a small missing icon or border from disappearing inside a large global denominator.

Keep `figma.png` immutable during the loop. Do not use Playwright's snapshot-update command for this test because it can replace the external source of truth.

## Geometry and token gate

Pixels can dilute local errors. Save `component.boundingBox()` plus selected `getComputedStyle` values and compare them with `figma.json`. Treat dimension, spacing, typography, radius, border, shadow, and color mismatches as failures even when the global pixel ratio passes.
