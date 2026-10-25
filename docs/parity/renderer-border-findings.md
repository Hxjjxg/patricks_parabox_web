# Original inside borders, 2026-10-25

## Observations

The third-puzzle native capture at 800x600 has root boundary RGB `(36,36,36)` at `(154,54)` and `(155,55)`, player boundary `(32,0,16)` at `(263,273)` and `(264,274)`, and gold boundary `(46,28,2)`. The root uses a 492-pixel square; each outer cell is 492/9 pixels. Native reference: `evidence/original/third-baseline-settled-20261025/static-0.png`. Independent review references additional original captures.

The previous Web `drawLevel` emitted no root boundary at all. `drawBlock` emitted a generic centered stroke whose width and color came from the backing color, rather than the level's solid edges. Two recorder tests invoking those actual paths failed before the fix, then passed.

## Hypotheses and experiments

1. **Missing native border pass (confirmed):** source `Draw.cs:3293-3445` draws inward strips, and the actual Web recorder emits none. Native root width is round(clamp(492/30,1,600*.00508))=3 pixels. The prior centered-stroke strategy cannot produce the original outer geometry.
2. **Wall shader/texture mismatch (rejected for these boundary pixels):** previously verified wall/body sample points already match native GPU captures. Distinct dark strips are separately emitted after the direct wall pass (`ProcessTicket`, around6111).
3. **Gradient opacity error (rejected):** both Web backing paths already match native0.16 effective alpha and their tests remain passing. It cannot create absent solid edge strips.

`LoadLevel.cs:979-984` computes border HSV using unchanged hue, saturation*1.2 and value*.18. `Draw.HSVToRGBGUI` divides RGB and alpha by2. The observed native border pixels across neutral/player/gold are reproduced by rounding those half-RGB channels to bytes before doubling: root36, player32/0/16, gold46/28/2. Saturation must remain above1 through conversion; clipping it before conversion incorrectly gives player blue19. The managed `Graphics.DrawTexture` arguments remain `UnityEngine.Color`; native/vertex byte transfer is an empirically supported rendering-path inference, not a managed Color32 field claim.

## Fix and regression coverage

`src/render/borderRendering.ts` ports inward strips, screen-limited pixel thickness, native ties-to-even rounding, static cell dimensions for ordinary moving boxes, enter/exit/jump exceptions, continuous full-solid sides, per-solid-cell partial sides, moving-enter/exit exclusion on partial sides, horizontal flip parity, and physical endpoint snapping. `GameRenderer` invokes the pass after direct walls and before nested boxes, replacing its heuristic centered strokes.

`tests/borderRendering.test.ts` covers9 cases, including actual root/player paths, three independently observed RGB colors, partial-edge geometry and mirroring, solid-side behavior, and animation/resolution thickness. Initial2 actual-path tests failed before the implementation.

## Coordinate root cause and independent verification

The initial candidate restored colors and thickness but independent actual-PNG review found persistent one-pixel endpoint errors at800x600 and1001x733. Native instrumented tickets in `evidence/original/third-ticket-{800x600,1001x733,1280x720}-20261025/colors.json` establish focus dimensions491.9999957084656,601.0599947571754,590.3999948501587. All are exactly `screenMin * Math.fround(.82)`: the float constant is retained in a double product. Re-rounding the product to float is incorrect. Odd native viewport centers use integer division:1001x733 centers at500,366. Web previously used JS double.82 and500.5,366.5.

`focusGeometry.ts` preserves that observed precision and integer centering. It also normalizes Chromium emulation's1.0000000298 integer device-scale noise at renderer initialization, keeping true fractional display scales. Four source-backed geometry regression cases compare actual native doubles and final truncated rectangles.

The revised actual Canvas captures in `evidence/web-borders-controls-v2/` independently match all36 root/player/gold side colors and pixel intervals across three resolutions. Native repeats3/3 and Web start/end are stable.444 join checks show no new seams. Durable review: `evidence/review/border-controls-v2-metrics.json`. This is a static border approval, not general scene/motion/shadow approval.

This module does not claim complete parity for special infinity-zone gold oscillation, covered-button white, hub-shortcut and celebration overrides, or all recursive clipping. Those remain explicit follow-up render paths. Filled player/gold contents remain a separate defect at this commit: the Web solid-color shortcut omits native textured wall rendering. Both levels are correctly compacted to1x1 by the TypeScript model, matching native `LoadLevel.FillLevelWithWalls`; the renderer must still submit the one contained wall.
