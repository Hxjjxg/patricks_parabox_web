# Self-recursive boundary infinite-exit performance fix

2026-11-02, working tree based on `fa2b3154`. Production change is only
`src/render/wallRendering.ts`, SHA256
`3547e22812ebbdff6e8b56a3204b2a4f411bbb3c322c3268e1f3fdbf799d62ba`.
Viewport 800x600, DPR approximately1, WebGL, normal animation/input settings,
particles enabled. No core logic, recursion limits, clips, geometry, or shader
math changed. Original installation/Steam files were not modified.

## Reproduction and source identity

Fresh `infexit_ref_first`: root level0 is7x7. Player Web21 is at(3,3),
with a filled sublevel1. Ordinary self-reference Web24 begins at(2,1),
points to level0, and is that level's ordinary exit. Infinite-exit tier0
reference Web23 is at(1,4), also pointing to level0.

- Push: `DLLDRRRR` puts24 at the right boundary(6,1), player(5,1), count8.
  Right pushes24 through infinity to(2,4), player(6,1), count9.
- Player exit: same setup, then `UR` puts player(6,2), count10, leaving
  self-reference24 at(6,1). Right exits through infinity to(2,4), count11;
  self-reference24 stays at the boundary.

Directions are screen directions (D=Down); harness keys are `saasdddd`
then `d`, or `saasddddwdd`. Inputs are explicitly synthetic keyboard
events sampled by the normal controller, on natural browser animation
frames. Repeats undo via the local debug API, then use another keyboard
Right. Each branch is repeated12 times after its first crossing.

Original and Web level files have the same SHA256
`3e4d7ab6b80928a2de84b26be8e512ce99a9c9be60c452b8cbdc001efdc25b38`.
Existing native `original/infexit-proven-crossing-20261025` proves the push
branch (native IDs20/23 correspond to Web21/24). Native screenshot capture
adds readback/PNG/write overhead; its frame deltas are not pure CPU times.
No native player-exit capture or native CPU/allocation/draw-count profile
exists. Source exit-loop unwinding supports the second branch, but fresh
original runtime/visual confirmation remains unverified.

## Demonstrated cause and change

The wall layer pool grows when new recursive representations become visible.
Each layer needs independent tint/transform uniforms, but formerly also
generated its own identical program. Pixi `compileHighShaderGlProgram`
constructs `GlProgram`; its unique SHADER_NAME suffix changes the program
key, defeating GL program reuse. Fresh shader-bit objects also occupy Pixi's
source-generation caches. WebGPU already deduplicated programs via `from()`.

Browser baseline:52 wall shaders/programs before the push,74 afterward,
with26 compileShader and26 linkProgram calls during that crossing. Exact
calls are in `program-sharing-experiment.json`. This driver-warm sample
did not reproduce the earlier80-92ms/444ms/1429ms draw outliers, so those
historical timings are not presented as a controlled before/after ratio.
Movement impulse in the retained baseline was4.9ms.

The fix caches one immutable GL/GPU program pair per renderer sampler
limit. Shader objects, uniform groups, matrices, and tint arrays remain
independent per layer. Default Shader.destroy() preserves the shared
program; per-layer disposal must not use destroy(true).

## Current measurements

`integrated-v2/trace.json` is the final run without concurrent tests/builds:
2836 natural frames,44 directional impulses, two branches each repeated12
times. No screenshots/readbacks occurred during these timings. Instrumented
renderFrame includes Pixi submission; counters add some overhead.

| Metric | Result |
| --- | ---: |
| rAF delta median / p95 / max |16.7 /16.8 /17.5ms |
| renderFrame median / p95 / max |2.2 /2.7 /7.4ms |
| movement impulse median / p95 / max |0.1 /0.4 /1.0ms |
| maximum drawLevel calls / scene layers |56 /205 |
| additional compileShader / linkProgram |0 /0 |

The first program was already initialized before GL counters started.
The run grows from25 wall shaders to108 while retaining one program.
Push traversal before/crossing/after peaks:51/48/27 drawLevel calls;
player-exit peaks:51/56/51. Respective renderFrame crossing maxima are
2.4ms and3.1ms; repeat-crossing maxima2.7ms and3.5ms.

After warmup, all12 push repetitions retain185 layers/43 masks/74 wall
shaders; all12 player-exit repetitions retain205/53/108. Blocks/levels
remain24/2 and settled phantoms0. Heap samples oscillate35.6-63.7MB;
initial/final heap43.4/47.9MB. Counters/recordings themselves allocate;
this is finite-run pool/heap evidence, not a GC-normalized leak proof.
No continuing resource-pool or program growth was observed in these runs.

`integrated-v1` is an earlier independent run (2838frames, max17.4ms rAF,
7.3ms renderFrame) made alongside Vitest, explicitly marked in its source
field. Three later recorder-start attempts observed no renderer and were
rejected before input. The recorder now synchronously reloads the world
before checking its hook. Neither failed attempt is counted as evidence.

## Visual and regression verification

- `visual-v1`:10 same-state pairs,20 actual Canvas PNGs, covering boundary,
  three motion phases and settled state in both branches. Synchronous
  legacy-program versus cached-program draws match all1,920,000 RGBA bytes
  per pair. These readbacks perturb timings and are separate from profiling.
- Independent visual review viewed all20 PNGs and six matching native
  push frames; see `visual-review.md`. Old-position and nested recursive
  copies remain visible. Player-exit original images remain unavailable.
- Actual GPU alpha regression retains all three non-HDR/unit/HDR cases,
  GL error0; see `gpu-alpha/trace.json`.
- New program-sharing regression fails on the retained pre-fix source:
 108 programs instead of1 (one failure/one pass). Current two cases pass,
  covering program variants, uniform isolation and layer destruction.
- `npm test -- --maxWorkers=1`:82 files/1197 tests pass, including existing
  original-conformance and infinite-exit/phantom suites.
- `npm run typecheck` and `npm run build` pass; existing large-chunk advisory.
- Independent source review found no current lifecycle/uniform blocker.

Reproducible drivers: `scripts/parity-self-recursive-exit-perf.js` and
`scripts/parity-wall-program-visual.js`. Run through DevTools against a
fresh dev page; use `scripts/parity-capture-sink.py` for retaining reports.
Scripts restore timing hooks in finally. Visual driver requires a captured
GameRenderer instance in `window.__reviewRenderer`; it does not alter core
world rules. JSON/PNG hashes are retained per capture directory.

This closes the demonstrated duplicate wall-program compilation defect.
It does not establish full milestone parity, native player-exit visual
parity, all viewport/backend performance, or an unbounded memory guarantee.
