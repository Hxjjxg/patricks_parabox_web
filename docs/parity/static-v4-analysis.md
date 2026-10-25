# Integrated v4 static comparison support

This is a reproducible offline diagnostic, not independent visual acceptance.
It changes no game source, browser state, production bundle, matrix or review
files. The existing independent reviewer retains acceptance ownership.

## Inputs

The expected20 conditions are first_puzzle, second_puzzle and third_puzzle
at800x600,1001x733 and1280x720, each at DPR1 and2, plus third_puzzle at
1280x900, DPR1 and2. Web PNG dimensions must equal CSS viewport times DPR.

Preferred directory capture convention, relative to
docs/parity/evidence/web-production-candidate-v4/static/:

```text
{width}x{height}-dpr{1|2}/{first_puzzle|second_puzzle|third_puzzle}/start.png
{width}x{height}-dpr{1|2}/{first_puzzle|second_puzzle|third_puzzle}/end.png
{width}x{height}-dpr{1|2}/{first_puzzle|second_puzzle|third_puzzle}/trace.json
```

The comparator also accepts the flat convention
{level}-{width}x{height}-dprN.png, optional -repeat.png, and same-stem.json.
Singleton PNGs remain Web-repeat-unverified and cannot qualify stable
interior acceptance. A trace carries viewport.canvasWidth/canvasHeight and
starting/ending states with matching levelName, moveCount0 and moving=false.
Unknown metadata stays unknown; it is not filled from filename assumptions.

Native references are under docs/parity/evidence/original/. Each named
directory must contain exactly static-0.png, static-1.png and static-2.png.

| CSS size | Level | Native directory |
|---|---|---|
|800x600|first_puzzle|first_puzzle-static-20261025|
|800x600|second_puzzle|second_puzzle-static-20261025|
|800x600|third_puzzle|reviewer-third-static-20261025|
|1001x733|each of first/second/third|{level}-1001x733-static-v2-20261025|
|1280x720|each of first/second/third|{level}-1280x720-static-v2-20261025|
|1280x900|third_puzzle only|third-integer-1280x900-static-20261025|

Every image, metadata file, root-level geometry input and comparator script
is SHA256 recorded. Native images are1x physical pixel references for both
Web DPR conditions. This comparison never manufactures a native DPR2 image.

## Method

scripts/parity-static-compare.py preserves the established independent
analyze-static-integrated-v1.py ROI definitions and numeric thresholds.
It introduces no fitted shift, image registration or tolerance increase.

- Sample repeatability requires exact equality over native0/1/2 and Web
  start/end. Native5x5 channel span<=2 identifies flat reference interiors.
  Only repeat-stable flat samples use the established maximum RGB channel
  difference1/255. Unstable samples and stable edge-adjacent/AA differences
  are separate diagnostics, not newly accepted differences.
- Each native CSS pixel(x,y) is compared with every raw Web physical pixel
  in[x*DPR,(x+1)*DPR) by[y*DPR,(y+1)*DPR). DPR2 means four subpixels,
  with no BOX average or resampling in numeric work.
- Wall samples cover three root-wall fill points and exposed side midpoints.
  Floor samples preserve the original unoccupied neutral-center selection.
- Seams use the existing7CSSpx shared-edge strip detector in raw physical
  pixels: native channel span<=2 and Web span>max(4,native+3) flags a seam.
  It still detects all four known historical seams in the old third board.
- Exact dark-border center-scanline runs are reported in CSS coordinates.
  Geometric and AA tolerances remain unestablished; differing runs are not
  silently accepted. Ten exterior root-boundary guards preserve the known
  off-board paint diagnostic.
- The gold-right white-bevel clip test uses the unchanged3x3 point set at
  every third_puzzle condition. All native and all Web physical subpixels
  must be exactly RGB255 for this exact-white check.

The historical444 seam checks specifically mean74third-puzzle joins times
three sizes times DPR1 times two Web repeats. The full20-condition matrix
contains1216 unique condition-specific join sites and2432 Web measurements.
These counts are reported separately to prevent misleading count equivalence.

physicalSampling.cropMappings gives exclusive native and Web physical crop
boxes for root corners and player/gold boxes. For a CSS crop[x0,y0,x1,y1],
the Web physical crop is[DPR*x0,DPR*y0,DPR*x1,DPR*y1]; the native crop is
the original CSS box. Any display enlargement must be labeled nearest-only.
No display crop or reduced image is fed back into numerical acceptance.

