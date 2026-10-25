# Actual GUI alignment pair DEBUG

## Observation

V13records405exact native masks but a simple final cursor snap fails174times.
Actual GUI draw/cursor/size each terminate at separate closed native entrypoints.
The previous raw UpperLeft TextGenerators were comparator meshes, not actual
UpperLeft GUI.Label draws. No production font correction has been applied.

## Hypotheses

### H1: centering layout is responsible (ROOT HYPOTHESIS)

- Supports: same-generation raster alpha and all integer advances are exact.
- Conflicts: actual native UpperLeft has not been measured at centered cursors.
- Test: draw actual UpperLeft labels at reported actual MiddleCenter cursor
  positions and compare independent pen/baseline plus normalized full RGB.

### H2: alignment-independent glyph rasterization shifts the pen

- Supports: GUI mesh and renderer remain native; text parity association persists.
- Conflicts: prior normalized antialiasing is unchanged across widths/origins.
- Test: if UpperLeft retains the same discrepancy at matching cursors, the
  simple centering-only explanation is rejected; retain all failed predictions.

### H3: independently quantized origin composition explains pair differences

- Supports: V13signed quarter origins have staged integer pen steps.
- Conflicts: ordinary independent half-width/half-advance rules fail54cases.
- Test: pair origin0/-0.25at widths361/362for both even Move40and odd U11.

## Experiment contract

One800x600overlay,8pairs/16labels,16pxMove/U×361/362×0/-0.25.
The right label uses UpperLeft with its rect origin computed from the actual
center cursor plus400integer X, subtracting native padding/contentOffset.
Vertical line-top is requested to match via native padding.top. Its own
actual cursor is recorded rather than assumed equal. Rect height stays82.

Eight rows have64spacing. Because shifted UpperLeft rects can overlap the
next row's ink, disjoint400x64analysis regions are explicitly recorded.
Only pixel isolation changes in the existing analyzer; integer pen/baseline
search and atlas mask generation are unchanged. Normalized full RGB and
same-generation atlas checks will remain independent of any proposed rule.

No private GUI mesh is exposed by this experiment. No production edits or
odd-specific offset are permitted.

## Results

- One native frame,16/16unique zero-difference atlas masks.
- Actual UpperLeft cursors equal centered cursors+(400,0),8/8pairs.
- Actual independently measured baselines match8/8pairs.
- Normalized full RGB matches8/8pairs, including every antialiased pixel.
- Complete integer-texel atlas alpha reconstruction matches native grayscale
  exactly16/16samples. Both text groups are invariant across their8samples.
- Every2856nonblack screen pixel belongs to one of the16disjoint tiles.
- Actual UpperLeft ceil(cursorX-.5) matches8/8; actual MiddleCenter matches6/8.
- Both differences are U at even362width, origin0/-0.25: centered pen194
  versus actual UpperLeft pen595minus400=195. Odd361width and all Move
  pairs match after subtracting the integer column translation.
-64raw generator comparators,640vertices and160atlas UV quads check.
- The atlas PNG is byte-identical to V13.

## Conclusion

H1 is supported within this discriminator: matching actual native cursor,
baseline and full glyph grayscale still produces the even-width U difference
only for centered alignment. H2 is rejected for these samples: generic
UpperLeft glyph rasterization does not retain the centered discrepancy.
H3 is localized rather than universally solved: UpperLeft follows the tested
final cursor snap, whereas the two even-width U centered cases do not.

No universal private GUI geometry formula is inferred. Actual native drawing,
cursor and size still have separate closed InternalCall boundaries. No
production font helper or odd-specific correction is changed.

## Execution and provenance

Observer build0warnings/0errors. Debug native executable verified before
restart; native PID35316,800x600,V14observer. Unique startup request has no
command, avoiding old request replay. One unique capture ID is preserved.
The first shell wrapper falsely treated stale LASTEXITCODE as capture failure
after the helper had completed. The existing16label artifact was validated
and analyzed without recapture. No capture bytes were overwritten.

The analyzer only gains optional explicit analysisRegion cropping; its pen/
baseline search and atlas mask algorithm are unchanged. Raw nominal rects
and actual native cursors remain intact. Generic centered prediction fields
in its output are not applicable to UpperLeft and are not used to validate it.

Validation: python scripts/parity-original/summarize-font-alignment-pairs.py

Index: docs/parity/evidence/original/font-alignment-pairs-native-index.json
