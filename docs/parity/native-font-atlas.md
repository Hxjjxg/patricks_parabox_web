# Native caption glyph atlas

The source is the same-generation native dynamic atlas and all95 printable
ASCII CharacterInfo records at12,16,20px from
`evidence/original/native-main-font-ascii-v3-20261025`. The original FontStyle
is Normal on the bundled Jost-SemiBold face. Native GUI/Text reads atlas alpha
only; RGB is zero in the native readback.

`python scripts/extract-native-font.py` unrotates each source UV rectangle,
preserves every alpha byte, advance and signed bound, sets RGB to white for
Pixi sampling, and repacks the285 upright glyphs into a512×512 texture. Both
source inputs and the output PNG are pinned by SHA256 in the extracted JSON.
`nativeFontRendering.test.ts` independently rereads the original atlas and
checks every glyph sample, including rotated UVs, rather than comparing the
generated file with itself.

`nativeGlyphQuads` accepts an explicit native baseline and pen position. It
does not infer GUIStyle baseline placement from Canvas metrics or glyph sizes.
`nativeTextWidth` reproduces CharacterInfo advances: Move is30,40,50px at the
three captured sizes. Unknown font sizes or characters return null for the
existing text renderer fallback; these are not claimed atlas-parity cases.

Raw cropped Move white masks previously matched the native glyph shapes at
all three sizes. This establishes rasterization assets, not final placement:
actual GUIStyle cursor/layout capture is in v4/v5 native exports; native
fractional placement and final integrated browser visual approval remain
separate work. No per-viewport offsets or comparison tolerances are added.

Native TextGenerator v6 provides hinted ascents13/17/21 from actual M quad
vertices, CharacterInfo maxY, and the corresponding line cursor. These are
now extracted with a pinned raw-metrics hash. `nativeGuiBaselines` reproduces
separate origin/alignment Y snapping and native CalcSize height:66 independent
labels from v7–v11 and all3actual tutorial viewport anchors match exactly.
The horizontal advance-centering hypothesis is explicitly rejected by12
Undo cases in v9/v11; no font-specific or viewport-specific correction
is added. Additional cross probes keep placement separate from glyph alpha.

`nativeMoveCaptionQuads` implements only the independently supported Move
placement rule:54 native masks across even/odd extents, signed origins and
single/two-line labels. All12 Undo falsifications return null; their existing
renderer path remains open rather than receiving a fitted one-pixel offset.
`controlCaptionRect` follows SetDrawRect endpoint snapping before the icon
quarter-height Y mutation, preserving the native719/732px widths at the two
larger reference viewports.

Actual Canvas readback exposed a separate GPU integration defect: Graphics
local texture fills normalized over the whole atlas and produced fragments
(3 white pixels at800x600). Installed Pixi generateTextureFillMatrix confirms
that branch does not apply the subtexture frame. A minimal Sprite experiment
restored all39 native white pixels. The caption path now pools four Sprite
instances with exact atlas frames; diagnostic and final800/1001/1280 captures
are retained in evidence/web-native-move-atlas-v1. The1001 comparison has four
native-only threshold pixels from alpha-over-gray60 void particles; the1280
comparison has three Web-only pixels from gray75 particles at different
ambient times. Glyph alpha/placement is not altered for these scene differences.
These dev captures are bounded font evidence, not an immutable integrated
revision approval.
