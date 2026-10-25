# Hub entry and cancellation implementation

Date:2026-10-25. Native source,140 measured draw-state checks and raw hashes are recorded in [hub-entry-cancellation-native-findings.md](hub-entry-cancellation-native-findings.md), commit2822603. Full Hub raster approval remains open because previews/links are absent.

## Reproduction

Use an isolated save with won first_puzzle/second_puzzle/third_puzzle, recentArea Area_Intro and nexus false. Load Hub and settle `LLLDDDD`, reaching count7/player(2,5). Deliver DOWN40ms, RIGHT700ms, NONE300ms. Native remains beside the enter portal during JUMP_IN. Immutable v4 immediately loads enter; `evidence/web-hub-entry-before-v4/direction-change` retains64actual rAF samples/19PNGs proving the discrepancy.

Three controller assertions fail before production changes: expected Hub count8/JUMP_IN but received enter count0; both Undo and Restart cannot cancel because the destination has already loaded. This confirms missing Transitioning lifecycle, not a camera/curve error.

## Focused port

- Pure `hubTransition.ts` initializes JUMP_IN targeting float32(1/9), or the native eyesJump STILL/linear-face alternative, without moving the logical player onto the portal.
- Movement counts the successful portal attempt, discards its unfinished history turn, and preserves existing future history.
- Transitioning blocks reservation while retaining direction-stack and native changed-direction eligibility updates. Existing single-queue mechanics are retained.
- World completion uses its own elapsed timer with >=, after cancellation and animation. New scene loading preserves controls, completed transition metadata and prior AnyBlockMoving; the next recomputation becomes idle.
- Eligible Undo, pressed Escape and Restart dispatch CancelJumpIn: stop animations, clear phantoms/queue, .125 squish, reset transition counter, preserve Hub count/history. Escape is one pressed-edge undo request and does not retry merely because the key remains held through cooldown.

## Actual development captures

All are800×600 backing/DPR1 with natural rAF and actual Canvas images. These development captures are not immutable production approval.

| Capture under evidence/web-hub-entry-after-dev | rAF | PNGs | Result |
| --- | ---: | ---: | --- |
| direction-change |62|21|Hub count8 neighbor during JUMP_IN; enter load499.8ms after first action frame; queue-only update549.8ms; reserved right applies566.5ms; final enter count1|
| cancel-reenter |120|24|First attempt count8; cancellation retains count8; reentry count9; natural enter load; final count0|
| portal-first-leave |167|35|Natural first_puzzle entry; Pause→Leave; Hub count0 at(6,7)|
| portal-second-leave |167|35|Natural second_puzzle entry; Pause→Leave; Hub count0 at(5,7)|
| portal-third-leave |167|41|Natural third_puzzle entry; Pause→Leave; Hub count0 at(4,7)|
| portal-enter-leave |167|29|Natural enter entry; Pause→Leave; Hub count0 at(2,5)|

Requested command times are not treated as actual delivery deadlines. The direction capture precedes the small transition-metadata carry patch and shows reset diagnostic counter in the loaded scene; later cancel capture retains that metadata. It still proves physical load/queue order. Final integrated recapture remains required.

## Tests and limitations

Regressions cover the three failing-before scenarios, eighteen actual measured body phases across six native runs, completed-attempt counting without history/future mutation, >= timer versus strict block landing, cancellation on a crossing update, and pressed Escape cooldown behavior. Existing timing/queue/history tests and native replay expectations remain unchanged. Full suite at the previous small entry revision:911tests/58files; focused63tests pass after Escape edge coverage. Typecheck/build run separately.

Exact .5 cancellation threshold, Escape/restart cancellation and eyesJump have source-derived tests but no newly measured native runtime cases. The four portal→Pause→Leave captures use the original per-case wins and settled routes, then DOWN1000/NONE200/ESCAPE40/NONE120/DOWN40/NONE120/CONFIRM40/NONE1200. They demonstrate correct natural entry, selection and return body offsets; independent whole-scene review is pending. Leave held-control persistence/camera unpause and whole-Hub preview rendering remain explicit open work. No universal pixel-parity claim.
