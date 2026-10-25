# Native font width and pixel-center sampling DEBUG

## Observations

V12 established72exact masks and an odd-advance association at even362width.
Actual GUI cursor, TextGenerator cursor and independently measured raster pen
are separate observables. Private native GUI mesh vertices are not exposed.

## Hypotheses

### H1: advance parity predicts the generic-rule difference

- Supports: V12odd26cases differ by-1; even46cases match.
- Conflicts before test: only362width and two origins were measured.
- Test: paired361/362/363widths, same captions/sizes, nine signed origins.
- Result: association survives405cases; mechanism remains unproved.

### H2: odd rect widths remove the odd-advance association

- Supports: width parity changes the mathematical center by0.5.
- Conflicts: GUI/generator prefix advances already agree with the atlas.
- Test: vary width only, retaining style/font/height/caption.
- Result: rejected. Odd-width odd-advance108cases still differ by-1.

### H3: final ceil(GUIcursorX-0.5) determines native raster pen

- Supports: cursor exposes fractional placement; font filtering is Bilinear.
- Conflicts: prior evidence suggests origin quantization occurs separately.
- ROOT HYPOTHESIS test: signed quarter origins around both half-pixel
  boundaries, independently measured pens and normalized full RGB comparison.
- Result: rejected174/405times. Every size/text has byte-identical full RGB
  raster across all27width/origin cases, including antialiasing.

## Experiment

45overlays:3sizes×3widths×5captions. Each has X origins
-1,-.75,-.5,-.25,0,.25,.5,.75,1; integer Y;82height;64row spacing.
Ink is disjoint and entirely within800x600, even though the final rect extends
4pixels below screen. Existing independent mask analysis ran unchanged.
Diagnostic observer data adds raw TextGenerator UIVertex positions/UV0/colors
and font metadata. Prior GUI style is restored; overlay flags clear in finally.

## Results

-405unique exact masks;405vertical predictions;45byte-identical atlases.
-162odd advances differ by-1;243even advances match the generic staged rule.
-405GUI cursors equal x+W/2-ceil(A/2).
-405centered generator cursors equal ceil(W/2)-ceil(A/2).
-1620comparators;44064raw positions;11016quad UV mappings checked.
-15normalized full-RGB invariant groups of27samples each.
-Origin pen steps: -1,-.75,-.5; then-.25,0,.25,.5; then.75,1.

## Conclusion and limits

The proposed single final cursor snap is falsified. The evidence supports
separate stages, but the unexposed private GUI geometry rounding mechanism
is not derived. No production offset or renderer change is applied.
The two cursor formulas and origin step are bounded observations for this
matrix, not universal Unity internals. Raw generator vertices are never
described as actual GUI mesh data.

Runtime metadata: Jost-SemiBold / Jost, GUI/Text Shader,256x256Bilinear Repeat.
Exported TTF size/hash are retained as export provenance, not runtime byte
proof. Native PID28104runs800x600with V13DLL; no controls held; overlay inactive.

Validation: python scripts/parity-original/summarize-font-sampling.py

Index: docs/parity/evidence/original/font-sampling-native-index.json

## Bounded style and managed-boundary follow-up

All405styles have padding[0,0,3,3], contentOffset[0,0], MiddleCenter,
Normal, wordWrap/richText true, Clip. Draw.DrawText changes color/alignment/
size/font and directly invokes GUI.Label with the supplied rect; it does
not perform an additional managed horizontal offset or rounding operation.

Read-only local Mono.Cecil metadata confirms Label→DoLabel→GUIStyle.Draw→
Internal_Draw_Injected. Cursor and CalcSize terminate in separate
Internal_GetCursorPixelPosition_Injected and Internal_CalcSize_Injected.
All three are InternalCall methods without IL bodies. The attempted dnSpy
read API returned a cross-thread error; this conclusion uses local metadata.
The exact13method bodies/boundaries and assembly/source hashes are retained
in font-sampling-managed-boundaries.json.

Using the already measured405samples,30ordinary candidate rules are tested
without adding a parity condition:5quantizers on the full center, then25
pairs on independently quantized half-width minus half-advance. Quantizers
are floor,ceil,half-down,half-up,ties-even. Full-center rules match at most243.
Independent halves match at most351: ceil(x-.5)+floor(W/2)-ceil(A/2). All54
remaining failures have even W and odd A; every failed case is retained in
font-sampling-stages-analysis.json.

These bounded candidates do not derive the private native mechanism. A
rewritten formula which merely hides odd-specific subtraction would not
prove an independent native stage. No new probe or source change is made.
