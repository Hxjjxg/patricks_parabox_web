# Actual high-resolution native framebuffer references

Ten requested scenes were captured through the existing in-process
CAPTURE:level:width:height command. ConfigureCaptureResolution calls native
Screen.SetResolution(width,height,false). The original capture routine loads
a fresh scene, waits at least0.8seconds and camera settle, then saves three
actual ScreenCapture.CaptureScreenshotAsTexture PNGs at WaitForEndOfFrame.
No native draw logic, CUA, OS window override, fullscreen mode or resampling
is introduced.

| Requested framebuffer | Scenes | Actual native Screen and PNG size | Eligible requested reference |
| --- | --- | --- | --- |
|1600x1200|first,second,third|1600x1200|yes,3scenes/9PNGs|
|2002x1466|first,second,third|2002x1400|no,3clamped requests|
|2560x1440|first,second,third|2240x1400|no,3clamped requests|
|2560x1800|third|2240x1400|no,1clamped request|

All30native PNG IHDR dimensions independently agree with native Screen.width/
height. All images contain substantial nonblack rendered content. All10state
snapshots exactly equal the original800x600fresh first/second/third snapshots,
excluding only requestId. Move count, past and future are zero; winning false.

## Eligible DPR2surface

The800x600CSS/DPR2comparison now has genuine1600x1200native reference
triplets for first,second and third. Their IDs are:

-native-framebuffer-1600x1200-first-puzzle-v15-20261025
-native-framebuffer-1600x1200-second-puzzle-v15-20261025
-native-framebuffer-1600x1200-third-puzzle-v15-20261025

Each directory contains static-0.png,static-1.png,static-2.png, capture.json,
colors.json focus/geometry trace, exact state.json, requested-versus-actual
resolution audit, observer build identity and SHA256hashes.

Native idle raster differences remain intact across repeats. The eligible
first triplet changes15210/24854pixels versus frame0; second14085/27165;
third8804/18163. The index retains changed-pixel counts/bounds/channel maxima
for every image. No temporal averaging, replacement or image equalization
is applied. Static hard-edge comparison should use the complete triplets.

## Unsupported requests remain open

The21PNGs from seven clamped requests are honest native diagnostic captures
at the actual dimensions in the table. Their index/manifest entries explicitly
set dpr2ReferenceEligible=false and status=unsupported-requested-resolution.
They cannot validate Web1280x720,1001x733or1280x900CSS/DPR2surfaces at their
requested native dimensions. The reference gap at those sizes remains open.

Clamping is an observed limit in this native windowed session; the evidence
does not identify a universal native rendering capability limit or the exact
host reason. No workaround or simulated2xreference is used.

After collection the native window is restored to800x600through the existing
capture command. The separate housekeeping audit is
physical-framebuffer-session-restore.json; it is not one of the10scene cases.

Index: docs/parity/evidence/original/physical-framebuffer-native-index.json

Capture helper: scripts/parity-original/capture-physical-framebuffers.ps1
with a new capture-ID revision, or ResumeVerified for already audited IDs.

Validation:

    python scripts/parity-original/summarize-physical-framebuffers.py

## Additional odd-axis camera discriminator

One additional first_puzzle triplet at2002x1398applies exactly in native
Screen and all three PNGs. Its logical1001x699CSS/DPR2surface has both odd
axes and stays within the observed window limit.

Native colors.json records focusGeometry
[1001,699,1146.3599900007248,1146.3599900007248], focusBlockIndex0.
Its actual physical center[1001,699] differs by[1,1]from the proposed
CSS-truncation-before-DPR center[1000,698]. This actual native geometry
rejects that candidate for this viewport without altering native camera code.

The three PNGs, fresh state and geometry are retained under
native-framebuffer-2002x1398-first-puzzle-v15-20261025. The separate index is
physical-framebuffer-odd-css-axes-index.json. Capture with the same helper's
OddCssAxesOnly switch and a new capture-ID revision.

The original ten-case matrix remains unchanged. This is additional
discriminator evidence; none of the seven unsupported requests receives
substitute coverage credit.

The native window is restored again to800x600after this discriminator.
Both housekeeping restore events remain in the session-restore audit;
their native-only PNGs are excluded from reference counts.
