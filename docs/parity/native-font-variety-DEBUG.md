# Native varied-caption horizontal layout DEBUG

## Observations

Earlier same-geometry cross experiments establish exact masks/vertical layout,
but advance-width center predicts Undo one pixel too far right at12/16/20,
with or without a leading newline. No fitted correction is accepted.

## Hypotheses

1. H1 odd advance parity changes horizontal center snapping. Supporting data:
   Move versus Undo has different total advances. Counterpoint: a two-string
   dataset confounds width with first glyph/ink. Test12strings at the same
   even362x82rect, each12/16/20 and integer/fractional origins. Include M/U,
   MM/UU and trailing spaces to separate parity from first glyph/ink.
2. H2 first glyph or ink/quad geometry determines alignment. Same Move/Undo
   confound supports this possibility; no universal rule yet. Compare native
   exact mask placement to atlas bounds, first quad and full ink extent.
3. H3 GUI layout differs from legacy TextGenerator shaping/layout. Previous
   raw GUI cursors alone cannot account for the one-pixel difference. Capture
   actual GUI CalcSize/cursors/style and raw TextGenerator UpperLeft AND
   MiddleCenter at full rect and rect-minus-padding extents. Any one-line
   width/character/vertex difference must remain explicit rather than fitted.

## Experiment

Six explicit diagnostic overlays:12labels each, two separated columns/six
rows, wide362x82rects to avoid word wrap/overlap. Integer origins and
(-.25,+.25)fractional offsets are the only geometry difference. All95ASCII
glyphs at all3sizes are requested before drawing, with current-generation
atlas/glyph UVs exported again. Original DrawText/GUI.Label style remains
intact; no changes to font files, production renderer or gameplay are made.

## Results

-72/72 unique exact same-generation atlas masks;72/72 vertical predictions.
-All6atlas PNGs are byte-identical, each export contains95ASCII×3sizes.
-All72GUI CalcSize widths equal summed atlas advances and all four raw
 TextGenerator preferred widths. Every per-character cursor prefix agrees
 with integer atlas advances; all generator outputs remain single-line.
-H1 is a perfect **association on this tested geometry**:26odd advances have
 measured pen one pixel left of the generic rule;46even advances match.
 Both origins produce identical results. This is not native C++ source proof.
-H2 first glyph/visible ink alone is falsified. At16px, Move advance40 matches
 while Move-plus-space47 fails. M versus MM at20px likewise toggles odd/even.
-H3 does not reveal a shaping/kerning difference within these strings: their
 integer atlas advances reconstruct all72native masks exactly. The remaining
 difference is GUI raster placement versus GUI cursors/centered generator
 start on odd widths. Its general native rounding mechanism remains open.

No text-specific correction or conditional one-pixel production offset is
added. Preserve all measured failures and raw comparators for further tests.
