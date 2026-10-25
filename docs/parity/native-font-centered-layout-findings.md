# Native centered font layout investigation

The investigation used read-only native disassembly and existing captures.
After the source-stage mechanism was validated, the coordinator authorized
the bounded production helper and tests described below. No browser/native
window, capture rewrite, fitted offset or parity branch was used. This owned
document carries the DEBUG trail; shared DEBUG.md is not edited concurrently.

## Observations

- V13 retains 405 exact native atlas-mask reconstructions with the same
  generation atlas and invariant normalized RGB across origin/width variants.
- Generic staged placement matches all 243 even-advance samples and places
  all 162 odd-advance samples one pixel to the right of the native pen.
- Actual V14 GUI.Label pairs isolate two residuals: 16px U, width362,
  origins0/-0.25. Centered cursor and translated UpperLeft cursor agree,
  baselines and complete glyph grayscale agree, but centered pen194 differs
  from translated UpperLeft pen195. Ordinary cursor snapping is insufficient.
- Existing managed IL retains GUI.Label -> DoLabel -> GUIStyle.Draw and
  distinct Internal_Draw_Injected, Internal_GetCursorPixelPosition_Injected
  and Internal_CalcSize_Injected native boundaries. These have no managed IL.
- Local UnityPlayer.dll is 28,228,696 bytes; SHA256
  113d3deebd690e63e8925ffba6b4a1edc0409fe7dd345a6f119e1fb7e5e37cf0.
  Exact InternalCall registration strings occur in its read-only bytes.

## Hypotheses

### H1: private centered layout performs an additional native width/snap stage

ROOT investigation hypothesis. Supports: actual centered/UpperLeft raster
differs only in placement despite matching exposed cursors and grayscale.
Initial conflict: 30 ordinary independent quantizer candidates already fail;
no particular extra stage was yet justified. Test: locate exact native InternalCall
bindings and follow draw versus cursor/layout callees, retaining arithmetic
and rounding instructions rather than fitting the observed parity.

### H2: unexposed fractional advance or ink bounds drive centered width

Supports: CharacterInfo/CalcSize integer advances need not expose every
private draw metric. Conflicts: all exposed preferred widths agree and the
failure tracks integer advance parity across 405 samples. Test: inspect
actual runtime metric fields and native draw width calculation; distinguish
advance, final glyph bearing and generated ink extent.

### H3: vertex/raster snapping rather than private pen layout causes the shift

Supports: actual GUI private mesh is unexposed and native rendering may
quantize mesh positions. Conflicts: UpperLeft at the same actual cursor
does not preserve the centered residual, and complete grayscale remains
unchanged. Test: inspect native draw rounding/projection operations and
identify whether alignment changes pre-raster geometry. No raster tolerance
or arbitrary correction will stand in for the missing mechanism.

## Experiments

### E1: resolve native GUIStyle draw and cursor boundaries

The inspected local image is
`F:/Patricks.Parabox_inject_debug/UnityPlayer.dll`, image base `0x180000000`,
SHA256 `113d3deebd690e63e8925ffba6b4a1edc0409fe7dd345a6f119e1fb7e5e37cf0`.
Its IMGUI table has 213 name pointers at file offset `0x195d0d0`, a NULL at
`0x195d778`, then the corresponding function-pointer array at `0x195d780`.
The following ordinal pairs have independently compatible wrapper signatures:

| Index | Exact managed InternalCall name | Native wrapper | Main callee |
| --- | --- | --- | --- |
| 152 | UnityEngine.GUIStyle::Internal_Draw_Injected | `0x180394dc0` | `0x1802955a0` |
| 156 | UnityEngine.GUIStyle::Internal_GetCursorPixelPosition_Injected | `0x1803952b0` | `0x180297940` |
| 161 | UnityEngine.GUIStyle::Internal_CalcSize_Injected | `0x1803958f0` | separate size path |

The table registration loop itself was not located; the exact adjacent
name/function tables and wrapper/callee signatures establish this mapping.
Managed boundaries are retained separately in
`evidence/original/font-sampling-managed-boundaries.json`.

Read-only inspection used LLVM objdump and an IDA headless analysis session
(`37de951e`). IDA generated a `.i64` sidecar next to the debug-copy DLL;
the DLL SHA256 remained unchanged. Some Hex-Rays prototypes are incomplete,
so decisive arguments and float operations below were also checked in x64
assembly. No symbol names were invented for anonymous native functions.

### E2: draw does two distinct center/snap stages

1. `0x1802955a0` snaps the original rect through `0x180614830`, then calls
   the text/content pass `0x180295990`.
2. That pass obtains text cache/width through `0x180298530`; cache width
   is at `+76`. Text generation width is quantized with `ceil(width*128)/128`.
