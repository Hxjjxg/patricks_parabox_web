# Additional odd-axis physical focus probe

This is an additional discriminator at CSS 1001x699, DPR 2. It does not
replace the original 20-condition matrix or any of its seven unsupported
large native framebuffer conditions. Historical v4 reports remain unchanged.

## Actual before evidence

Native reference:
`evidence/original/native-framebuffer-2002x1398-first-puzzle-v15-20261025/`.
`capture.json`, `resolution-request.json` and all three PNG dimensions verify
an actual 2002x1398 framebuffer, unchanged draw logic and no resampling.
`state.json` records first_puzzle, moveCount 0 and an empty trace.
`colors.json` records native focusGeometry exactly:

```text
[1001, 699, 1146.3599900007248, 1146.3599900007248]
```

Frozen Web before:
`evidence/web-production-candidate-v4/odd-dpr-before/1001x699-dpr2/first_puzzle/`.
Its trace identifies `6427161 immutable v4 before odd-axis fix`, confirms
CSS 1001x699, actual canvas2002x1398, and fresh nonmoving start/end states.

```powershell
python scripts/parity-static-compare.odd-probe.py --web-dir docs/parity/evidence/web-production-candidate-v4/odd-dpr-before/1001x699-dpr2/first_puzzle --output docs/parity/static-v4-analysis.odd-probe-before.json
```

The JSON records input SHA256, raw RGB runs and every border endpoint.
All three native frames and both Web frames have identical border supports.
All 12 root/player/gold sides differ by exactly -1 physical pixel at both
endpoints. The horizontal and vertical measurements together establish a
Web translation of(-1,-1) physical pixels, with no thickness difference.
Examples, all exclusive raw physical intervals:

| Side | Actual native | Frozen Web before |
|---|---|---|
|Root left|[427,434)|[426,433)|
|Root top|[125,132)|[124,131)|
|Root right|[1567,1574)|[1566,1573)|
|Player left|[755,760)|[754,759)|
|Player bottom|[939,944)|[938,943)|
|Gold right|[1405,1410)|[1404,1409)|

No image alignment, numerical resampling, tolerance or arbitrary corrective
offset is used. This observed translation confirms the prior source
hypothesis for the additional odd-axis probe.

## Source and regression

Archived source `6427161:src/render/focusGeometry.ts` truncates the center
in CSS pixels. At 1001x699, that gives(500,349) CSS, or(1000,698) physical
at 2x. Native truncates its actual framebuffer center to(1001,699).

The focused fix adds an optional resolution argument and computes each
center as `trunc(cssExtent * resolution / 2) / resolution`. Resolution is
normalized with the existing integer-device-scale helper. The board size
continues to use the same `Math.fround(fraction)` product; scale and offset
arithmetic remain in the existing coordinate system. Default resolution 1
preserves native 1x truncation, and even CSS dimensions at 2x retain their
prior center.

API ownership handoff:

- `nativeFocusRect`: resolution is the optional eighth argument; fraction
  remains the seventh argument, default 0.82.
- `quickAnimFocusRect`: optional ninth resolution argument forwards to the
  same center helper, retaining its existing 0.105 fraction.
- The coordinator owns GameRenderer normal/quick callsites and runtime
  recapture. No GRID/TUI geometry or other alternate style is changed here.

`tests/focusGeometry.physicalProbe.test.ts` embeds the actual native focus
values and raw backing draw bounds. Before the helper fix the regression
failed with received [1000,698] versus actual [1001,699]. After the helper fix,
the native focus size and physical draw bounds [427,125,1147,1147] match.
Native1x odd-center and verified even 800x600 controls also pass. The focused
focus/physicalProbe/cloneFocus/cameraFlip run passes 4 files/13 tests.
The coordinator reports integrated validation passed 57 files/882 tests and
typecheck after wiring the normal and quick resolution callers.

## Actual after result

Actual after directory:
`evidence/web-odd-dpr-camera-after-dev/1001x699-dpr2/first_puzzle/`.
Its trace identifies `6427161 + physical center helper/callsite fix; bounded
dev after`. It preserves the frozen before capture and verifies the same
actual 2002x1398 backing with fresh nonmoving start/end states.

```powershell
python scripts/parity-static-compare.odd-probe.py --web-dir docs/parity/evidence/web-odd-dpr-camera-after-dev/1001x699-dpr2/first_puzzle --output docs/parity/static-v4-analysis.odd-probe-after.json --require-exact
```

The exact command exits 0. All 12 root/player/gold border intervals now equal
native's raw physical intervals, with endpoint shifts[0,0] at every side.
All 3 native and 2 Web border repeats remain identical. The former(-1,-1)
translation is absent without resampling, registration or new tolerance.

`static-v4-analysis.odd-focus.crops.png` is inspected offline and displays
actual native, frozen before and DEV after in three columns using identical
exclusive physical boxes. Root bottom-right[1560,1258,1580,1278] uses
nearest-only display enlargement 8x; player[747,772,928,953] and gold
[1238,609,1419,789] use 2x. The input SHA256 and exact crop mappings are
embedded in PNG metadata. The native and after hard border positions match;
the before root corner and box edges visibly sit one physical pixel left/up.
Colored particles outside the boxes remain unsynchronized and are not
globally accepted by this focused geometry check. This is supporting
inspection, not independent final visual approval.

**DEBUG scope:** The focused actual-after verification is complete. The 7
original matrix cases requesting 1466/1440/1800-high native
framebuffers remain unsupported by the current 1400-high desktop limit.
Their mismatched native captures remain explicitly rejected. This additional
1398-high probe confirms the center rule; it is not a substitute for those
conditions or a claim that the full matrix is complete against native2x.
