# Actual GUI.Label centered and UpperLeft pairing

One800x600native overlay contains8pairs/16labels in the same native frame.
At16px, Move40and U11integer advances are tested at widths361/362 and
origins0/-0.25. The right-column label is actual GUI.Label UpperLeft. Its
rect origin is computed from the actual centered GUI cursor, with an
integer400X translation and native padding/contentOffset subtraction.
Its own actual native cursor is recorded; no equality is assumed.

## Exact results

All16samples have unique zero-difference atlas mask alignments. Every pair
has exactly matched actual cursor positions after400X translation, equal
independently measured baseline, and identical normalized full RGB raster.
All16complete grayscale rasters also exactly equal integer-center atlas
alpha reconstruction, including low-alpha edges. The45-pack V13atlas is
byte-identical to this capture.

| Text | Width | Origin | Center cursor X | Center pen X | UpperLeft pen minus400 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Move |361|0|180.5|180|180|
| Move |361|-0.25|180.25|180|180|
| Move |362|0|181|181|181|
| Move |362|-0.25|180.75|181|181|
| U |361|0|194.5|194|194|
| U |361|-0.25|194.25|194|194|
| U |362|0|195|194|195|
| U |362|-0.25|194.75|194|195|

Actual UpperLeft pen follows ceil(actualCursorX-0.5) in8/8cases. Actual
centered pen follows it6/8times. The two differences are U at even width362,
including both origins. Their centered pen is one pixel left while their
actual glyph grayscale is unchanged. This isolates the bounded residual to
centered alignment layout rather than generic UpperLeft glyph sampling.

## Verification and limits

The16analysis tiles are disjoint400x64regions. Shifted nominal UpperLeft
rects overlap neighboring rows and can extend past screen right; all2856
nonblack screen pixels are nevertheless accounted within the tiles. Their
pixel isolation is independent of nominal rect bounds. Native rects and
cursors are preserved without substitutions.

All64TextGenerator comparators retain exact prefixes;640raw vertex positions
and160quad UV sets match their current atlas counterparts. These remain
comparator meshes, never actual GUI.Label private mesh data.

This tests only two captions, one font size, two widths, two origins and two
alignments in one frame. A universal native centering/pixel-center mechanism
is still unproved because actual drawing/cursor/size implementations remain
separate closed native InternalCalls. No production font offset is applied.

Source/DLL hashes, raw screen/atlas/metrics, independent alignment analysis
and SHA256file hashes are retained under:
docs/parity/evidence/original/native-gui-font-alignment-pairs-v14-20261025

Index: docs/parity/evidence/original/font-alignment-pairs-native-index.json

Capture: scripts/parity-original/capture-font-alignment-pairs.ps1 with a new
capture ID revision. Existing capture IDs are never overwritten.

Validation:

    python scripts/parity-original/summarize-font-alignment-pairs.py
