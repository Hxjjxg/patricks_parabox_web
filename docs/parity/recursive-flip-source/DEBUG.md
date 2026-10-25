# Recursive flip missing-board source investigation

## Observations

- Reproduction supplied by renderer/reviewer: 1by1_playerr_flip2, settled
  RIGHT RIGHT, then DOWN:40 NONE:620,800x600. Web v3 shows a purple fan or
  isolated face while native has blue board/walls/goals. Reviewer phase
  brackets and Web trace are existing actual outputs; no new UI claim.
- Native Level.GetExitBlock and Web level.blocksWithThisAsTheirSubLevel[0]
  are exactly equivalent. Native numLevelsUp is3 for this level. Native
  GoOutOneLevel math matches current Web formula.
- Native Draw2149–2230 has an additional infExitPreviews rendering pass,
  absent in Web: each preview starts from exitBlocks[0], unwinds via its
  ordered exit representation chain before falling back to canonical exits,
  clips to a directional screen exterior and draws a .2 black overlay.
- Native tickets preserve ordered Block parents and negative ancestor depth;
  Web passes a Set of Level and starts depth0. Native ShouldSimpleSlide
  compares the actual representation chain to justEnteredArray.

## Hypotheses

### H1: Wrong canonical accessor or ancestor budget
- Supports: the blue9x9 board is absent from the self1x1 ancestry.
- Conflicts: source definitions are identical and native budget is3.
- Test: compare source accessors and budget exceptions.
- Result: rejected as a standalone cause.

### H2: Missing infinite-exit preview pass (ROOT HYPOTHESIS)
- Supports: native has a separate source-defined pass capable of escaping
  self1x1 ancestry into a9x9 representation; Web has none.
- Initial uncertainty: actual RRD preview contents had not yet been measured.
- Test: add read-only native phase metadata for preview directions and exact
  exitBlocks, capture the same RR/D route, then compare native chains.
- Result: confirmed. Native `flip-recursive-preview-topology-20261025` has no
  previews before DOWN (frame42), then four on frame43: left/down/up/right,
  each ordered chain `[101]`. Block101 references level1 from root level0;
  the chains persist through the capture end. This is the missing-board root.

### H3: Lost representation parents and queue order
- Supports: ShouldSimpleSlide cannot be matched with Set<Level>; Web depth
  first faces/backings differ from global native queues. Could explain fan
  projection, overlap and motion even after previews are restored.
- Conflicts: does not by itself prove the settled9x9 missing board origin.
- Test: compare source parent-chain predicate and actual RRD preview topology;
  renderer owns its independent topology regression.

## Experiments

- H1 source-only comparison rejects an accessor-only fix.
- H2 used a three-line read-only phase probe of native `Draw.infExitPreviews`.
  It did not alter camera, movement, frame pacing, or rendering. The capture's
  `phases.json` records the exact native chains; `start-state.json` and
  `end-state.json` retain all block placements and history counts.
- Regression before implementation: seven expected failures (missing preview
  field/lifecycle/detection) in `tests/infExitPreviews.test.ts`; the three
  native endpoint checks already passed. After port: all11 tests pass.
- All bundled levels were probed at load: no new infinity exit/enter zones,
  blocks, levels or floors. Representative RRD, strict infinite exit, clone,
  shed and introductory states preserve all world/history/animation fields,
  accepted attempt scratch, and even intentionally dirty temporary flips.

## Resolution

- `WorldModel.infExitPreviews` now carries the native ordered Block chains.
- Movement ports the detached dummy exception, infinite-exit cycle marker,
  in-bounds/missing-infinity stop points, and preview guards for inner push,
  shed, entry animation flags and move resolution. Probe scratch and block
  temporary fields are restored after detection.
- Engine construction is the load refresh point. History's state-change
  callback refreshes after committed movement, undo, redo, restart, and
  editor relocation, after block lists and button state are current.
- The renderer owns native ordered ancestry, preview drawing and ticket
  ordering. The preview regression does not hardcode renderer geometry.
