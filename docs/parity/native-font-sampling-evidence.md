# Native GUI font width and pixel-center evidence

V13contains45native800x600screenshots and405Draw.DrawText / GUI.Label
samples. It varies font12/16/20, width361/362/363, Move / Undo / U /
Move-space / Note: You can undo a reset, and nine signed quarter-pixel X
origins from-1to1. The unchanged independent analyzer uniquely reconstructs
all405white masks with the same-generation atlas, with zero difference and
a strictly worse second candidate. All405vertical checks pass.

## Placement

The existing generic staged rule is evaluated rather than assumed:

    genericPenX = ceil(x - 0.5) + ceil((W - A)/2 - 0.5)

A is summed integer CharacterInfo advance, equal to GUI CalcSize.x and
all generator preferredWidths. All243even-advance cases match; all162odd
cases place the raster one pixel left. Odd rect widths retain the association.
Every failed prediction remains in raw alignment analysis and the405row
index. No corrective offset is added to production.

| Rect parity | Advance parity | Samples | Measured minus generic |
| --- | --- | ---: | ---: |
| even | even |81|0|
| even | odd |54|-1|
| odd | even |162|0|
| odd | odd |108|-1|

GUI cursor X equals x+W/2-ceil(A/2) in405cases. Explicit centered
TextGenerator first cursor equals ceil(W/2)-ceil(A/2) in405cases. They differ
by0.5at odd rect widths. The four comparator settings retain UpperLeft and
MiddleCenter with full rect and rect-minus-GUI-padding extents separately.

## Pixel-center falsification

A single final ceil(GUIcursorX-0.5) predicts231pens and fails174. At12pxMove,
width361,x=-0.5 reports cursor165but pen164; width362,x=-0.25reports
cursor165.75but pen166. The proposed single final snap cannot explain both.

Origin steps are invariant across all45packs: -1,-.75,-.5share one pen;
-.25,0,.25,.5share the next; .75,1share the next. Every nonblack RGB pixel,
including gray antialiasing, is byte-identical after independent alignment
for all27width/origin cases in each of15size/text groups. Continuous
quarter-origin bilinear glyph changes are absent in this matrix. Private
GUI geometry is unexposed, so a universal pixel-center mechanism is unproved.

## Provenance

-1620TextGenerator comparators expose44064raw UIVertices; each raw position
  equals its plain export and each vertex color is opaque white.
-11016quad UV sets match current CharacterInfo corners. Spaces retain
  advance while emitting no quad. All45atlas PNGs are byte-identical.
-All95ASCIIglyphs at3sizes are available per pack. Screen, metadata,
  source/DLL identity and SHA256hashes are indexed.
-Runtime source: Jost-SemiBold / Jost, GUI/Text Shader,256x256, Bilinear,
  Repeat. Exported Jost-SemiBold.ttf size/hash are recorded separately.
-Actual GUI rect/style/cursors/raster are captured. Raw vertices belong to
  TextGenerator comparators, not private GUI.Label mesh.
-Observer builds with0warnings/0errors; finally clears overlay flags and
  restores prior GUI style state.

Coverage is diagnostic overlays at one resolution/font/alignment, ASCII,
integer rect sizes and the stated origins. It is not gameplay visual approval.

Capture helper: scripts/parity-original/capture-font-sampling.ps1. Use new
capture-ID revisions; existing IDs are never overwritten. Run the existing
analyze-gui-font-pack.py for newly captured names, then validate/index:

    python scripts/parity-original/summarize-font-sampling.py

Index: docs/parity/evidence/original/font-sampling-native-index.json

## Bounded independent-stage follow-up

All405styles agree: padding[0,0,3,3], contentOffset[0,0], MiddleCenter,
Normal, wordWrap/richText true, Clip. Managed Draw.DrawText forwards the rect
directly to GUI.Label. Local read-only assembly metadata preserves the
Label→DoLabel→GUIStyle.Draw chain and three separate native InternalCall
boundaries for drawing, cursor position and size. Their native bodies and
actual draw mesh are not available in managed IL.

30bounded ordinary quantizer rules are evaluated against the existing
matrix. Quantizing the full center matches at most243/405. Independently
quantizing half-width and half-advance matches at most351/405; the best
floor(W/2)-ceil(A/2)candidate retains54failures at even width/odd advance.
Thus raw cursors and invariant horizontal style do not presently derive all
actual pens through these ordinary independent stages. No hidden algebraic
parity correction is presented as native behavior.

Supplemental artifacts under the same evidence directory:
font-sampling-managed-boundaries.json and font-sampling-stages-analysis.json.
They retain source hashes, exact managed boundary IL, all candidate scores
and every remaining best-candidate failure. No new native probe is needed
for this bounded conclusion.
