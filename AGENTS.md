# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable design decisions

- The five supplied MP4 files are offline source masters only. Production uses five 240-image WebP frame sequences (1200 images total); vertical scroll maps directly to frame index and no MP4 is loaded by the cinematic background.
- Keep a strong four-edge cinematic vignette and tactile grain so video stays atmospheric behind the content.
- Use the selected film-title layout: vertical navigation at left, restrained chapter index at lower left, compact content credits at lower right, and generous empty space.
- Do not place a portrait in the background or page content. Reserve only a small top-right hanging origin for a future employee-badge card with a drop-and-bounce entrance.
- Keep content editorial and sparse. Avoid dashboard grids, cyberpunk HUD styling, neon, dense borders, and card stacks.
- Narrative thread uses smooth cubic arcs through each chapter content edge (restrained hairline + soft gold draw, small dock dots only). No card hover halos. Document height hard-locked to 6×100svh so page 06 cannot overscroll.
- Project covers use three equal-width cards with a fixed media stage: keep the complete cover visible and fill unused space with a blurred bleed of the same image, never black letterboxing.
- Project case studies must feel intentionally different by product type (mobile narrative, B-end dashboard logic, website editorial flow) and use real icon-library visuals to reduce text density.
- Local-only Vibe Coding projects use an in-system glass modal for contact and experience guidance; never use the browser's native alert dialog.
- On phones, use one native document scroll flow with content-led chapter heights; do not combine fixed six-viewport shell sizing, per-chapter scroll containers, and scroll clamps. Hide the top-right contact badge whenever any modal or lightbox is open so every close control remains unobstructed.
- Mobile is an editorial-first layout, not a compressed desktop frame: use 18–20px side insets, a genuinely visible fixed navigation sheet, compact bounded media previews, and explicit horizontal-scroll cues for project rails. Keep all contact-button language visible at phone sizes.
- On mobile, avoid page-level horizontal rails: stack project cases vertically so all are directly reachable. Reserve horizontal gesture only for clearly labeled, internally-contained controls such as the Wanying module tabs. Navigation opens as a full-screen sheet.
- Mobile modal controls are persistent: every close action is fixed to the reachable top-right corner, opening the full-screen navigation dismisses any overlay before it navigates, and project-detail media remains sticky at the top while its case content scrolls. Preview media supports pinch/wheel zoom and drag.
- Mobile surfaces should retain the moving visual texture beneath them: use light translucent cards with a strong blur instead of opaque black panels. The graphic wall keeps all three columns wholly inside its frame.
- Overlay close actions render at the document root so transformed or scrolling dialog containers can never displace them from the viewport's top-right corner. The PC-browsing notice remains visible as a compact persistent mobile header label.
- Vibe Coding case studies must explain feature intent, implementation constraints, and the resolution for each major product decision; this detailed product narrative applies on desktop and mobile.
- Preserve the desktop navigation treatment. Mobile-only helper copy and mobile navigation affordances must be hidden by default and introduced exclusively inside the mobile breakpoint.
- Preserve the original 1920×1080 cinematic frames. Before entry, fully cache the first three sequences; then continuously cache the final two sequences in the background. Show a compact upper-right loading indicator until all five sequences are ready, explicitly explaining that any temporary stutter is not the final experience. Keep scroll-time predecode work alive between scroll events; never cancel it merely because the target frame changes.
