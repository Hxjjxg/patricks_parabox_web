# Native backing color transfer (2026-10-25)

## Observation

The static-integrated-v1 review found seven flat floor samples exceeding its existing1/255 interior threshold by2. That immutable candidate predates the later endpoint-snapped backing/gradient quads. Its total delta cannot therefore establish the residual of the current renderer.

A separate exact center sample proves a still-current mismatch: native third-ticket-800x600-20261025/static-0.png at (400,300) is RGB94; Web static-integrated-v1/800x600-dpr1/third_puzzle/start.png is RGB95. Native samples at (400,320) and (400,327) are also94 versus95. The exact captured512x512 center-gradient texture has alpha0 at its center, so the center isolates the backing transfer.

## Hypotheses and experiment

1. Backing skips native HSVToRGBGUI half-color transfer. Source DrawBlock calls HSVToRGBGUI; Web computeBlockColor calls direct hsvToRgb. Native colors.json records computedV=.371558756 and rawGUI=.185779378. A half-color byte47 doubled by the GUI shader gives94, while direct full-color rounding gives95. Exact center PNGs confirm this prediction.
2. Gradient geometry differs because the old candidate predates the endpoint snap. This can explain an additional old off-center difference but cannot explain the alpha0 center. Current actual PNG capture must determine its residual.
3. Unsynchronized particles or different gradient blending produce all variation. Repeated flat native/Web samples and the alpha0 exact-center test reject this for the center backing mismatch. Blend quantization remains a possible separate off-center effect.

A regression invokes actual GameRenderer.drawLevel and captures its first fill submission with the recorded491.9999957084656px native focus. It failed before the fix:0x5f5f5f instead of0x5e5e5e. It passes after changing only computeBlockColor's RGB conversion to the already measured guiHsvColor helper. No additive offset, tolerance widening, texture edit, or camera change is involved.

## Verification and limits

Backing/goal/border focused suite:23 tests in3files pass; TypeScript typecheck passes. Native captures, exact GPU gradient asset, and prior evidence remain unchanged. Production build/dist are main-owned and untouched. A fresh actual PNG must independently assess all floor samples and colored recursive backings before claiming full parity or elimination of the original+2 residual.
