# Native GUI font layout evidence

All probes use the authorized debug game copy. Raw prior v3/v4/v5 captures
are retained unchanged. Main owns the production font extractor and renderer.

## Actual viewport anchors

V5 captures include native screenshot, same-generation font atlas, actual
DrawControl centers/final icon rectangles, DrawText rectangle, and
GUIStyle.GetCursorPixelPosition at0/1/5 for font12/16/20.

| Native viewport | Actual font | Caption rect | Move pen/baseline from native mask |
| --- | --- | --- | --- |
| 800x600, existing v4 + first_puzzle static image | 12 | (-223,55.5,600,600) | (62,369) |
| 1001x733, viewport v5 | 16 | (-266,66.8224945,732,733) | (80,451) |
| 1280x720, viewport v5 | 20 | (-180,72.4,719,720) | (154,453) |

The1001 screenshot has four additional threshold-white edge pixels because a
native void particle with RGB(60,60,60) is behind the letters. Transparent
atlas locations at(95..108,442) directly expose that gray background. Raw
alpha236/239/237/238 at(96,444)/(95,445)/(105,445)/(96,448) yields native
RGB240/243/241/242 exactly under rounded white-alpha-over-gray60 blending.
This is background composition, not changed font rasterization.

## Native ascent provenance

`native-main-font-face-v6-20261025/font-face-metrics.json` records actual
FontEngine.GetFaceInfo and legacy TextGenerator.Populate calls. Requested
font12/16/20 has raw face ascent12.839999/17.120001/21.399999.

Hinted ascent is derived directly from native TextGenerator geometry:
`-vertices[0].y + CharacterInfo(M).maxY + characters[1].cursorPos.y`.
The three source triples are(-20,10,-17),(-27,13,-23),(-34,16,-29), giving
13/17/21. This is not a screenshot-fitted baseline offset. TextGenerator
line leading is-1/0/0; lineHeight and GUI CalcSize remain separately recorded.

## Independent diagnostic packs

V7/V8/V9 are explicit diagnostic overlays, not gameplay screenshots. A
World.OnGUI postfix fills opaque black and calls original Draw.DrawText,
which uses original GUI.Label and MainFont. It restores Draw's rect/style
and disables itself after one captured frame. No gameplay state is moved.

- V7: twelve labels,100x80 rectangles, Y fractions0/.25/.5/.75, three fonts.
- V8: twelve labels,101x81 rectangles, X/Y fractions0/.25/.5/.75.
- V9: twelve fresh falsification cases,99x79/102x82 rectangles, negative
  fractional X in the first column, both newline-Move and single-line Undo.

All36 masks match the same-generation atlas exactly and uniquely: white
RGB>=240 matches atlas alpha>=240. V7/V8 isolated M glyph antialias RGB also
matches raw atlas alpha with zero error, across all24 samples.

The proposed staged vertical rule independently matches all36 diagnostic
baselines and the three actual viewport anchors:

`snapY(rect.y) + snapY((rect.height - nativeCalcTextHeight)/2 + paddingTop + lineIndex*lineHeight + nativeHintedAscent)`,
where `snapY(z)=floor(z+.5)`. Native text heights for newline-Move are41/52/64,
paddingTop3. This is an experimentally supported generic GUI raster rule;
Unity's native C++ raster implementation has not been source-confirmed.

The original horizontal advance-width rule was **falsified** by V9: all six
single-line Undo cases are one pixel left of its prediction, while all30
newline-Move cases pass. Do not claim it as a universal text layout rule.
Native generated quad bounds/overhangs are a possible further hypothesis,
not an established fix. Raw measurements and failed predictions remain in
each pack's mask-alignment-analysis.json.

V10 holds newline Move at width102/height82 and integer Y, crossing signed
quarter/half/three-quarter X origins at sizes12/16/20 (18 labels). All18
uniquely match their same-generation atlas and both staged predictions.
Thus width102 and fractional-origin combination alone does not explain V9.
Text, advance parity, overhang, and line structure remain confounded; the
horizontal rule stays open. Absolute negative X is covered by the size12
column; the other sizes use integer-translated signed fractions. The raw
legacy `fractionY` field is a row ordinal in V10; actual `rect.y` is integer
and is what the analysis uses. Across V7–V10, all54 vertical predictions
pass and the same six V9 horizontal failures are retained.

V11 compares Move/newline-Move/Undo/newline-Undo at the same width102,
height82 and fractional geometry for all three sizes. All12 exact masks
confirm that Move passes with or without newline, while Undo is one pixel
left of the horizontal rule with or without newline. All12 vertical
predictions pass. Thus actual newline-Undo also falsifies the current
horizontal rule; line structure is not the cause. Native TextGenerator
preferred widths equal30/40/50 for Move and29/39/49 for Undo. Complete
characters, lines, vertices and settings are in the raw pack. Advance parity
and quad layout remain unresolved. Across V7–V11 there are66 exact masks,
66 vertical matches and12 retained horizontal failures.
