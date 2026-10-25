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

## After-clamp development follow-up

I viewed the actual corrected800×600 start/end PNGs, the retained native full PNG again, and the separate [unscaled native/after crop plate](evidence/review-final-note-static-v6/after-clamp-native-final-crops.png). This is an **uncommitted development capture, not frozen final-v6**. End PNG SHA-256 is c1c4d13b4372e4a068f98751b804963ed43dbec081c112a7fd9a8199b4b15bd9. Capture/trace hashes match, and the captured/current wallRendering.ts SHA matches d05c138db2dbbfac5fcd0135a3adfdf0248625195bf6405d73a223a93dadd199.

Independent fixed-coordinate results:

| Region | Before max / pixels differing>1 | After max / pixels differing>1 | Remaining nonexact pixels |
| --- | --- | --- | --- |
| L-corner [414,298,612,340] |17 /4|1 /0|41|
| Lower notch [303,370,443,456] |20 /10|1 /0|66|

At(428,321), corrected RGB190 now equals native190. At(323,382), corrected213 remains different from native214. The gray93/88 and white255 neighbor samples remain exact; all seven previously sampled flat interiors are unchanged from the before capture, including its existing one-byte yellow-fill difference. The top-bevel ROI is also unchanged, retaining331 one-byte-different pixels. Corrected start/end are exact within these three fixed ROIs.

The full images and unscaled joins show the previously excessive bright edge coverage reduced without an adjacent gross geometry or fill regression in these inspected areas. This measured improvement **does not establish an AA tolerance**: the41/66 remaining corner pixels are not approved by borrowing the1/255 flat-interior allowance. Background particle clocks remain unmatched. No shift, resampling, fitted mask or acceptance change was applied.

The trace has only **one recorded rAF and two PNGs** under CPU pacing; player(2,4), camera0, playing/static. This does not validate sustained timing, other scenes/DPRs, Note after the change, frozen production, or the overall test/build run. Before metrics/manifests/hash files remain byte-exact. Separate [after manifest](evidence/review-final-note-static-v6/after-clamp-manifest.json), [metrics with every remaining pixel](evidence/review-final-note-static-v6/after-clamp-metrics.json), [reproducer](evidence/review-final-note-static-v6/after-clamp-review.py), and [after-only hashes](evidence/review-final-note-static-v6/after-clamp-hashes.json) preserve this follow-up without overwriting the before evidence.