3. `0x1802931d0` aligns the text rect in the content rect. MiddleCenter
   uses horizontal factor `.5` (`0x1802934ee` switch, `0x180293551`
   horizontal computation, text-only emission `0x180293737..74f`).
4. The caller snaps this aligned text rect through `0x180614830`.
5. `0x180299740` then computes a new anchor from the **snapped text rect**:
   case4/MiddleCenter uses `textRect.x + textRect.width*.5`
   (`0x1802999db`, arithmetic at `0x1802999ec`). UpperLeft uses its left edge.
6. It snaps that anchor again through `0x1806145d0 -> 0x1806145f0`
   (`0x180299a90..a9c`), sets the draw transform and submits cached vertices
   through `0x180c89d60`.

`0x180614830` snaps both rect endpoints, then subtracts them to recover
width/height. `0x1806145f0` projects a GUI point through current matrices
to physical viewport pixels, adds the literal float `0.47999999`, applies
`floorf` (`0x18061471d`, `0x18061473b`) and unprojects. Invalid viewport
dimensions return the input unchanged. The `.48` constant is engine code,
not a fitted caption adjustment. For the retained untransformed unit-scale
horizontal probes, the reduced operation is `Q(x)=floor(x + .48f)`.

This source path supplies the additional stage omitted by the previous
30 single/full-center or independent-half quantizer candidates.

### E3: prove the local centered vertex/cursor origin

`0x180c858d0 -> 0x180c85480` builds the native GUI text cache. The latter
constructs a generator (`0x180c76990`), populates it (`0x180c7c8b0`,
`0x180c7bb30`), obtains bounds (`0x180c77650`), copies per-character
cursors (`0x180c778a0`) into cache `+248`, then copies geometry. Generator
fields include alignment `+176`, snap flag `+189`, scale `+208`,
align-by-geometry flag `+213`, cursor array `+328`, advance array `+360`.

The decisive function is `0x180c76e60`, called at each completed line by
`0x180c77120`. With align-by-geometry disabled it loads the line's initial
cursor X and the last cursor X plus advance (`0x180c76ed7..ee8`). Its
center branch adds these endpoints, multiplies by `.5`
(`0x180c76fa2..fa9`) and calls `0x180c7b3d0`. The latter performs
`floor(scale*midpoint + .5)/scale` when snapping is enabled. The center
branch negates this rounded midpoint and adds the result to **every vertex**
(`0x180c76fd0..ff0`) and **every character cursor**
(`0x180c77010..30`) in the line. Thus the mechanism is geometry generation,
not an inferred shift from bounds alone.

For retained ordinary single lines, initial cursor is0, last cursor plus
advance is `A`, scale is1, so local line origin is
`-floor(A/2+.5) = -ceil(A/2)` for integer advances. Independent bounds
function `0x180c77650` confirms the same centered bounds X and rounded
width (`0x180c77755..7aa`). Multi-line geometry uses a shared render anchor
from maximum text width and this separate midpoint per line.

The exposed GUI cursor follows another route:
`0x180297940 -> 0x180c7cef0 -> 0x180c86a90`. It gets an unsnapped alignment
anchor from `0x180298ae0` and adds cache cursor data. MiddleCenter's
cursor anchor is `rect.x + rect.width*.5`, with no draw-anchor snap.
Matching exposed cursors therefore never implied equal final raster pens.

### E4: literal stages against existing raw evidence

The offline diagnostic `scripts/parity-font-centered-layout.py` uses:

```text
rootLeft = Q(x)
rootWidth = Q(x+W)-rootLeft
alignedTextX = rootLeft+(rootWidth-A)*factor
textLeft = Q(alignedTextX)
textWidth = Q(alignedTextX+A)-textLeft
renderAnchor = Q(textLeft+textWidth*factor)
pen = renderAnchor - floor(A/2+.5)  [MiddleCenter]
pen = renderAnchor                [UpperLeft]
```

Here factor is `.5` for MiddleCenter and0 for UpperLeft. There is no
advance-parity condition, caption-specific offset, fitted parameter or
tolerance. The `.48f` and `.5` constants come from different native
operations. The diagnostic verifies all three source-index SHA256 values
and all260 indexed raw artifacts before checking samples. It optionally
checks the native DLL identity via `--native-binary`.

| Existing sample set | Samples | Literal-native matches | Failures |
| --- | ---: | ---: | ---: |
| V13 sampling,3 sizes,3 widths,9 origins,5 captions | 405 | 405 | 0 |
| V14 actual GUI alignment pairs, both alignments | 16 | 16 | 0 |
| Held-out V12 varied captions,3 sizes,2 origins | 72 | 72 | 0 |
| Total | 493 | 493 | 0 |

Historical analysis is left intact: the independent candidate
`ceil(x-.5)+floor(W/2)-ceil(A/2)` still matches351/405 and fails54/405.
The diagnostic retains each of those54 failures with old pen, actual pen
and literal-native pen; the new stages match all54. These are distinct from
the54 previously supported Move samples in older baseline evidence.

