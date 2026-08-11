---
name: figma-pixel-parity
description: Match one rendered React component to one exact Figma node through a measured Playwright screenshot loop. Use when implementing or correcting Figma-to-React component parity with deterministic screenshot evidence.
---

# Figma Pixel Parity

Drive one component state to measured parity with one exact Figma node. Treat Figma metadata as the specification and the PNG comparison as evidence.

## Inputs

Require:

- exact Figma file and node URL,
- React component or Storybook story,
- state, theme, viewport, and acceptance threshold.

Default Pixelmatch to `threshold: 0.1`. Start `maxDiffPixelRatio` at `0.005`; when exact fonts, geometry, and tokens match but Figma-to-Chromium glyph rasterization alone exceeds it, calibrate the ratio from that measured residual and record the reason. Never raise it to hide a non-text mismatch.

## Loop

### 1. Trace the component

Read the component, story, styles, tokens, assets, and every wrapper affecting its rendered bounds. Reuse the repository's package manager, Playwright setup, screenshot conventions, and design tokens.

Completion: the render command, exact locator, state, theme, viewport, and relevant implementation files are known.

### 2. Capture the Figma source of truth

Load `$figma-use` before every `use_figma` call. Use Figma MCP to inspect the exact node, then save:

- a node-only PNG at scale `1`,
- node width and height,
- visible text and layer order,
- fills, typography, spacing, borders, radii, shadows, opacity, icons, and variant/state properties.

Store evidence under `.agents/artifacts/figma-pixel-parity/<node-id>/`. Never substitute a Figma canvas screenshot for the node export.

Download MCP assets immediately because their URLs expire. Preserve or detect each asset's actual content type instead of trusting a filename extension.

Completion: `figma.png` and `figma.json` identify the node and all visible properties needed to reproduce it.

### 3. Install the smallest test surface

Use the existing Playwright installation. If absent, add only `@playwright/test` with the repository's package manager because this workflow explicitly requires Playwright. Prefer the repository's existing image comparator; otherwise add `pixelmatch` and `pngjs` as dev dependencies.

Read [PLAYWRIGHT.md](references/PLAYWRIGHT.md) and adapt its single-test pattern. Keep parity tooling outside shipped component code.

Completion: one command captures the component element and writes `actual.png`, `diff.png`, `anaglyph.png`, `blink.gif`, and `metrics.json` without updating the Figma baseline.

### 4. Normalize the render

Pin Chromium, viewport, `deviceScaleFactor: 1`, color scheme, locale, timezone, reduced motion, data, and component state. Wait for `document.fonts.ready` and loaded images. Assert each required font with `document.fonts.check`; a resolved promise does not prove the intended font loaded. Disable animations and caret rendering. Capture the component locator with a transparent page and `omitBackground: true`, not the page.

Compare representative corner, background, and content RGBA pixels before styling. Fix alpha compositing or font URL resolution first; otherwise the score diagnoses the capture harness rather than the component.

Require identical image dimensions. Correct bounds or scale at the source; never stretch one PNG to fit the other.

Completion: two consecutive captures are identical and their dimensions equal `figma.png`.

### 5. Go red

Run the comparison before editing. It must fail when a visible mismatch exists. Record:

- mismatched pixels,
- compared pixels,
- mismatch ratio,
- `score = 100 * (1 - mismatchRatio)`,
- configured color threshold,
- diff image,
- anaglyph overlay.

The Pixelmatch `diff.png` is the metric source; the anaglyph is the visual evidence humans read. Build it per pixel from the flattened pair: grayscale luminance of `figma.png` into the red channel, grayscale luminance of `actual.png` into green and blue. Matched ink renders neutral gray/black; cyan is Figma-only ink, red is render-only ink, and red/cyan fringing shows the direction of a positional shift. Present the anaglyph (not the raw red Pixelmatch image) wherever the diff is showcased — PR bodies, reports, review evidence.

Also write `blink.gif`: the flattened `figma.png` and `actual.png` as a two-frame looping GIF at ~1 fps (e.g. `ffmpeg -framerate 1.25 -i f%d.png -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=none" -loop 0 blink.gif`). Differences flicker, matches hold still; GitHub renders GIFs, so pair it with the anaglyph in PR evidence.

Also record mismatch counts and bounding boxes for visible regions such as icon, text groups, controls, and background. A passing global ratio cannot override a concentrated non-text hotspot.

The score is reporting, not proof by itself.

Completion: the initial mismatch is reproduced by a failing command and visible in `anaglyph.png`.

### 6. Fix the largest real delta

Inspect Figma metadata, `figma.png`, `actual.png`, and `anaglyph.png` together (fall back to `diff.png` for faint deltas the anaglyph underplays). Classify the largest hotspot as geometry, typography, color, border, shadow, asset, state, or rasterization; in the anaglyph, solid one-color regions mean presence/absence while fringing means offset. Change the smallest shared implementation point that fixes the real mismatch, then recapture.

Repeat one hotspot at a time. Preserve accessibility, behavior, supported variants, and consumer overrides. Put capture-only state in the story/test rather than production code.

Completion: no known non-raster mismatch remains and the pixel gate passes.

### 7. Verify parity

Pass only when all gates agree:

1. exact image dimensions,
2. Figma values equal resolved CSS values for every visible token,
3. required text, assets, state, and theme match,
4. mismatch ratio is within the declared threshold,
5. every non-text region has zero unexplained mismatches and no concentrated hotspot is concealed by the global ratio,
6. a final side-by-side and diff inspection finds no concealed local defect,
7. the repository's targeted tests, typecheck, and lint pass.

Do not call the percentage “pixel accuracy.” Report it as a thresholded Pixelmatch score and list any anti-aliasing residual separately.

## Output

Return the component/story changed, Figma node, command, score, mismatch count and ratio, threshold, evidence directory, checks run, and remaining deltas. Showcase `anaglyph.png` (with the red/cyan legend stated wherever it is embedded) plus `blink.gif`; never the raw red Pixelmatch image.