## Baseline validation

```powershell
python scripts/parity-static-compare.py --web-root docs/parity/evidence/web-static-integrated-v1 --output docs/parity/static-v4-analysis.baseline.json --validate-against docs/parity/evidence/review/static-integrated-v1-independent-check.json --require-complete
```

The comparator reproduces all15 shared summary fields of the prior
independent report exactly, including its known failures. List ordering
is normalized only for semantic case-name lists. Baseline equivalence
failure or loss of the four-seam positive control returns nonzero status.

| Baseline measure | Reproduced result |
|---|---:|
|Complete backing/fresh-state conditions|20/20|
|Qualified flat wall samples outside1|0/2780|
|Qualified flat floor samples outside1|7/426|
|Historical third DPR1 join checks|444;0 suspects|
|Full matrix join measurements|2432;0 suspects|
|Gold-right white-bevel CSS samples|72;all exact255|
|Historical third DPR1 white-bevel subset|27;all exact255|
|Differing border sides DPR1/DPR2|6/92|
|Cases with all10 nonblack exterior guards on native black|14|
|Known seam positive control|4/4 detected|

The seven baseline floor differences are retained at delta2: second800x600
DPR1/2 at(400,354),(454,300); third800x600 DPR1/2 at(400,354);
third1280x900 DPR2 at(640,532). They are not excused as AA because the
existing native-flat qualification admits them. The six DPR1 border-side
differences are on the two second-puzzle gold boxes across the three sizes.

Synthetic smoke controls also verify that an empty capture set cannot look
complete, a singleton Web image cannot qualify repeat stability, a1-channel
change in one of four DPR2 subpixels is retained, delta2 fails the unchanged
interior threshold, and native repeat variation remains unqualified.

## v4 execution

```powershell
python scripts/parity-static-compare.py --web-root docs/parity/evidence/web-production-candidate-v4/static --output docs/parity/static-v4-analysis.json --require-complete
```

The coordinator captured the immutable source archive `6427161`. The actual
report is `static-v4-analysis.json`; it remains the native1x comparison and
is not overwritten by later physical-framebuffer comparisons.

| Actual v4 measure | Result |
|---|---:|
|Complete backing/fresh-state conditions, repeated Web captures|20/20|
|Qualified flat wall samples outside1|0/2780|
|Qualified flat floor samples outside1|0/426|
|Historical third DPR1 join checks|444;0 suspects|
|Full matrix join sites / repeated measurements|1216 / 2432;0 suspects|
|Gold-right white-bevel CSS samples|72;all exact255|
|Historical third DPR1 white-bevel subset|27;all exact255|
|Differing exact border sides DPR1 / DPR2 against native1x|0 / 90|
|Cases retaining all10 old nonblack exterior guards|0|

The seven baseline floor differences and six DPR1 border-side differences
are absent from the actual v4 report under the unchanged criteria. This
does not turn the remaining90 native1x-versus-WebDPR2 border differences
into accepted differences.

## Raw DPR2 border evidence

```powershell
python scripts/parity-static-compare.borders.py --contact-sheet docs/parity/static-v4-analysis.crops.png
```

`static-v4-analysis.borders.json` records every raw RGB run around all90
differing sides. Each source image SHA256 is checked against the immutable
v4 report before reading. It includes all3 native1x repeats, both WebDPR1
repeats and both WebDPR2 repeats. Both physical scanlines crossing the
native CSS pixel are included, together with the comparator's original
scanline. No raw pixel is averaged or aligned.

All90 exact border supports repeat unchanged across every frame and both
WebDPR2 physical scanlines. All corresponding WebDPR1 supports equal native1x.
They comprise34 root sides,24 player sides and32 gold sides.46 sides shift
both endpoints by+0.5CSSpx without a width change;36 become0.5CSSpx thinner;
8 become0.5CSSpx thicker. The maximum endpoint shift is1CSSpx.

| Endpoint shift, start / end (CSSpx) | Width delta (CSSpx) | Sides |
|---|---:|---:|
|-0.5 / 0|+0.5|2|
|0 / -0.5|-0.5|12|
|0 / +0.5|+0.5|4|
|+0.5 / 0|-0.5|14|
|+0.5 / +0.5|0|46|
|+0.5 / +1|+0.5|2|
|+1 / +0.5|-0.5|10|

