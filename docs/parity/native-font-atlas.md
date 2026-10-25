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
