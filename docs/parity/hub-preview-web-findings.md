# Original Hub preview texture bodies

Date:2026-10-25. Native evidence is f68f629 and [hub-portal-rendering-native-findings.md](hub-portal-rendering-native-findings.md).

The rounded blue portal placeholder omitted the original cached puzzle PNGs. All368 shipped128×128RGBA preview files are now copied losslessly under src/assets/level-thumbnails. A regression recomputes the full native filename/hash catalog and verifies exactly9f0cd990824649715c688d9193a0b1d872e6b1cd627639b15e1d113c0dd28ad6. Textures use clamp and bilinear filtering.

The renderer draws previews across the full one-cell rectangle, opaque at normal brightness for won/unlocked portals and with the source .16RGB multiplier for locked unsolved ones. Hard/visual categories retain native full-cell colored underlays and80percent centered previews. Native pixel-endpoint truncation is reused. Four actual drawFloor tests fail before the texture port, and asset/category tests cover the additional source rules.

Actual first integration revealed inherited gradient alpha.16 in Graphics.texture, producing blue translucent images despite correct texture bytes. Four explicit native-opaque assertions fail before a single draw-state reset. The corrected branch sets white fill/alpha1 before submitting textures; assets, geometry and tint are unchanged. The initial translucent output remains preserved rather than counted as a pass.

Actual800×600/DPR1 evidence under evidence/web-hub-preview-after-dev:

- third-only-win:19rAF/3PNG, initial translucent intermediate output.
- third-only-win-opaque:20rAF/3PNG, corrected opaque preview bodies.

Both use the native third-win save state (only third_puzzle won), recent third portal, player(4,5) at rest. Native original/intro-third-win-held-native-v1-20261025/frame-0096.png is used only for static scene layers; its player is midarrival, so no exact player-frame claim applies. Example locked edge(380,255) is native34/34/34 versus Web34/35/34; won/unlocked edges differ by1–2 channels at some locations. Those remaining raster differences are not silently offset or declared exact.

The browser preloads the small1,339,204-byte thumbnail catalog during existing asynchronous application initialization, avoiding asynchronous texture changes during a playing frame. This differs from native synchronous resource loading limited to30attempts per draw. Settled previews and byte provenance are checked here; startup timing equality is not claimed.

Connections, pulsing markers, shortcut count text/animation, portal shadows and paused reference labels remain independent open Hub rendering layers. Final immutable production capture and independent integrated review remain required. This module is a bounded body-texture restoration, not whole-Hub approval.

Validation: 59 test files / 927 tests pass; typecheck and production build pass. The seven portal-body tests include the deliberately failing-before texture and inherited-alpha cases. Independent review and immutable integrated capture remain pending.
