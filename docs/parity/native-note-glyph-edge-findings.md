# Native Note N20 edge: background compositing

2026-10-25. The apparent20px N edge discrepancy is fully explained by the gray void square underneath the glyph. It is not evidence of a font, wrapping, baseline, transfer or packed-atlas defect. The prior black-background inference sampled rectangle corners rather than the actual pixels beneath N and was incorrect. No production fix, alpha adjustment, brightness change, positional fit or test tolerance is needed.

## Observation

Reference: intro-third-tutorial-1280x720-native-v1-20261025/frame-0054.png, original1280x720, third_puzzle with settled camera. The unchanged atlas predicts raw N20 alpha115 at(115,586); the screenshot contains RGB158 there. The zero-alpha neighboring N column at(114,586) is RGB78. A visible gray square occupies exclusive bounds[107,571,128,591]. Its boundaries are independently readable on glyph-free row582 and column110; immediate outside samples are black. It overlaps the upper-left part of N while N's lower rows and rightmost columns have black behind them.

The earlier raw-alpha threshold bounds[116,586,243,600] compared against screenshot ink bounds[115,586,243,600] therefore compared different backgrounds. That test correctly preserved an observation but its unresolved-glyph interpretation was not justified.

## Hypotheses and experiments

H1: the packed atlas came from a different cached N20 raster. Supports: the actual tutorial and atlas archive came from different capture contexts. Conflicts: the source atlas was explicitly captured with its CharacterInfo UV generation. Test: extract N20 from original ASCII-v3 and both integer/fractional variety-v12 same-generation atlas files using their own recorded UVs, compare every alpha sample to the packed glyph, then test native controlled-black labels. Result: all three288-byte glyph alpha arrays are identical, SHA256 eafd83c9e3bc0d70f352bf49fdfe24fc11184390aef744cb3a8b023056028894. Both independent v12 actual GUI labels reproduce all288 N pixels on black exactly (576/576 combined). Rejected for this residual.

H2: a real background rectangle changes antialiased white text pixels. Supports: actual transparent N column reads gray78 in its upper part and black below; the screenshot shows a square partially underneath Note. Test: measure rectangle edges from glyph-free image locations, retain unchanged atlas alpha, and apply ordinary source-over per pixel with no estimated parameters. Result: all288 pixels in the16x18 N glyph rectangle match native RGB exactly, including all transparent and antialiased pixels. Confirmed root hypothesis.

H3: bilinear sampling, a subpixel transform or GUI shader transfer changes the N raster. Supports: recorded Font Texture filterMode is Bilinear and the raw-black prediction differed. Conflicts: prior integer/fractional captures share identical glyph alpha. Test: compare original controlled-black v12 native pixels directly to same-generation atlas, then apply only the measured background to the actual tutorial glyph. Result: controlled-black576/576 and real-background288/288 exact; no sampling shift or transfer adjustment remains necessary. Rejected as an explanation of this residual; no universal GUI shader conclusion is asserted.

## Exact evidence

At the reported pixel the source-over equation is round(255*115/255 + 78*(1-115/255)) =158. The evidence script uses the equivalent integer UNorm rounding expression (255*alpha + background*(255-alpha) +127)//255. The full comparison includes the background's right boundary atx128 and lower boundary aty591; treating each entire glyph row as one background initially produces14 mismatches, all outside the actual square, which disappear when the independently measured spatial boundary is respected.

Five archived settled-camera frames corroborate the same fixed glyph alpha under changing background: frame0025 background0 gives115, frame0033 background82 gives160, frame0040 background80 gives159, frames0049/0054 background78 give158. Actual glyph pixel and transparent neighbor both come from the original screenshot. The input camera fields are unchanged in these frames. No new native run, font request or diagnostic overlay is used.

Source Draw.cs:1202-1226 draws black, then DrawVoid, then DrawBlocks. DrawBlocks calls DrawControlsText at2473-2476. DrawVoid5528-5547 submits axis-aligned FullWhiteTex squares with voidParticle.color. UpdateVoid5493-5510 gives grayscale shades and short-edge-dependent sizes compatible with the observed square. This source order explains white caption text composited above a gray void square. The exact old-frame particle object identity and float state were not recorded; that identity attribution is source/image-supported rather than new private runtime telemetry. The measured background and288-pixel compositing equality do not depend on reconstructing particle state.

## Artifacts and scope

New evidence is in evidence/original/note-glyph-edge-archive-v1-20261025: analyze.py, analysis.json, exact source excerpts, context crop, nearest-neighbor diagnostic crop and complete SHA256 manifest. Run the script from any directory with Python and Pillow; it only reads committed archives/source and rewrites its own derived evidence directory. No fitting or tolerance is present.

No running game files, observer source/DLL, saves, Steam files, renderer, caption helper or font assets were changed for this investigation. The font helper and wrapped Note can keep their existing atlas/baseline geometry. Compare antialiasing over matched actual backgrounds and preserve void→caption draw order. Unrelated global GUI filtering, arbitrary-DPR behavior, other fonts and unobserved character contexts are outside the conclusion.
