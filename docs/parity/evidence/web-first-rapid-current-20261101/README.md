# Current Web Rapid Queue Replay

This is a bounded controller timing probe, not a visual parity approval. The original reference is `../original/first-queue-phase-r40-u40-20261025/` (800x600, first_puzzle, default 70 ms move delay, settled player at (2,2)); it contains actual native PNG frames and per-update metadata. The Web page was an isolated Chrome DevTools page at 800x600 CSS, DPR 1.00000003, 800x600 Canvas backing, with source HEAD `5f49d5a772e3fbfd1894e2237ca17423402b2aa8`.

The Web probe reset `first_puzzle` before each of three runs, scheduled `ArrowRight` at t=0 for40ms, then `ArrowUp` at t=40ms for40ms, then released all keys and observed natural requestAnimationFrame updates. Actual Web held spans were47.6-49.0ms for Right and47.9-51.0ms for Up; the probe records delivered times instead of assuming the requested timer delay. It recorded world/player/camera state from `window.__PARABOX__`. Input events were synthetic DOM keyboard events; this preserves the page's controller and natural frame loop but is not a trusted physical keyboard event. No production code was changed.

| Signal | Original control/frame observation | Web trial 1 dispatch/frame | Web trial 2 dispatch/frame | Web trial 3 dispatch/frame |
|---|---:|---:|---:|---:|
| Up observed / dispatched | 55.80 ms | 51.4 ms | 51.2 ms | 47.9 ms |
| Move count reaches 2 | 73.79 ms | 65.1 ms | 65.8 ms | 48.6 ms |
| BUMP_HALT at (3,2) | 109.84 ms | 115.2 ms | 115.9 ms | 115.3 ms |
| Next NORMAL frame at (3,3) | 126.50 ms | 131.8 ms | 132.3 ms | 131.9 ms |
| Final logical state (not phase matched) | moveCount2 at (3,3) | moveCount2 at (3,3) | moveCount2 at (3,3) | moveCount2 at (3,3) |

The Up row has different observation boundaries: native records the first update containing Up, while Web records synthetic DOM dispatch. Native frame `frame-0004` records `moveCount=2` while the first rightward animation is still at t=.07379; this is a queued-action reservation, not evidence that the second animation started. Its next observed normal animation begins at126.50ms. Web trials 1 and 2 reserve the same count at65.1/65.8ms and begin the next normal animation at131.8/132.3ms. Trial3's Up event fell just before a browser frame boundary and the count changed in that next frame at48.6ms; its subsequent BUMP_HALT and normal-animation milestones match the other Web trials. The post-landing animation-start samples are within about6ms, but the differing event and frame phases prevent an input-timing parity claim. The end samples are not phase matched and do not establish equal settling behavior.

`trials.json` retains the compact reported Web event and state-transition samples. It is not the complete per-frame trace, and Web phase screenshots were not retained because the DevTools output-file path was denied. This result supports only this short first_puzzle queue path. It does not cover held-repeat cadence, physical keyboard delivery, longer frame stalls, camera-moving inputs, DPR2, or rendered-pixel agreement. Keep those matrix rows open. Existing native images and source metadata remain authoritative; no test tolerance was changed.
