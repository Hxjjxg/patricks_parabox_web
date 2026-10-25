# Native wall HDR / alpha compositing regression

2026-10-25. This module follows production ac5afc3 and the independently
confirmed final-v6 curved-edge finding. It corrects the dominant brightness
error without changing geometry, UVs, textures, alpha upload, input or timing.

## Evidence and root cause

Independent native static0/1/2 neighborhoods repeat byte-exact. At (428,321),
original is190 and v6 is207; at (323,382), original is214 and v6 is234. The
source/asset audit in `third-corner-edge-findings.md` derives literal float32
root geometry, snapped tile quads and unshifted bilinear UVs. White source
samples predict the dominant difference from HDR color versus alpha-coverage
order. Different local backgrounds are rejected within measured support;
premultiplication-before-filtering alone is not identifiable from these white
samples. No fitted UV shift or texture replacement follows. The exported
AllBlocks shader is dummy text and is not treated as native blend-state proof.

The existing shader preserves HDR tint until after texture sampling, which is
necessary for native opaque gray/bevel/highlight colors. It previously allowed
premultiplied fragment RGB to exceed alpha before blending. Native straight
RGB clipping before source-alpha composition is represented by constraining
final premultiplied RGB to alpha after texture*tint. Both GLSL and WGSL add this
fragment-end bound; uniforms and vertex multiplication retain HDR precision.
The shared Hub-caption and separator layers retain their original sampling,
colors, geometry and ordering. This does not claim actual WebGPU execution.

## Real GPU regression

`scripts/parity-wall-alpha-browser.ts` creates a separate offscreen WebGL app
and uses the actual production `createWallShader`. It does not touch game state.
A nearest-sampled premultiplied white texture over opaque black has coverage
bytes0,64,128,192,255. For HDR tint2, source RGB is clipped to1 before coverage,
so expected output is the same coverage sequence. Exact low-tint and unit-tint
controls guard ordinary colors and opaque pixels. No screenshot AA tolerance
is involved.

Run from an existing Vite page in DevTools:

```javascript
const regression = await import('/scripts/parity-wall-alpha-browser.ts');
await regression.runWallAlphaRegression();
```

Actual retained `evidence/wall-alpha-clamp-regression/before.json` fails the HDR
row with0,128,255,255,255 while both control rows pass. `after.json` passes all
three exact GPU cases with glError0. These are three browser GPU regressions,
separate from the1189 existing Vitest cases. The script and source fingerprints
are retained; the test does not assert a copy of a CPU implementation.

## Actual Canvas and remaining limits

The unchanged800x600 static contract was recorded into
`evidence/web-wall-alpha-clamp-after-dev/third-800x600-dpr1`. It is explicitly
uncommitted dev evidence, not relabeled frozen-v6 output. Raw trace and PNG
hashes and all five capture/source fingerprints verify. Actual timing retains
only1rAF record/2PNG under resource pressure; no motion/pacing credit follows.

`comparison-first.json` records unshifted native/v6/new ROIs. L-corner maximum
channel difference falls17->1 and four pixels above1 fall to zero; lower-notch
maximum falls20->1 and ten pixels above1 fall to zero. The first anchor now
exactly matches190; the second is213 versus native214. There are still41/66
nonexact pixels respectively, all differing by1. **No new edge tolerance or
AA approval is introduced.** Residual byte differences, other scales/motion,
shared Hub visuals and final immutable integration still require validation.

## Verification and failed attempts

Initial concurrent checks hit Windows VirtualAlloc errno1455/out-of-memory
and Vitest fork-spawn errors. Their full attempt1 logs are retained without
pass credit. The console also reported26 ERR_INSUFFICIENT_RESOURCES failures;
placeholder/readiness guards failed before input/capture and earn no evidence
credit. Three completed owned diagnostic services were stopped; no unrelated
user process was killed. After resource release the actual game initialized.

Sequential verification with GOMAXPROCS2 and Vitest maxWorkers1 passes all
80files/1189tests without exclusions, then typecheck/build pass. Source hashes
for all1005 production files remain unchanged across these checks;142built
files are fingerprinted. `verification-commands.json`, `verification-source.json`
and complete logs retain exact commands/results. Only the existing chunk-size
advisory remains. Native font sizes13/18/intermediate and unavailable native
framebuffer conditions remain unresolved; full parity acceptance is incomplete.

Independent follow-up in `final-note-static-review.md` directly views native,
new start/end and unscaled paired ROIs, verifies source/capture hashes, and
reproduces all reported residual counts. Seven flat interior ROIs and nearby
gray/white samples are unchanged, with no observed broad adjacent regression.
The remaining1byte differences, top ROI331nonexact pixels and static-only
1rAF limitation remain explicit. This is not full final-source image approval.
