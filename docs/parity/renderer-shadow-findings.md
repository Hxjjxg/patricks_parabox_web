# Native renderer shadow findings

The original ticket pass submits direct child shadows before walls and nested boxes. The Web renderer previously emitted only nonfilled box shadows during the child pass, which painted a gold shadow over an already drawn neighboring white wall.

The replacement uses twice the native border thickness, a one physical pixel offset when both dimensions are below 13 physical pixels, horizontal mirroring and fadeFlipH, and the original logical right/down/diagonal wall cull. Shadows are omitted for blocks enclosed by a 1 by 1 level. Filled boxes cast shadows as well.

Wall shadows use the normal autotile alpha silhouette. Clipping is applied to the snapped quad with the matching UV subset; cropped Texture views are reused across frames. QuickAnim suppresses this pass.

Independent actual PNG review in docs/parity/evidence/review (gold-shadow-clip-controls-v2.json and v3 shadow/border metrics) established the old overlap failure. In v3 all 27 sampled white wall points are exactly RGB 255,255,255, the lower wall shadow is visible, all 36 border samples remain exact, and 444 wall join checks contain no seams. The five focused tests cover geometry, culling, clipping and the actual drawLevel pass order.
