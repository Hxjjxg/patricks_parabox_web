# Hub return lifecycle implementation

Date: 2026-10-25. Native findings and hashes: [hub-arrival-native-findings.md](hub-arrival-native-findings.md), commit a51ed14. This module does not approve the full Hub scene.

## Reproduction and root cause

An isolated empty save loads `third_puzzle`. Apply the first31 characters of `RUUURDDDLDRRDRRULLLLULLDDRUUULUR`, settling each move. Start at(1,6), count31, not winning. Deliver Right2300ms, then no controls300ms. The immutable v4 capture `evidence/web-production-candidate-v4/transitions/third-win-held-corrected` loads an idle Hub and walks four steps. Original `intro-third-win-held-native-v1-20261025` loads JUMP_OUT0/.5 at(4,5), reserves one step, lands, then applies it.

The controller loaded Hub without the native arrival initializer. Its input timer additionally returned before testing a delay already eligible during the preceding settled win. The request helper discarded eligible held requests during movement. These are discrete lifecycle omissions, not frame pacing or easing differences.

## Implementation

`core/hubTransition.ts` ports the body and eyesJump branches after progression placement. It uses the actual chosen portal delta, metadata, native enter duration, immediate draw initialization and outward eyes. First and second immediate win links retain ordinary puzzle loading. Win fallback and Leave request the Hub arrival. The first full Hub update samples controls but skips block, floor and phantom animation increments.

`DirectionalInput` freezes accumulation while moving while retaining previously eligible delay. Reservation does not consume that counter; the physical impulse does. The one existing queue waits for the prior update's AnyBlockMoving to become false. JumpOut completion clears the native blocked-direction flag and enters the existing nonblocking landing bump.

## Actual browser result

`evidence/web-hub-arrival-after-dev/third-win-held`:800×600 backing, DPR1,158 natural-rAF samples and39 actual Canvas PNGs. No supplied native clock. Relative to first recorded action frame:

| Landmark | Web ms | State |
| --- | ---: | --- |
| Hub load |1599.3|count0,(4,5),JUMP_OUT T0/.5|
| First full Hub update |1615.9|count1,(4,5),JUMP_OUT T0/.5|
| Landing |2132.5|count1,(4,5),BUMP_HALT,AnyMoving=false|
| Reserved impulse |2149.2|count1,(5,5),NORMAL T.0167|
| End | |Hub count1,(5,5)|

This is development evidence after bde8bbc, not an immutable production-candidate claim. Later small timer/landing-hook edits require integrated recapture. Native and browser frame schedules differ; compare phase and ordering, not equal absolute deadlines.

## Regressions and remaining work

The controller regression failed first on NORMAL0/length0, then on missing first-update reservation after only the arrival initializer was installed. Both pass after the focused fixes. Additional tests cover all four portal-relative offsets, quarter phases, strict landing boundary, landing wait reset, eyesJump linear phantom and hidden-body lifecycle, duration preferences, and absent-portal/direct-load rejection. Existing native control/history replays remain unchanged.

The actual midpoint comparison also confirms missing Hub portal preview thumbnails, connecting lines/flags and shortcut annotations. They remain an open renderer discrepancy. Native reduced Hub outer0 and Web full Hub outer47 identify the same Area_Intro/local coordinates; numeric allocation indices are not a geometry mismatch. eyesJump is source-derived only in this module. Hub entry/cancellation, Leave control persistence/camera unpause, production recapture and final integrated independent approval remain unfinished.
