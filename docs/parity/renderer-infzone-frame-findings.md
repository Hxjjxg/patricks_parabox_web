# Infinite-zone enclosing frame (2026-10-25)

## Independent observation

Clean production-v2 comparison: original/infenter-zone-dddu-motion-v2-20261025/frame-0022.png versus web-production-candidate-v2-clean/infinity/state-0028.png. Both have moveCount4, player outer14 at3,4, cameraT.5, and BUMP_HALT t0. Native draws a large gray square around the infinite zone; Web lacks it while retaining the gold child outline and infinity glyph. Independent plate: review/production-v2-clean-infinity-state-0028-plate.png.

## Hypotheses

1. Missing early open-edge border pass: confirmed. Native DrawBlock (Draw.cs3188?3231) draws translucent strips before the floor/child pass. For block.SubLevel.InfZone it overrides to direct Color.white alpha.2; the default GUI shader doubles alpha to.4. Existing Web drawLevel skips transparent zone backing and later draws only solid/yellow borders, omitting this separate open-edge frame.
2. Incorrect enclosing ancestry: rejected for this defect because clean state reaches the native focus72/level14 and child geometry at the same camera/animation state. Changing ancestry cannot substitute for the absent zone frame draw instruction.
3. Gold infinity predicate or opaque backing: rejected. The gold predicate describes blocks inside the zone, not its enclosing boundary. Native explicitly makes the zone backing transparent and separately renders the white-alpha frame.

## Fix and regression

A narrowly scoped drawInfZoneFrame helper mirrors the native early pass only for infinite-zone sublevels. It uses existing native border thickness and snapped endpoints, omits sides that are fully walled, and excludes vertical corner overlap from the top/bottom strips. It runs after gradient/backing and before floors/particles/child geometry. QuickAnim also permits this native zone frame.

Two actual drawLevel regressions failed before the port (no strips) and pass afterward: all four open sides; fully walled left side omitted. Focused border/backing/frame suite15tests passes; typecheck passes. The native alpha.2 is exactly byte51/255 before doubled GUI alpha, with no hand-tuned correction.

Pending: main-owned next production snapshot and independent actual PNG confirmation. This change does not assert ordinary open-edge frame completion, flip context parity, shine clock synchronization, or complete renderer equivalence.
