# Native physical framebuffer reference DEBUG

## Observation

Web DPR2physical hard edges differ from scaling native1xCSS references.
Those1xreferences cannot decide whether physical-pixel quantization is
correct. The existing native observer accepts CAPTURE:level:width:height.
It calls Screen.SetResolution(width,height,false) and captures three actual
ScreenCapture.CaptureScreenshotAsTexture frames after normal scene settle.

## Hypotheses

### H1: actual native2xframebuffers are supported (ROOT HYPOTHESIS)

- Supports: existing in-process resolution captures work at lower dimensions.
- Conflicts before test: requested height may exceed the monitor/window bounds.
- Test: request1600x1200first, compare native Screen and all three PNG IHDRs.
- Result: actual1600x1200and3/3PNGs1600x1200; no clamp observed.

### H2: later requested dimensions are clamped by the host

- Supports:2560x1800may exceed current display bounds.
- Conflicts: first1600x1200success shows height is not restricted to prior1x.
- Test: record actual Screen and all PNG dimensions independently per case.
- Contract: preserve unsupported requests; never resample or bypass OS limits.

### H3: high-resolution scene state differs from native1xfresh baselines

- Supports: stale scene/camera/history could invalidate a visual reference.
- Conflicts: existing capture calls World.GoToLevel and waits scene/camera settle.
- Test: exact state comparison excluding requestId; confirm zero moves/history.

## Experiment

Ten requested scenes, three actual PNG repeats each:
1600x1200,2002x1466,2560x1440first/second/third;2560x1800third.
No setup/timed commands, no save override, no CUA/OS/window workaround, no
production renderer changes. Existing native draw and capture logic are used.

The helper only sends existing commands, reads actual results and records
provenance. ResumeVerified skips an already captured ID only after checking
its request, Screen/PNG agreement and three PNGs; it never recaptures that ID.

## Results

- Ten scene requests produce30actual native PNGs; all Screen/PNG sizes agree.
-1600x1200first/second/third apply exactly:3eligible requested scenes,9PNGs.
-2002x1466first/second/third actually render2002x1400:3unsupported requests.
-2560x1440first/second/third actually render2240x1400:3unsupported requests.
-2560x1800third actually renders2240x1400:1unsupported request.
- All10state snapshots exactly match original800x600fresh snapshots after
  excluding only requestId; moves/past/future remain zero, winning false.
- All30PNGs are nonblack. Animated repeat differences are recorded per image.
- All captures use the already deployed V14observer, without any Plugin edit.

## Conclusion

H1 is confirmed only for1600x1200in this host windowed session. H2 is confirmed
for the seven larger requested scenes; these remain explicit unsupported
resolution diagnostics and are never substituted for requested DPR2references.
The exact cause of host clamping is not inferred beyond observed actual size.
H3 is rejected by exact full state equality in all10cases.

Nine genuine1600x1200reference PNGs close the800x600CSS/DPR2native-reference
gap. Native references at2002x1466,2560x1440and2560x1800remain unavailable
under the tested conditions. None are simulated or resampled.

After collection, an existing CAPTURE:third_puzzle:800:600housekeeping command
restores native PID35316to800x600. Its audit is retained separately and its
three native-only raw PNGs are not part of the10scene/30PNGreference matrix.

The helper's first metadata attempt hit PowerShell array-division precedence;
parenthesizing both scalar divisions fixed it. ResumeVerified then skipped
the already completed first capture; no native image was overwritten.

Validation: python scripts/parity-original/summarize-physical-framebuffers.py

Index: docs/parity/evidence/original/physical-framebuffer-native-index.json

## Additional odd CSS axes discriminator

At the parent's request, one additional fresh first_puzzle scene is captured
at requested2002x1398. Native Screen and all3raw PNGs apply exactly. This
corresponds to1001x699CSS at DPR2, with both logical axes odd.

Actual native colors.json focusGeometry is
[1001,699,1146.3599900007248,1146.3599900007248], focusBlockIndex0.
The CSS-truncation-before-DPR center candidate[1000,698] is therefore rejected
for this actual surface; native is(+1,+1)physical pixels from that candidate.
The native camera/draw code is unchanged. Exact fresh state equality and all
three native PNG checks also pass through the existing validator.

This additional discriminator is indexed separately in
physical-framebuffer-odd-css-axes-index.json. It does not replace any of the
original10matrix cases or close the unsupported1466/1440/1800surface gaps.
