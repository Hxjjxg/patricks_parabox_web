# Independent frozen-v7 clamp review

Reviewed on 2026-10-25, filesystem only. Frozen production commit: `e04a40c5ee352bef46cb3fb309675a32f953cd67`. This review releases the observations and reproducible evidence below, not a full visual-parity approval.

## Viewed evidence and provenance

I viewed these seven whole 800×600 PNGs at original detail, followed by the unscaled `review-v7-clamp/native-v7-static-crops.png` plate:

- Native: `docs/parity/evidence/original/third-baseline-settled-20261025/static-0.png`.
- Frozen v7: `docs/parity/evidence/web-production-candidate-v7/cardinal/third_puzzle-D/start.png`, and the corresponding `L`, `R`, `U` start PNGs.
- Frozen v7: `docs/parity/evidence/web-production-candidate-v7/static/800x600-dpr1/third_puzzle/start.png` and `end.png`.

Full paths and SHA-256 values are in `evidence/review-v7-clamp/manifest.json`; exact measurements, capture options, trace hashes and sampled pixels are in `metrics.json`. The final grouped cardinal paths refer to byte-preserving archive moves. The static end SHA-256 is `2d7473e4f6a6c35306de2105e6ebbb4ec4788052ea11c7b78211e8c48cd0d256`; native SHA-256 is `88aeac94e7f5653b6e58e42c3ce4268907197fee9eb424eda05d5522df80cb78`.

Each reviewed PNG and trace matches its capture-folder `sha256.json`. Each trace provenance matches the frozen head and build-manifest SHA-256 `81f5499c87cca7fb9aea79080581b988baad6b55bd48d6f163c282310b7a4bf2`. The build records matching before/after heads, stable source and no changes. The `wallRendering.ts` captured/current working SHA-256 is `d05c138db2dbbfac5fcd0135a3adfdf0248625195bf6405d73a223a93dadd199`; frozen Git-blob SHA-256 is `cf98f444e002fd2e581af1a78b16eccf795956ee0f7a3d76ab0ace6f34e5def5`. Their bytes match after CRLF-to-LF normalization (working 170 CRLF, Git zero); this is newline encoding, not source-content drift.

Metadata caveat: cardinal `options.revision` retains the stale descriptive string `6427161 immutable v4 archive`. Source identity here is established by the independently verified trace provenance, hashed build manifest and frozen source, not that string.

All starts record fresh `third_puzzle`, move count 0, player `(2,4)`, settled camera at `(0,0)` with unit scales; nominal DPR 1 and physical 800×600 (trace DPR `1.0000000298023224`). Cardinal traces record direction input at 0 ms, held 40 ms, settle 650 ms, but only their **start** PNGs are reviewed here. The no-input static capture records settle 180 ms and 13 trace frames.

## Fixed-region result

All six v7 PNGs give the same results against the native reference. ROIs are fixed half-open `[x1,y1,x2,y2]`. V6 values are independently recomputed from its frozen static end PNG. No shifts, scaling, resampling, fitted masks or tolerance changes are used.

| Region | ROI | V6 nonexact / max channel difference / pixels >1 | V7 nonexact / max channel difference / pixels >1 |
|---|---|---:|---:|
| Top bevel | `[184,84,452,150]` | 331 / 1 / 0 | 331 / 1 / 0 |
| L-corner | `[414,298,612,340]` | 44 / 17 / 4 | 41 / 1 / 0 |
| Lower notch | `[303,370,443,456]` | 74 / 20 / 10 | 66 / 1 / 0 |

The larger L-corner and notch outliers are absent from every reviewed v7 sample. **No AA/edge acceptance tolerance is established: all remaining one-byte edge residuals, including the 41 L-corner and 66 notch pixels, remain unresolved and unapproved.** The existing flat-interior one-byte allowance does not extend to edges. `metrics.json` records every nonexact coordinate/RGB value for static end.

At `(428,321)`, native and v7 are both gray 190. At `(323,382)`, native is gray 214 and v7 gray 213. Nearby background grays 93/88 and white 255 remain exact. The sampled left/right panels, two white-highlight interiors, gray bevel and magenta fill are exact in all six PNGs. Yellow-fill ROI `[379,170,422,211]` has 1,763 one-byte differences (native RGB `255,183,53`, v7 `255,183,54`), within the previously established flat-only allowance.

## Visual observation and limits

The actual whole PNGs and unscaled plate retain aligned outer frame, top bevel, L-corner, lower notch, goals, player and yellow box. I see no gross adjacent geometry regression in these samples. Ambient/colored particles differ; whole-frame identity is not claimed.

This review does not approve cardinal end/motion phases, infexit motion, any other scene or viewport/DPR, time-aligned animation, the full capture matrix, or overall game parity. It does not independently rerun the production GPU clamp experiment. No UI/browser/page input, native process activity, deployment, production-source change, staging or commit was performed for this review. Only this report and `evidence/review-v7-clamp/**` were written; earlier released artifacts were preserved.
