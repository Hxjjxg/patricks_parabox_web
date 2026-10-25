# Native varied-string horizontal layout evidence

Six explicit native DrawText/GUI.Label overlays contain twelve strings each
at12/16/20px and integer/fractional origins. Rectangles are362x82, laid out in
two separate columns/six rows; the long Note label fits without overlap or
wrapping. The actual GUI style, CalcSize, CalcHeight, cursors and padding are
recorded. Each sample retains raw TextGenerator UpperLeft/MiddleCenter under
both full-rect and rect-minus-padding extents. These are explicit comparators.

Reproduce with capture-font-variety.ps1. Measure independently with
analyze-gui-font-pack.py and the six native-gui-font-variety capture IDs, then
validate with summarize-font-variety.py. The compact index is
evidence/original/font-variety-native-index.json.

## Measured result

All72samples have unique zero-difference atlas mask placements; all72vertical
predictions pass. All six same-generation atlas PNGs are byte-identical, each
with95ASCII glyphs at all three sizes. GUI widths equal summed atlas advances
and generator preferred widths in every sample. All per-character generator
cursor prefixes also match the atlas advances; masks need no shaped spacing.

| Condition | Samples | Native horizontal result |
| --- | ---: | --- |
| Even total advance |46| Generic prediction matches |
| Odd total advance |26| Measured pen one pixel left of generic prediction |
| Either tested origin |72| Same parity association |

The mismatch is not specific to Undo. It also occurs for12px Menu31;
16px U13, Menu43, Move-plus-space47 and Reset puzzle95; and20px M17,
Redo47 and the long Note249. Adding a space to16px Move changes the result
without changing its visible glyph prefix, falsifying a first-glyph/ink-only
explanation. MiddleCenter generator/GUI cursor starts still track the generic
prediction, while actual GUI raster pen differs for the odd-width cases.

This establishes a parity association only for the tested even362width,
MiddleCenter and two origins. It is not a universal source-derived snapping
formula. No one-pixel fallback or text-specific correction is applied.
The prior66sample registry and its failed predictions remain unchanged.
These are diagnostic overlays, not gameplay/final visual-parity approval.
