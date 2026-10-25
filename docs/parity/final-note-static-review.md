# Final-v6 Note and static image review

Offline review of production ac5afc3af2832c2aaa95d48b1cf6d836d1c1fadc, archive be36d4b. No UI, native process, input, deployment, source edit, staging or commit. This is a bounded image review, not whole-matrix or universal pixel approval.

## Images actually viewed

I viewed all nine specified originals at original detail: native/final Note PNGs at800×600,1001×733,1280×720; the actual supplied note/native-final-crops.png; native third-baseline-settled-20261025/static-0.png; and final static/800x600-dpr1/third_puzzle/end.png. I also viewed the new [unscaled static corner plate](evidence/review-final-note-static-v6/static-native-final-crops.png). Exact full paths, dimensions and SHA-256 are in [manifest.json](evidence/review-final-note-static-v6/manifest.json); every supplied SHA matched.

The Note capture metadata describes real Intro control activation followed by third_puzzle; review did not replay that route. Web canvases equal the requested physical dimensions, nominal DPR1 (recorded device DPR1.0000000298023224), playing, moveCount0, no motion, unflipped settled camera. Note settle250ms; static settle180ms. Native Note metadata:60fps target, vSync0, move delay70ms, skipping=false, instant zoom=false. Native/Web random-particle clocks are not synchronized.

## Bounded findings

- All three Note pairs visibly wrap as “Note: You can” / “undo a reset”, with consistent centering, two-line spacing and no visible clipped descender or bottom-row loss. Established min-RGB>150 support measurements independently reproduce the supplied comparison; this threshold is diagnostic, not a new tolerance.

| Physical size | Row bottoms, native/final | First-row left, native/final |
| --- | --- | --- |
|800×600|475/475;492/492|38/38|
|1001×733|578/578;601/601|48/48|
|1280×720|599/599;628/628|115/116|

- The1280 left-support difference is not evidence of a one-pixel text translation. At unshifted(114,586), native background is RGB78 versus final0; at(115,586), native158 versus final115. At(115,592), both are115. The visible gray square under the native N changes alpha-composited support; no glyph shift, resampling or fitted background subtraction was applied. These Note crops are not raw-pixel equal.
- Static800×600 outer frame, top bevel, two goal outlines, yellow box, player, L-corner and lower notch align in the full images and unscaled crops. I see no gross misplaced join, open gap or extra long seam. Sampled panel, gray-bevel, white-highlight and magenta-fill interiors are exact. The sampled yellow interior is native(255,183,53) versus final(255,183,54), within only the existing1/255 flat-interior allowance.
- **Localized corner residuals remain open.** L-corner ROI[414,298,612,340] has 4 pixels differing by>1; worst at(428,321), native gray190 versus final207, difference17. Lower-notch ROI[303,370,443,456] has 10 pixels differing by>1; worst at(323,382), native214 versus final234, difference20. **No edge-geometry tolerance was established.** Counts above1 are diagnostic only, not an AA acceptance criterion. These residuals are not waived under the flat-interior allowance or attributed to clock differences; their exact cause remains unresolved.
- Read-only follow-up of retained native static-0/1/2 shows both worst pixels and their complete 7×7 neighborhoods are identical across all three native frames. Nearby native gray backgrounds are93 around the L-corner and88 around the notch; white-side samples are255. Exact hashes and native/final neighboring samples are preserved in [native-static-repeat-check.json](evidence/review-final-note-static-v6/native-static-repeat-check.json). No additional visual capture or long investigation followed.
- Void squares and colored motes clearly occupy different positions around the controls, board and boxes. These observed background/clock differences prevent whole-frame equality; they do not justify waiving the separately recorded corner pixels. No offset, scaling, resampling, fitted mask or tolerance change was used.

Measurements and exact corner pixel lists are in [metrics.json](evidence/review-final-note-static-v6/metrics.json). [review.py](evidence/review-final-note-static-v6/review.py) reproduces hashes, fixed-coordinate diagnostics and the unscaled plate without modifying inputs. Conclusions cover only these four image pairs, not other routes, sizes, DPRs, font requests or the complete game.

Released to main: this report and evidence/review-final-note-static-v6/** only; all new and unstaged. No other reviewer's files were touched.