V14's discriminating `U` (`A=11,W=362`) at `x=20` or `x=19.75` gives:

```text
rootLeft20 -> alignedTextX195.5 -> textLeft195 -> textWidth11
renderAnchor Q(200.5)=200 -> localOrigin-6 -> pen194
```

The actual UpperLeft comparison rect begins at595 or594.75. Its render
anchor snaps to595 and local origin is0, so its pen minus the400px column
translation is195. The one-pixel residual is predicted by actual native
stages despite the equal exposed cursors, not corrected afterward.

## Root cause and conclusion

H1 is confirmed in the retained scope: private GUI text drawing aligns and
snaps its text rect, then recenters and snaps a rendering anchor for
already-centered local geometry; the cursor API omits those draw stages.
H2 is unnecessary for these samples: integer advances and per-line native
midpoint rounding account for all493 pens, including trailing-space cases.
H3's distinct filtering explanation is rejected for the retained samples;
the geometry/anchor path predicts placement while existing full-grayscale
atlas reconstruction remains exact. Matrix-projected snapping is real,
but no raster tolerance is used.

## Bounded production change

- `nativeGuiPenX(advance, rect, alignment?)` preserves the explicit native
  horizontal stages; default alignment is MiddleCenter.
- `nativeCaptionQuads(text,fontSize,rect)` uses the same draw anchor,
  per-line local midpoint and existing measured baseline function.
- Plain captured ASCII at12/16/20px, explicit newlines and non-wrapping
  text are supported. Unknown sizes/characters, rich-text delimiters or
  text requiring wrapping return null for the renderer's existing fallback.
- `nativeMoveCaptionQuads` remains a compatible Move-only wrapper so its
  existing callsites/tests retain their original contract.
- `GameRenderer.ts` integration and actual Canvas capture are coordinator
  work; this module does not alter that shared file.

Validation: nativeFontRendering/controlRendering focused suites pass42
tests, including all493 indexed horizontal samples, the historical54
counterexamples, all66 older generic caption samples, unchanged54 Move
wrapper results and12 legacy Undo rejections; isolated TypeScript typecheck
passes. The subsequent full suite passes59 files/924 tests. Its build stops
on coordinator-owned concurrent GameRenderer unused locals at1300-1303;
this helper does not alter that file and the coordinator has been notified.
The offline diagnostic reports260 verified artifacts,493/493 stages and
the unchanged351/405 historical result.

## Actual Canvas integration

The renderer now calls the generic helper for icon captions. The iconless
Note retains the existing wrapped-text fallback because the captured helper
does not implement native word wrapping. A renderer regression exercises all
24 glyph sprites across Undo, Redo, Reset puzzle and Menu, checks pool reuse,
and verifies the Note fallback. Restoring the previous Move-only callsite
makes this regression fail; exact output is retained in
evidence/web-native-captions-after-dev/previous-callsite-regression.txt.

Actual browser evidence in evidence/web-native-captions-after-dev contains
all three playable levels at800x600,1001x733 and1280x720, DPR1. Intro control
activation is established by a recorded real Hub RDD then Down portal entry;
subsequent diagnostic level loads preserve that existing controller flag.
Second-puzzle images retain natural fade progression (only Undo visible at
the sampled end), while third displays all four icon captions and the
wrapped Note. These are actual Canvas outputs with trace, exact source hashes
and a visual contact sheet. No forced clock or synthesized glyph image is
credited as a browser capture. Native full tutorial pairing and independent
review remain separate acceptance checks.

After integration, all59files/928tests, typecheck and production build pass.
The offline source-stage diagnostic also re-verifies the inspected DLL,
all260 raw artifacts and493/493 retained sample pens. The previous351/405
candidate result is preserved. The diagnostic output is retained in
font-analysis/native-centered-stage-check.json.

## Limits and next evidence boundary

This closes the retained horizontal layout residual. It does not claim
natural gameplay visual acceptance, arbitrary rich text/wrapping, missing
glyph fallback, arbitrary font sizes, non-ASCII shaping, arbitrary GUI
matrix/DPR behavior, or the exact float32 projection threshold for origins
within hundredths of a pixel of `.52`. The source's full projection path
is retained in this report rather than silently asserted equal to reduced
`Q` under all transforms. Baselines are unchanged from the independently
measured existing helper.

If transform/threshold parity is pursued, a discriminating bounded native
experiment is the same ASCII caption at origins immediately below/above
`.52`, across positive/negative coordinates and a second viewport/DPR,
with GUI matrices recorded. Compare the full native float32 projection
path, not another fitted pen offset. Captures and final reviewer acceptance
remain separate from this offline/source derivation.
