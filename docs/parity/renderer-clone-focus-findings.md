# Native first-half focus and cloneFade context (2026-10-25)

## Independent actual-output observations

Clean RRD flip trace: Web sample-0001 at global NORMAL/camera.1 mirrors the infinity icon to lower-right; native frame0004(.0861972) and0005(.1053783) retain lower-left. At Web sample0003(.3) and0004(.4), native0015/0016 and0020/0021 have a dim board and a right-hand player stack; Web retains a bright mirrored board and additional rectangle. Actual independent plates live under review/production-v2-clean-flip-sample-0001/0003/0004-plate.png. Clean trace does not reach camera.5, so its halted shine is not established.

## Root hypotheses and source proof

1. Wrong focus representation and omitted clone transition: confirmed by source and actual GameRenderer.draw failing regressions. Draw.cs1719 chooses player.justEnteredArray[0] during the first half of a cross-level clone movement; native RRD uses ref104 instead of canonical player51. Outward traversal2094/2121 preserves the exact entered representations. Web previously chose canonical focus immediately and traversed only canonical ancestry. This changes world parity and preview placement without any camera easing defect.
2. Missing dark midpoint context: confirmed. Draw.cs2476 draws a fullscreen black trapezoid (.0?.45 ramps up, .45?.55 remains opaque, .55?1 ramps down), then renders the old representation as a cloneFade ticket. Previews are suppressed during the first half of this transition. Web omitted all three instructions.
3. Incorrect camera easing or shine-width formula: not required to explain these focus/context failures. Shine geometry also depends on block.MiscAnimT; its native/Web clocks remain unsynchronized and require new native submitted-band metadata before interpreting width deltas. No camera curve or shine width offset is changed.

## Port

WorldModel.cameraMovedThisTurn follows the exact native Movement.cs151 reset and744/1218 set sites. Preview probing explicitly saves/restores it. Native has no undo/redo/restart assignment to this presentation flag, so history retains it until the next ordinary impulse. No queued-input timing, projection, move history, or preview mechanics are changed.

The renderer now chooses first-half focus, traverses entered ancestor representations, gates previews, draws the black trapezoid above normal scene/controls, and draws the cloneFade scene above it. The dedicated stage overlay preserves native ordering without changing drawControls. Only the root overlay ticket has cloneFade; child tickets use their own ordinary representation context. Backing/wall clone tint, face visibility, infinity glyph fade, and flip intensity use the source global camera transition phase.

Five actual phase/flag regression cases failed before and pass after the port. Further tests cover clone tint/effects, the source midpoint boundaries, and global-vs-block flip phase. The older settled topology fixture now advances the independently updated camera to its actual settled.5 state; preview/root/depth assertions remain unchanged. Old recursive transparency tests strictly expect the newly proven gradient plus four alpha.4 infinite-zone frame strips, while still forbidding opaque backing.

## Verification and limits

Full suite49files/816tests passes; TypeScript typecheck passes. No production build/dist changes. Next step is an immutable production snapshot and independent actual PNG review of early parity, midpoint darkness, old overlay topology, and clean landing. Native clone camera modes/title/credits and unrelated presentation gaps are not declared complete by these tests. Possession eye transfer is a separately confirmed queued defect.
