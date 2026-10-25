# Shed landing axis: native single precision

Reference: `original/shed-focused-motion-20261025`, fresh `shed_first`, setupRRRRU thenU. The player exits the3x3 inner level and the former shell moves down. Source inspected through dnSpy: `Projection.ComputeProjection`, `Block.UpdateAnimation` in `Assembly-CSharp.dll`.

Native exit projection assigns `xscale /= fromLevel.width` and `yscale /= fromLevel.height` to float fields before computing the offset. Native landing uses a strict `Abs(DrawXOffsetStart) > Abs(DrawYOffsetStart)` comparison.

Web double precision initially produced X=-0.3333333333333333 andY=-0.33333333333333337, selecting the wrong Y landing axis. Preserving native float assignments for the two exit scale divisions produces X=-0.3333333432674408 andY=-0.3333333283662796, selecting native X without changing the comparison or adding an epsilon.

Added306 native measured phase assertions over10 scenarios. Before the fix, seven shed halt samples failed after correcting a test setup omission: pure tests must supply the settled identity `used*` context normally written by native Draw/the production renderer. All306 assertions pass after the two-line precision fix. Native values, filenames and raw source SHA256 are retained in `tests/fixtures/original-mechanic-phases.json`.

Independent actual Canvas follow-up: `web-backing-shed-v1/shed` at800x600/DPR1, including periodic50ms PNGs. Sixteen bracketed image records were directly inspected; native phase counterparts cover the corrected X-axis halt through0.1443672s. All38 bracketed state checks agree; procedural offset/scale maximum residual3.56321e-8 and camera1.42858e-8. Later Web halt images remain visually unverified because the native capture ended earlier. Unrelated goal tint and renderer defects remain open.
