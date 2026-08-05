# Design QA — Yellow noir glass correction

final result: passed

## Evidence

- Source visual truth: `reference/selected-direction.png` (1487 × 1058 px).
- User override truth: bright yellow accent, very dark high-blur glass, minimal navigation, no pale frame borders, no upper-right home dossier, larger centered page-03 console, and glass project cards.
- Home implementation: `qa/implementation-yellow-glass-home.png` (1265 × 712 px).
- Page-03 implementation: `qa/implementation-yellow-glass-system.png` (1265 × 712 px).
- Page-04 implementation: `qa/implementation-yellow-glass-projects.png` (1265 × 712 px).
- Same-input comparison: `qa/yellow-glass-comparison.png` (2530 × 746 px).
- CSS viewport: 1280 × 720; browser content capture: 1265 × 712; device density: 1×.
- Normalization: the 1487 × 1058 source was center-cropped and resized to 1265 × 712 before placement beside the home capture.
- State: desktop, badge closed, page 01 at frame 0 for the full-view comparison; separate focused captures for pages 03 and 04.

## Findings

- No actionable P0/P1/P2 findings remain.
- Typography: the condensed display hierarchy, Chinese/English pairing, small mono metadata, and bright-yellow micro labels remain legible against the darker video mask.
- Spacing and layout: the home dossier is gone; the right side is intentionally open again. Page 03 measures approximately 1050 × 518 px and is centered at `(633, 360)` in the full viewport. Page 04 preserves its upper-left safe region with one lead card and two supporting cards.
- Colors and tokens: `--accent` resolves to `#f6ff00`. Navigation and content glass resolve to neutral-black backgrounds; no cyan theme treatment remains visible. The supplied videos retain their own native image colors.
- Glass and borders: navigation uses `rgba(2,2,2,.72)` with 32 px blur. System and project surfaces use neutral-black translucent fills with 30 px blur. Their computed borders are transparent, and the repeated chapter frame pseudo-element is removed.
- Image quality: the supplied video frames and project/system screenshots remain native assets with no stretching or replacement artwork.
- Copy and content: existing 唐启东 portfolio copy and all six chapter labels remain unchanged; only the unwanted home dossier content block was removed.

## Focused checks

- Page 03: the system panel is visibly larger, centered, wider than tall, and clear of the navigation's readable content. Three vertical image streams remain visible. A real mouse click on a moving image opened the image-preview dialog; close restored the page.
- Page 04: all three cards compute to `rgba(0,0,0,.62)`, `blur(30px) saturate(.88)`, and transparent borders. The lead card measures about 409 × 350 px; supporting cards about 319 × 168 px each.
- Navigation: the previous cyan framed control was replaced by a compact borderless black-glass rail. Active state uses one narrow yellow marker and dark tonal fill; the click-focus outline no longer creates a yellow box around the item.
- Home: the upper-right dossier node is absent from the DOM; no horizontal overflow is present.

## Comparison history

- P1 — Cold blue theme contradicted the requested bright yellow. Fixed by restoring `#f6ff00` as the sole interface accent and neutralizing blue-tinted glass surfaces.
- P1 — Pale borders made every page look boxed-in. Fixed with transparent surface borders and removal of `.chapter::after` frame lines.
- P1 — Page 03 was too small. Fixed from roughly 940 × 430 px to approximately 1050 × 518 px while retaining full-viewport centering.
- P1 — Page-04 cards did not read as glass. Fixed with neutral-black translucency, 30 px backdrop blur, deeper shadow, and no outline.
- P1 — The added home dossier created an unwanted block. Removed from the component markup, including responsive leftovers.
- P2 — Navigation felt overdesigned and its focused state produced a thick yellow rectangle. Simplified the rail, removed separators and outer border, and retained only a narrow yellow active marker.

Post-fix visual evidence is recorded in the three implementation captures and the normalized comparison board listed above.

## Technical and interaction checks

- Production build: passed.
- Sites worker tests: 4/4 passed.
- Browser console: no page errors.
- No document-level horizontal overflow at the QA viewport.
- Page-03 image preview: passed with an actual pointer click.
- Five-video vertical frame-scrub behavior was not changed by this visual correction.

## Follow-up polish

- None required for this correction pass.
