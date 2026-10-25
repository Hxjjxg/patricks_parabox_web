# Flip timing diagnostics

`profile.json` records reversible prototype instrumentation of actual Vite
renderer methods at800×600. It is a development diagnostic, not a frozen
production or final visual approval. The imported module URL was
`/src/render/GameRenderer.ts?t=1792890665039`; the source file hash read just
after this experiment was
`fc5e0ee135b96adbc663e71283f844da234b75b078b79ec043a0c5f29c4e2e8b`.
Later source edits do not retroactively describe this run. The first failed
attempt imported a distinct bare Vite URL and recorded zero instrumented
rows; the corrected experiment selected the actual loaded resource URL.
All wrappers were restored after sampling.

Actual234draws/116renderFrame calls: draw CPU median2ms/max6.2ms; full
renderFrame median4.1ms/max243.4ms. Scene layers88–403, masks46–184. Draw is
also called by UI synchronization, so234draws is not234presented frames.
The method-level CPU result does not explain GPU/compilation/readback stalls
by itself, and no arbitrary recursion depth reduction is justified.

`production-no-png.json` uses the same immutable bundle as
`../web-production-candidate-v2/build-manifest.json`, fresh exact level URL,
RR setup then physical Down40ms. It samples natural rAF without any PNG
readback during motion. There are77frames over1.78s: median16.7ms,
maximum183.3ms, four intervals above50ms. Therefore the5-frame clean PNG
capture's300–883ms intervals cannot establish universal5FPS natural pacing.
PNG readback substantially amplifies stalls. Four natural long frames remain
observed; their cause is still open, not declared fixed by this experiment.
