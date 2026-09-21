# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable design decisions

- Cold visits show an inline, lightweight copy of the cloud poster before application JavaScript or full styles load, then dissolve into the existing loading screen. Preserve the three-sequence entry gate. Mobile page 05's three-column graphic wall retains a soft top/bottom fade with a fully legible center.
- During cloud-entry playback, keep the homepage navigation and collaboration ticket hidden. Begin their shared 720ms fade only with the final cloud dissolve, so both are complete as the film ends.

- Loading-page companions use the supplied original 墩墩和噗噗 image fixed against the right viewport edge. Keep sequential SVG speech bubbles and the compact AI chat in the site's dark cinematic / warm gold palette. Preserve the characters' original artwork. DeepSeek keys are server-only; the knowledge base follows published portfolio content.

- The five supplied MP4 files are offline source masters only. Production uses five 240-image WebP frame sequences (1200 images total); vertical scroll maps directly to frame index and no MP4 is loaded by the cinematic background.
- Keep a strong four-edge cinematic vignette and tactile grain so video stays atmospheric behind the content.
- Use the selected film-title layout: vertical navigation at left, restrained chapter index at lower left, compact content credits at lower right, and generous empty space.
- Do not place a portrait in the background or page content. Reserve only a small top-right hanging origin for a future employee-badge card with a drop-and-bounce entrance.
- Keep content editorial and sparse. Avoid dashboard grids, cyberpunk HUD styling, neon, dense borders, and card stacks.
- Narrative thread uses smooth cubic arcs through each chapter content edge (restrained hairline + soft gold draw, small dock dots only). No card hover halos. Desktop document height is 7×100svh including the IP epilogue, with no empty tail after page 07.
- Project covers use three equal-width cards with a fixed media stage: keep the complete cover visible and fill unused space with a blurred bleed of the same image, never black letterboxing.
- Graphic work-detail uses a clipped, scaled, heavily blurred bleed of the artwork as atmosphere only. Never place the sharp original as `background-size: cover` on the modal — that crops the poster onto the four card edges.
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

- Page 07 is DUNDUN & PUPU / 墩墩&噗噗: the supplied background rises naturally from below over the frozen last cinematic frame, with edge vignette, bright standard yellow accents, sequential humorous avatar dialogue, and a link to https://dun.zenslab.top. 墩墩 is sleepy; 噗噗 is energetic.
- Loading companions stay small at the right edge, speak alternately near each character, and use a conspicuous animated chat button. The enlarged chat includes their supplied portrait and GSAP entrances. Keep provider names out of visitor UI; configure credentials only in server environment files.

- The IP epilogue speaks as the host thanking someone who read to the end. Keep playful character banter, an explicit original-IP-design label and right-side character profiles; hide the URL in the CTA. Preserve source-image clarity, omit added grain and dialogue backdrop blur, and keep only restrained edge shading. 墩墩 / 噗噗 bubbles are solid black vs solid yellow, no outline. Keep the hat-is-body joke in the third line.

- IP epilogue enters early while rising (top at 65% viewport), with faster staggered dialogue and reversible element exit when scrolling back. The invitation CTA has restrained yellow glow/shine. Character profiles use the supplied sunglasses duo portrait atop a light editorial card, a prominent yellow original-IP badge, and explicitly describe 墩墩 as very sleepy.

- Loading chat refers to the creator as 拯拯, uses only the sunglasses duo in its compact header, omits the hero and form helper text, and uses typing dots. Hide the wall-peeking companions while chat is open. Epilogue CTA must visibly float/bounce; character bios are short trait chips plus one sentence.
- Loading chat retains its welcome hero only until the first visitor message; the sunglasses portrait sits behind and above the panel edge. Thinking status alternates character-specific copy, and input focus uses a subtle inset border. Retain full epilogue character descriptions and pair them with the supplied luggage-tag images, rather than replacing the prose with chips alone.

- Verify local image fixes on the user-facing http://127.0.0.1:4173/ preview. Its public asset lookup returned HTML for a newly added portrait while 5178 returned an image; the chat portrait now uses a bundled source import. Boarding cards have contrasting blue-gray/yellow stock, a boarding header, route, decorative barcode and adaptive edge notches within the restored shared backing.
- The loading chat portrait should sit directly on the panel edge and read as part of the same composition. Keep the IP profile's boarding passes compact and horizontal, with restrained sage and warm-gold stocks; prefer a clean perforation seam over edge notches that leave stray horizontal border fragments.

- Entry uses the supplied cloud MP4: preload its exact first frame as the static loading backdrop with four-edge shading, accelerate the opening and play the final clouds at original speed on entry, then progressively dissolve over the homepage. Preserve original source media; distinguish high-quality web compression from mathematically lossless encoding. Deployment of the reviewed loading-entry changes was approved by the user on 2026-09-14.

- Cloud entry starts at 2.6333x and smoothly decelerates across source seconds 3.2–4.8, with continuous timestamp slope and zero acceleration at both ramp boundaries, then retains original speed. Never hard-switch playback speed. Dissolve only from 3.1 seconds through the end of the 4.1-second edit. Loading uses a deeper uniform full-screen veil plus the four-edge vignette, never a separate central black scrim. Fade the extra veil away once video playback starts.

- Show the top-right contact ticket from the beginning of loading, independent of homepage resource readiness. Prepare the entry video before enabling Enter, display its decoded paused first frame, and never seek again on click. Keep media failure/timeout fallback so the page remains reachable.

- On entry, ease the full-screen loading veil away over 1.4 seconds and the edge vignette over 1.8 seconds, beginning with actual playback. Avoid an abrupt jump in brightness. Keep the later cloud-to-homepage dissolve separate.

- Prelude top-center rotating captions use slightly larger type: desktop English/Chinese 12/13px and mobile 10/12px.

- Loading chat uses deep smoked glass (translucent charcoal, strong background blur, restrained light border), including a translucent welcome-card surface instead of solid fills.

- Chat glass must visibly transmit blurred scene colors, not read as an opaque dark panel: use a 42% charcoal tint with 18px backdrop blur. Do not animate opacity on the dialog ancestor because that temporarily isolates its backdrop.
- Mobile entry must not wait for `canplaythrough`: mobile browsers defer media buffering until an explicit tap. Let the visitor enter as soon as the cinematic frames are ready; the tap begins video playback, with fallback only on a real media error. The chat welcome identifies 墩墩和噗噗 as the creator's two original IP characters.
- Keep the left navigation and top-right collaboration ticket hidden during loading. Reveal both above the entry video as soon as playback begins, before the homepage is fully visible; they remain present through the cloud dissolve.