These are measured hard exact-color support changes, not a blanket AA
exemption. For first800 root right, native1x and WebDPR1 contain wall RGB
(210,209,210) at x641, exact border(36,36,36) over[642,645), and black
at x645. Raw WebDPR2 contains the full wall color through physical x1284
(CSS642), exact border over physical[1285,1291) = CSS[642.5,645.5), then
black at physical x1291. There is no intermediate blended edge pixel in
that transition. At third1280x900, gold right changes from CSS[677,680)
to[678,680.5), with full gold, exact(46,28,2) and exact white neighbors.

The complete adjacent RGB profiles are not all repeat-stable:3 native1x,
19 WebDPR1 and16 WebDPR2 source groups vary outside the exact borders.
Those raw colors remain in the report. Representative actual PNG crops
show unsynchronized colored particles around boxes; their variation must
not be mistaken for an unstable border or silently accepted by an AA rule.
`static-v4-analysis.crops.png` displays actual first800, second1001 and
third1280x900 corner/player/gold crops with nearest-only enlargement and
explicit physical scale labels. This supporting inspection is not the
independent reviewer's final visual approval.

## Quantization prediction

Read-only inspection of archived source `6427161` identifies three concrete
operations: `nativeFocusRect` uses `Math.fround(0.82)` and a truncated screen
center; `borderThickness` rounds thickness in physical pixels before dividing
by resolution; `originalDrawRect` truncates both physical endpoints. These
operations predict different CSS bounds at resolution1 and2 even for hard
axis-aligned quads. No AA explanation is needed for those bounds.

| CSS size | Root thickness at1x / Web2x (CSSpx) | Predicted right1x | Predicted rightWeb2x |
|---|---:|---|---|
|800x600|3 / 3|[642,645)|[642.5,645.5)|
|1001x733|4 / 3.5|[796,800)|[797,800.5)|
|1280x720|4 / 3.5|[931,935)|[931.5,935)|
|1280x900|5 / 4.5|[1003,1008)|[1004,1008.5)|

All four sizes' measured root bounds agree with these source predictions.
For example the1001x733 root has unrounded side601.0599947571754 and
x199.47000262141228. The right strip starts at796.5299973785877 with
thickness4 at1x, or797.0299973785877 with thickness3.5 at2x. Truncating
physical endpoints yields the two reported intervals exactly. This is
evidence of resolution-dependent geometry relative to native1x, and by
itself does not establish a defect against native's actual2x framebuffer.

There is a distinct unverified odd-viewport risk: at1001x733 CSS, truncating
the CSS center before multiplying by2 produces physical center(1000,732).
A native2002x1466 framebuffer's truncated center would be(1001,733). If
native physical behavior confirms that calculation, its border bounds may
be one physical pixel farther right/down than WebDPR2. This prediction
must be checked with a correctly sized native reference, without fitting
an alignment or changing production prematurely. The even800x600 matched
references do not settle this odd-size question.

## Matched physical framebuffers

```powershell
python scripts/parity-static-compare.physical.py
# Final completeness check after all actual references verify:
python scripts/parity-static-compare.physical.py --require-complete
```

`static-v4-analysis.physical.json` is separate from the unchanged native1x
report. It compares actual native PNGs with raw WebDPR2 PNGs at identical
framebuffer dimensions using the existing comparator at physical scale1.
There is no numerical resize, fitted shift or changed RGB1 threshold. Its
sample counts describe a separate physical condition set and are not
substituted for the original20-condition counts. Native capture/state and
resolution-request metadata must verify requested and actual sizes, fresh
moveCount0, no resampling and unchanged draw logic. SHA256 checks preserve
Web image and trace identity.

Current verified coverage is3/10 conditions: all three800x600 CSS scenes
against actual native1600x1200. All40 measured border sides match exactly,
including all23 formerly differing sides in those scenes. All native3/Web2
border repeats are stable;410 qualified flat wall samples and63 floor
samples have0 outside1, with178 join sites/356 repeated measurements and
0 suspects. `static-v4-analysis.physical-crops.png` shows actual paired
native1600/Web1600 root, player and gold crops at identical physical boxes.

The other7 attempted native captures currently have actual height1400,
despite requested1466,1440 or1800. They are explicitly rejected and are
not resized into the requested conditions. The remaining67 historical
border differences therefore remain unverified against matching physical
native references. The completeness command must fail until all10 valid
conditions are present. No production change is justified by the currently
verified matched-framebuffer border evidence.
