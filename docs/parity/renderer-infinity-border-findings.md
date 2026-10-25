# Native infinity border overrides

DrawBlockBorder3320 forces a complete yellow outline when a block is inside an infinity-zone level, has nonfilled contents, and is not special-effect12. Infinite-exit blocks force the same override regardless of that exemption. This override was missing from the Web normal edge-solidity border path, so open recursive worlds received no visible yellow boundary.

The four complete inside strips retain the native block border thickness. Color uses HSV(0.15,1,lerp(0.65,1,QuadOscillate(Time.time*0.3))), through the already measured GUI half-color transfer. Locked red still wins. The native special infinity outline is also permitted in QuickAnim, where normal borders are skipped. No edges are enlarged to hide seams.

Three new native override regressions failed before implementation and now pass: full open edges, special12 versus forced infinite exit, and exact oscillation extrema. The local quadratic expression follows native Util's decremented variable in both second-branch factors. The actual RRDown renderer regression now consumes production world.infExitPreviews from the core port rather than injecting its measured reference array; it still submits all four native root boards. The combined border/context/topology/shine focused run passes21 tests and typecheck. Parent owns the stable production bundle capture and independent PNG acceptance.
