# Original wall texture provenance

`wall_main_0..47.png` and `wall_flip_0..47.png` are exact, unmodified RGBA32
readbacks from the original game's `Draw.WallTiles` and `Draw.WallTilesFlip`.
They were captured on 2026-10-25 from the debug installation using Direct3D11
in Gamma color space, linear RenderTexture/readback, and `GL.sRGBWrite=false`.
Dimensions remain 200×200; no resizing, tint, RGB offset, or alpha adjustment
was applied.

Authoritative evidence and per-file SHA-256 hashes:

- `docs/parity/evidence/original/gpu-walls-all-20261025/capture.json`
- `docs/parity/evidence/original/gpu-walls-all-20261025/pixel-diff-and-hashes.json`

The earlier AssetRipper PNGs used a CPU DXT decoder whose rounding differs
from this original runtime's GPU. The complete readbacks preserve these
per-texel RGB **and alpha** differences. For example, native wall 12 has neutral
`194,193,194,255` and gray bevel `140,142,140,255`; this is not a uniform +1
correction. The evidence identifies the measured runtime/graphics device; it
does not claim all GPU vendors decode compressed textures identically.

`tests/wallTextureConformance.test.ts` decodes PNG scanlines and verifies every
RGBA pixel against the captured set, as well as the original reference hashes.
