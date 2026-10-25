# Native TUI fixed-width font evidence

The authorized debug game actually uses Inconsolata-SemiBold, family
Inconsolata, FontStyle.Normal for SquareFont.FixedWidth. At800x600 text_1
is TUI_COLOR and selects font56. DrawTUI floors available width divided by
column count before dividing by float32.55, so trunc(floor(600/19)/.55f)
is56. No57 glyphs were requested. Source DrawText1488 selects FixedWidthFont;
TUIDrawLevel2867/2874 invokes GUI.Label with LowerCenter.

The actual style has lineHeight59, padding[0,0,3,3], contentOffset[0,0],
wordWrap/richText true and Clip. Asset fontSize/ascent/lineHeight are16/13/16;
these are not the requested56 glyph metrics. Native FontEngine face56 has
ascent48.10400009, lineHeight58.74399948 and tabWidth28. All95 printable
ASCII glyphs are found, and their CharacterInfo advances/bounds/four UV
corners are retained with a same-generation256x512 Bilinear/Repeat atlas.

## Actual LowerCenter placement

V2 captures100 actual native labels and a fully settled800x600 screenshot.
Native PostInitializingT1.5079217 is beyond initFadeLength1.5. All100 label
masks match the exported atlas exactly and uniquely after exhaustive integer
pen/baseline search. Measurement uses atlas alpha>=240 and the actual
strongest foreground color channel threshold round(channel*240), cropping
the lower half of each two-cell-high GUI rectangle to isolate its own glyph.

Only after measurement, all100 match penX=ceil(cursor0.x-.5) and
baseline=cursor0.y+48. The ascent48 is independently native-derived:
-(-12) + CharacterInfo(M).maxY36 + cursorY0 =48.
Equivalently for these actual labels, native CalcSizeHeight65 and paddingTop3
give rect.y+rect.height-65+3+48, or rect.bottom-14. This is not a universal
Jost or other-font horizontal rule and introduces no fitted offset.

Example native wall label: rect[168,384,31,112], cursor0[169.5,434], observed
pen169/baseline482. Raw labels retain the original text/color/rectangle,
actual font selection, cursor endpoints, GUI CalcSize and frame. Eleven
native TextGenerator samples and FontEngine face metrics are also retained.

## Startup-fade observation

V1 requested the new scene during game startup and waited.8 seconds. Its
metrics/atlas and100 native rectangles remain valid, but screenshot colors
are globally attenuated: recorded.6 blue peaks133 instead of153, and.95
white peaks210 instead of242. Three candidate explanations were considered:
global fade (common factor and source support), altered font gamma (conflicts
with common scene-wide factor), and repacked/wrong UVs (conflicts with stable
geometry and exact same-generation atlas). DrawEverything1236 explicitly
adds a black initialization overlay until World.PostInitializingT reaches1.5.

V2 adds that native wait condition and records both values. Its100 exact
natural gameplay masks confirm the placement and reject a font-gamma or
UV-repacking explanation for the earlier dim screenshot. V1 remains labeled
diagnostic-startup-fade and superseded byV2; no raw file is overwritten.

Reproduction: TUI_FONT_METRICS request, analyze-tui-font.py, then
summarize-tui-font.py. tui-font-native-index.json contains source/evidence
SHA256 provenance, actual style and strict scope limits.

## Non-perturbing precision trace

V3 additionally hooks original TUIDrawLevel arguments and SetDrawRect double
arguments. All100 actual label rectangles, colors, cursors and style fields
are unchanged from V2, so no geometry perturbation is observed. V3 also has
100 unique exact atlas masks. Each label retains original float entry
arguments and their bit patterns plus the latest original double rectangle
arguments; no argument is rewritten.

Native level0 leftX is107.39998626708984 (0x42D6CCCB), level2 leftX is
415.3999938964844 (0x43CFB333), topY104 (0x42D00000). cellYToX is
.550000011920929 (0x3F0CCCCD), cellYToH1 (0x3F800000). First actual
SetDrawRect arguments are[168.9999885559082,440,30.80000114440918,56].
The first leftX differs from a prematurely rounded layout calculation;
the cell width passed to SetDrawRect is float32-representable. These raw
entry/submit facts resolve precision ambiguity without fitted cell offsets.
