# Hub lifecycle production integration

2026-10-25. Recovered LoadLevel/Block/Floor/World source rules are in hub-caption-lifecycle-findings.md. This module connects those mechanisms to real loading, controller scheduling and particle ownership. It does not establish native visual parity.

- Progression retains native session histories, first-Hub suppression, count accumulation across wins, reverse ordinary-wall retention including Center, route-open versus collision-wall separation, and exact capped/uncapped counts. Hard2/no-incoming and gateway predicates ignore unlocking walls as native does. All-portals-won celebration includes hard/visual portals and preserves the native single level pointer/cumulative portal count.
- World/block/floor transient fields stay separate from persistent progress and undo. Global counting survives level loads; title resets the first-Hub history gate.
- Block timers get full elapsed time while movement keeps the existing post-press delta and .1 cap. Forward list mutation deliberately skips the shifted next entry after native removal. Per-wall global false assignments are preserved; counting is not recomputed as an OR.
- Eligible playing floors update before win/load and the later celebration clock. First playing Hub tick skips block/floor stages only; paused floors run even on that first tick while wall/global clocks freeze. Physical movement is gated by unlocking or an attached celebration level, not counting alone.
- Portal pop particles and twelve-wall pop particles use existing source emitters. The new sixteen-edge-particle source emitter runs after updateParticles, so birth particles remain unmoved on that tick. It consumes64 injected unit samples without claiming Unity PRNG bit equality.

## Verification

New runtime coverage:9 natural loader/history cases,9 edge-emitter cases,4 scheduling cases,7 actual controller cases. The19 earlier pure state cases remain. The controller tests preserve 1ms post-press movement under a300ms elapsed frame, first-Hub skip, floor-before-clock order, paused growth, movement gates and particle birth ordering. Synthetic transient states are explicitly labeled; loader tests exercise unchanged bundled Hub data.

Initial new particle birth fixture observed43 celebration particles rather than16 because nine actual portal pops correctly contributed27 in the same update. The corrected fixture premarks portals popped to isolate the edge burst; the16 exact assertions and production remain unchanged. Readonly fixture fields and required animation-context fields were corrected for typechecking.

Integrated workspace full run:80 files/1189 tests pass, typecheck/build pass (Vite chunk advisory only). A final frozen-source rerun follows the parent-border order check. Runtime-only commit does not claim its staged tree includes the separately owned renderer integration.

Actual development captures in evidence/web-hub-caption-lifecycle-after-dev follow a real Hub step, actual31-move third_puzzle setup and final physical Right, then automatic return. The positive800x600 count capture317rAF/53PNG and nine-win/unlock/celebration/pause capture595rAF/100PNG show source stage sequencing; paused clock remains exactly.8345000147819519 over32 sampled frames while first portal size increases.8510000705718994→1.4709999561309814. Smaller800x540 count/pause317rAF/53PNG visibly renders supported size16 1-over-9. Unsupported exact-size pause references remain missing.

The earlier natural-count-empty317rAF/53PNG is retained as a diagnostic: API loading a puzzle directly from an empty save did not record RecentArea, so no count qualified. This was a stimulus error, not a production timing failure. A real initial Hub Right records the area; no transient state/clock is injected for the positive captures. The original first capture placeholder and final-setup guard failures earned no capture credit.

Required native extended glyph sizes remain unavailable after two rejected deployment attempts. Black hidden-launch PNGs are rejected, and no retry/bypass occurred. These source/runtime results do not close native raster, missing-font, sound, complete matrix or final immutable independent review requirements.
