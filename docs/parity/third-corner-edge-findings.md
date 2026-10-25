# Third puzzle corner-edge residual audit

2026-10-25. Scope: offline existing source, exported texture assets and retained
native/final-v6 captures only. Owned paths are this record and
docs/parity/evidence/third-corner-edge-audit/**. No production, tests, staging,
commits, native process or UI changes are authorized or made. This file is
the scoped debug-hypothesis investigation record; the shared DEBUG.md is
outside ownership. No edge tolerance has been established or accepted.

## Observations

Native input: original/third-baseline-settled-20261025/static-0.png, SHA256
88aeac94e7f5653b6e58e42c3ce4268907197fee9eb424eda05d5522df80cb78.
Final input: web-production-candidate-v6/static/800x600-dpr1/third_puzzle/end.png,
SHA2562334cc33356ee1096d8680147c2400e1819451ca6648f2e1b8ad01de596c1ede.
Both are800x600 RGBA. Three retained native static frames are available.
Reported L-corner ROI[414,298,612,340] contains4 pixels with RGB difference>1;
lower-notch ROI[303,370,443,456] contains10. These are investigation
measurements, not an accepted antialiasing tolerance.

## Ranked hypotheses before experiments

1. **Coverage/compositing order.** Pixi's PNG loader defaults to
   premultiply-alpha-on-upload, linear filtering and premultiplied normal
   blending. Native samples a texture through DrawTexture(instance.Mat).
   Straight versus premultiplied bilinear coverage, HDR multiplication and
   clamp/blend order could selectively brighten partially covered corners
   while leaving opaque flat/highlight samples equal. Conflicts: actual
   native material/texture alpha and sampled texels not yet established.
   Test original pixel provenance and compare source-derived offline
   straight/premultiplied predictions at the exact unshifted rectangle.
2. **Endpoint/UV or raster precision.** Native SetDrawRect snaps endpoints,
   then DrawTexture uses full sourceRect unless clipping. Web snaps endpoints
   and draws a direct texture quad with clamp-to-edge/linear. A texel-center
   or precision mismatch might move a diagonal threshold by a fraction.
   Conflicts: tiny support and otherwise exact edge/flat samples. Test
   source-derived rectangles/UVs and coverage-neighborhood gradients; no
   fitted UV offset, overlap or optimized geometry is allowed.
3. **Changing underlay or pass clock.** Partially transparent wall texels
   could reveal a changing gradient/particle/earlier-pass color. Native
   frames differ by retained times24.49765,24.51404,24.53644. Conflicts:
   reported stable local flats. Test the existing native repeats at the
   exact residual pixels and identify local underlay from source/texture
   support. A changing full frame alone is not local-underlay proof.

## Experiments and literal geometry

Each of e1–e5 is a five-line offline Python diagnostic in the owned evidence
directory. It writes only its own JSON/image evidence. No production
experiment, fitted UV shift, geometry overlap or tolerance change occurred.

E1 reproduces exactly the reported4+10 residual pixels. Their complete RGBA
values are identical in native static0,1,2. The nearest16 montage is ordered
native0/native1/native2/final left-to-right, L-corner then left lower notch
top-to-bottom. It is a nearest-neighbor inspection enlargement, not a new
native capture or pixel-comparison transform.

E2 uses source focusFractNormal=.82f and the settled camera xs=ys=1,
x=y=0 retained in final trace.json. The literal root dimension is
600*f32(.82)=491.9999957084656, with top-left
(154.0000021457672,54.00000214576721). Replacing this with decimal492
would lose the native endpoint truncation at some cells. Source
SetDrawRect1308–1310 truncates both endpoints; Web originalDrawRect matches
that rule. Native DrawWall3024 uses one full texture for these sub256 cells.
The three literal ordinary-wall quads containing all14 residuals are:

| Grid cell | Autotile index | Snapped x,y,width,height |
| --- | ---: | --- |
| (5,4) | 7 | (427,272,54,55) |
| (3,2) | 34 | (318,381,54,55) |
| (4,2) | 26 | (372,381,55,55) |

They are inside the parent clamp. Pixel-center UVs are computed as
((x+.5-left)/width,(y+.5-top)/height), then texel coordinates as UV*200-.5.
All texture neighbors and bilinear weights are recorded without a fitted
offset. Native DrawTexture1427–1474 uses full sourceRect when unclipped and
only remaps sourceRect for an actual parent intersection. The source does
not support modifying these UVs to compensate for a color difference.

E3 tests every same-quad pixel within three pixels of each residual and
retains those whose literal bilinear source alpha is exactly zero. All
such local underlay samples are a single RGB value per corner:93 at the
L,88 at the left lower notch,90 at the right lower notch. Native and final
are identical at every retained zero-alpha support point. The nearest
point is selected only by distance, then y/x; no color fitting is used.
This is local visible-underlay support, not a fabricated underlay render.
Exact hidden underlay at a partially covered pixel is not directly captured.

## Numerical discriminator

E4 obtains current source tint1.112744927406311 from wallTint's literal
cell fraction and the source root color. Let A be weighted texture alpha,
S weighted straight RGB, P weighted premultiplied RGB and B the independently
measured nearest zero-alpha underlay. With byte-valued RGB, compare:

    straight pre-blend clamp: N = clamp(S*tint,0,255)*A + B*(1-A)
    current premultiplied:    W = clamp(clamp(P*tint,0,255) + B*(1-A),0,255)

Every contributing sampled RGB at these14 points is white255. Thus P=255*A
and straight unclamped multiplication followed by alpha is identical to
premultiplied filtering here. **These samples cannot distinguish
premultiply-before-linear as an independent cause.** What they discriminate
is constraining HDR RGB before versus after alpha coverage.

| Pixel | Literal A | B | N prediction / native | W prediction / final |
| --- | ---: | ---: | --- | --- |
| (428,321) | .5962962962962962 | 93 | 189.6 /190 | 206.7434925728374 /207 |
| (323,382) | .7495609691688119 | 88 | 213.17668185119157 /214 | 234.7265271003548 /234 |

At(428,321), UV is(1/36,.9) and source texel coordinate is
(5.055555555555555,179.5). White neighbor alphas are219,255,73,255 with
weights17/36,1/36,17/36,1/36. The source-derived clamp/coverage difference
is17.14349257, compared with measured17. No phase, color or UV was fitted.
At(323,382), UV=(5.5/54,1.5/55), with texel coordinate
(19.87037037037037,4.954545454545454) and neighbor alphas0,4,73,219.

Across all14, the maximum absolute raw prediction error is
1.0026737967914983 for native/N and .8973768444657821 for final/W. These
small remaining errors are explicitly unresolved; they are not a newly
accepted1-byte or antialiasing tolerance. The current model's strong
dominant-order match does not establish exact output-byte equality.

E5 resolves the actual native WallTiles serialized GUIDs rather than
assuming exported filenames. Index7 binds wall_7_0.png,26 binds
wall_26_0.png,34 binds wall_34_0.png. Each differs from Web's retained GPU
readback PNG at18 alpha texels by at most1byte, with unchanged topology.
Using AssetRipper alpha does not eliminate the remaining native prediction
error and sometimes worsens it. This falsifies a simple claim that replacing
the current GPU PNG with that recovered PNG fixes these corners. Existing
original-findings.md records why runtime GPU readbacks replaced recovered
decoder output; this audit does not reverse that established provenance.

## Source pipeline and conclusions

Native init.unity binds Draw.Mat to fileID0. Graphics.DrawTexture therefore
uses its built-in path. The exported Unlit_AllBlocksShader text is marked
DummyShaderTextExporter and is **not evidence of native blend state or
fragment instructions**. No claim about exact native shader assembly is
made from that dummy.

Installed Pixi source explicitly establishes the Web side:
loadTextures.mjs defaults premultiply-alpha-on-upload; GlTextureSystem.mjs
sets UNPACK_PREMULTIPLY_ALPHA_WEBGL for it. mapWebGLBlendModesToPixi.mjs
uses ONE/ONE_MINUS_SRC_ALPHA for normal and SRC_ALPHA/ONE_MINUS_SRC_ALPHA
for normal-npm. getAdjustedBlendModeBlend only changes the latter for an
appropriate no-premultiply-alpha texture path; custom GraphicsPipe.execute
instead reads graphics.groupBlendMode. Merely changing a loader string is
not source proof that this custom wall pipeline changes correctly.
originalTextures.loadWall uses linear/clamp sampling, and createWallShader
retains tint>1 through texture multiplication, leaving HDR premultiplied RGB
able to exceed sampled alpha coverage. That exactly supplies the dominant
brightening term above.

H1 is strongly supported specifically as an HDR/clamp/alpha-order cause of
the major17/20-channel differences. H1's separate premul-before-linear
sub-hypothesis remains unidentifiable with these white contributing texels.
H2 is unnecessary to explain the large residuals with literal source UVs;
it is not fully falsified as a contributor to the remaining approximately
one output byte. There is no evidence authorizing an offset or overlap.
H3 is rejected as an explanation based on changing local backgrounds in
these retained repeats: all14 native pixels and local zero-alpha support
are stable, and the final local support matches native. That bounded result
does not prove every clock/particle in the entire game is irrelevant.

Main's proposed isolated candidate is to constrain wall fragment
premultiplied RGB to alpha after texture*tint, the equivalent of clamping
straight HDR RGB before alpha for this measured white-edge case. This
audit implements no fix and approves no global shader/upload change.
nextWallLayer is also used by native glyphs and the HDR separator, so any
implementation must preserve those existing conventions and be verified
by new actual output. Opaque samples and other partially colored texels
require their own checks.

The dominant mechanism is evidenced; exact native shader/byte behavior and
whole-image parity remain unproved. Existing final-v6 differences remain
failures to investigate, not waived antialiasing. No production or pure
logic/input fix was changed during this source audit.
