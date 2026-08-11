# figma-pixel-parity

An agent skill. It makes one React component match one Figma node, and it proves the match with screenshots.

## Install

```bash
npx skills add edouard-andrei/figma-pixel-parity
```

Add `-g` to install for all projects, or `-a claude-code` to pick one agent. More options: [skills.sh](https://skills.sh).

## Use

Give the agent a Figma node URL and the component:

```
Use figma-pixel-parity to match Button.tsx to <figma-node-url>.
```

The agent then:

1. Reads the component, its story, and its tokens.
2. Exports the Figma node to a PNG. This PNG is the truth.
3. Captures the component with Playwright. Fonts, viewport, and scale are fixed.
4. Compares the two PNGs with Pixelmatch.
5. Corrects the largest difference. Then it repeats from step 3.

It stops when the mismatch is inside the threshold and no region hides a defect.

## Output

Each run writes evidence to `.agents/artifacts/figma-pixel-parity/<node-id>/`:

| File | Content |
| --- | --- |
| `figma.png` | The Figma node. Never changed. |
| `actual.png` | The component render. |
| `diff.png` | The Pixelmatch result. It gives the score. |
| `anaglyph.png` | An overlay for humans. |
| `blink.gif` | Two frames at 1 fps. Differences flicker. |
| `metrics.json` | Pixel counts, ratio, score, threshold. |

## Example

A sign-up form with two defects: the submit button is too narrow, and it has the wrong icon.

| Figma | Render |
| --- | --- |
| ![Figma node](https://github.com/user-attachments/assets/7621cf87-7e23-45fe-abfc-c78a6e288ae0) | ![Component render](https://github.com/user-attachments/assets/9a5d42f1-cdaa-4f50-8cbd-430bfaf9be48) |

Side by side, the defects are easy to miss. The anaglyph shows them:

![Anaglyph overlay](https://github.com/user-attachments/assets/9c2606df-7e0f-4cf9-ac87-b32575d734bc)

**Cyan** is ink only in Figma. **Red** is ink only in the render. **Gray or black** is a match.

The wide cyan block is the missing button width. The two icons do not overlap.

The blink GIF gives the same answer with no legend:

![Blink GIF](https://github.com/user-attachments/assets/76898c14-c942-4f7a-be7c-2ea04a7ac65a)

Result: score `92.019`, mismatch ratio `0.07981`, gate `0.005`. The test fails.

Run the example:

```bash
cd example
npm install
npx playwright install chromium
npm run parity
```

## Requirements

- Playwright and Chromium.
- `pixelmatch` and `pngjs`, or the comparator already in your repo.
- `ffmpeg` for the blink GIF.
- Figma MCP access to the node.

## License

MIT
