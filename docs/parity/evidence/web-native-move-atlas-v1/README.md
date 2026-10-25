# Native Move atlas integration diagnostics

The final-800x600, final-1001x733, final-1280x720 folders contain actual fresh-controller Canvas readbacks at CSS dimensions equal to native physical dimensions, exact DPR1 backing, first_puzzle count0. Traces retain the reported floating browser DPR. These are development worktree captures while independent alternate-style work continued; they do not identify an immutable whole-renderer revision. Final production capture is still required.

The initial800x600 folder preserves the failed Graphics-local-subtexture sampling experiment (three high-alpha white pixels and unrelated atlas fragments). sprite-experiment-800x600 confirms standard Sprite frame UVs restore all39 Move white pixels. Final captures use the reusable Sprite pool; no diagnostic per-frame allocation remains.

Native Jost atlas glyph bytes and54Move pen placements /66GUI baselines have independent raw-data regressions. Undo?s12horizontal counterexamples remain unsupported and its existing text path remains open. Other font sizes/localizations and DPR2 raster equality are not established by this pack.

caption-mask-comparison.json compares thresholded actual image coordinates, not model predictions. At1001, four native-only pixels have original alpha239/236/238/237 composited over a gray60 ambient particle; Web shows the original alpha over black. At1280, three Web-only threshold pixels have alpha234/238/239 composited over gray75 particles, versus native black. The paired images are from different ambient times; these are not corrected by altering font alpha or placement. Full ambient-particle parity is separate from the glyph result.
