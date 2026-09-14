# Maintaining the reusable viewer

Ordinary PR reports require only Node and the existing compiled `assets/viewer.html`. Do not rebuild or regenerate visual assets per PR.

For a user-requested visual or interaction change:

1. Work in a copy of the skill so the installed renderer remains usable.
2. Edit `src/shell.html` (layout/CSS), `src/app.js` (navigation/detail state), or `src/scene.js` (3D geometry/camera/labels) at the repository root.
3. Install pinned development dependencies with `npm ci --ignore-scripts`, then `npm run build`. This produces two self-contained templates: `assets/viewer.html` (flowchart + 3D, bundles three.js) and `assets/viewer-lite.html` (flowchart only; `src/scene-stub.js` replaces `scene.js`). No CDN or network dependency is needed when reading a report.
4. Run `npm test`. Render the demo and another report through `scripts/explain-pr.mjs`. Check actual WebGL rendering, transitions, branch choices, history, direct inspection, unread/unknown state, reduced motion, no-WebGL fallback, download, and desktop/mobile presentation in a browser.
5. Keep data insertion script-safe and source links pinned. Back up the installed template before replacing the tested viewer. The renderer must continue accepting the existing report schema.

The scene's platform, character, materials and animations are procedural reusable assets. Report JSON describes service behavior and illustrative states, not scene geometry. New PRs do not need new character models or UI code. Large graphs can use the overview and camera controls; do not omit branches to fit a screenshot.

Three.js is bundled under its MIT license; see `assets/THREE-LICENSE.txt`. npm dependencies are development-only and need not be installed to run collect/validate/render or read generated HTML.
