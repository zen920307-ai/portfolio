# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable design decisions

- The five supplied MP4 files are the only full-screen background imagery. Each video bridges one adjacent pair of the six portfolio chapters and is scrubbed by scroll plus subtle pointer movement.
- Keep a strong four-edge cinematic vignette and tactile grain so video stays atmospheric behind the content.
- Use the selected film-title layout: vertical navigation at left, restrained chapter index at lower left, compact content credits at lower right, and generous empty space.
- Do not place a portrait in the background or page content. Reserve only a small top-right hanging origin for a future employee-badge card with a drop-and-bounce entrance.
- Keep content editorial and sparse. Avoid dashboard grids, cyberpunk HUD styling, neon, dense borders, and card stacks.
- Narrative thread uses smooth cubic arcs through each chapter content edge (restrained hairline + soft gold draw, small dock dots only). No card hover halos. Document height hard-locked to 6×100svh so page 06 cannot overscroll.
