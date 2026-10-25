# Native auxiliary texture readbacks

The 48 production PNGs in native-aux-texture-manifest.json are byte-identical copies of the original game's neutral GPU readbacks, not CPU DXT reconstructions. The sources are the complete gpu-wallbig-keyboard-v2-20261025 capture (26 WallBig quadrants and five GUI icons) and gpu-eyes-buttons-gradient-20261025 (17 gradient, goal, eye and movement-icon textures).

Both captures ran the injected debug game with Gamma active color space on Direct3D11, a Linear render target, RGBA32 linear readback, GL.sRGBWrite false, and the original Bilinear / Clamp sampler. Each source format, field, index, dimensions and file mapping is preserved in the manifest and original capture metadata.

The test locks the source PNG SHA-256 as well as the decoded production RGBA SHA-256. This detects silent replacement of source evidence and differences from native GPU decompression, while allowing harmless production PNG recompression. No blanket RGB correction is used.

The manifest also records different pixel counts against previously tracked production files where those existed. All 48 source/production byte comparisons and 49 focused conformance tests passed when this module was committed. Rendering use remains covered separately by WallBig, face, tutorial and floor renderer modules.
