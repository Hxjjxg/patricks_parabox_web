# Native recursive family coverage

The authorized visible debug executable records all original delivered input,
update/history boundaries and frame states. SparseMotion retains PNGs on each
event start, every eighth frame and the final40ms. Unsaved frame images are
explicitly null; their states and phases remain available. No active movement
or camera animation is stopped. Instrumentation and PNG encoding do not prove
uninstrumented interactive frame pacing or Web visual parity.

| Original route | Inputs / accepted turns | States / PNGs | Proven coverage |
| --- | --- | --- | --- |
| infenter_first_2, existing walk |22 /22 |910 /214 | Exact existing fixture endpoint; no strict infinite-enter event |
| infenter_zone_v2, walk +R5 U5 L5 D4 |41 /29 |1633 /376 | Exact fixture endpoint; one accepted Enter with infEnterNum0 at final Down |
| flip_first, R D D R R |5 /5 |210 /50 | Exact fixture endpoint and final player flipH=true |
| 1by1_playerr_flip2, DDRURLUDDLUDDLRUDRUDLDRDULDRRRD |31 /19 |1268 /304 | One noncanonical clone entry; self1x1 player flipped at endpoint |

The provided long route contains31 direction characters. An independent
structural original run records all31 per-command hashes and the complete
endpoint in tests/fixtures/original/1by1_playerr_flip2-long-route.json. The
existing originalConformance harness passes all22 cases, including every new
native hash. This is additional native evidence, not a Web-derived fixture.

Only history-before:TurnCompleted preserves the accepted Movement.moves.
Later TurnCompleted processing reuses this scratch list for previews. Strict
infinite entry is Enter with infEnterNum>=0; strict infinite exit is Exit
with infExitNum>=0. The zone-focused final Down records raw block59 entering
level7 from detached level-1 at index0. WentToInfZone remains false, so this
route does not establish newly generated-zone entry. Neither walk nor long
flip route receives unsupported strict-infinity credit. Raw World.blocks
indices can differ from pruned snapshot indices.

## Original shine submission

flip-recursive-shine-submitted-v1-20261025 starts from settled RR and then
records DOWN40/NONE760 with42 PNGs. Original DrawFlipShine context contains
MiscAnimT, exact ticket doubles, flipH, cloneFade, depth, focus block and
CameraMovedThisTurn. A separate hook on the actual managed Graphics.DrawTexture
overload records the screenRect after original clamping. There are1461 calls,
1461 requested pre-clamp bands and952 actual submitted bands.

At measured NORMAL phases.0915384/.31040302/.4159244, native MiscAnimT is
8.867028/8.976461/9.029222. Focus is block104 and CameraMovedThisTurn=true;
both ordinary and cloneFade=true block104 tickets are actually submitted.
The compact selections retain exact requested phases, observed phases, PNGs,
ticket geometry, submitted rectangles and alpha. Unsynchronized Web clocks
cannot establish incorrect shine width math.

## Style timing source clarification

- Projection.GetEnterLength320: TUI/TUI_COLOR returns.1; other styles update
  camera mode, use EnterLengths[Prefs.EnterSpeedIndex] for Synced, else.5.
  GetPossessLength334 delegates to this method.
- GetBumpLength339: TUI/TUI_COLOR returns0; at least4 players returns.11;
  otherwise.22. QUICK DoBumpAnim244 overrides with squish-in-place.6.
- UndoManager.DoRedo303 applies QUICK squish-in-place.6 to every animated
  move;401 calls QuickAnimCamOff with the original player offsets/scales.
- World.UpdateInner1121 excludes BUMP_HALT and SQUISH_IN_PLACE from
  AnyBlockMoving even while the block Moving field remains true.
- UndoManager.StopAnimations554 immediately returns for QUICK;
  Movement.Impulse128 initializes QUICK moveDelayCounter=-.1.

Existing style-quick-right-motion-20261025 and style-tui-up-motion-20261025
have original draw styles QUICK_ANIM/TUI_COLOR respectively, MoveDelay70,
AllowSkippingAnimation=false, InstantZoom=false, target60/vSync0. QUICK
records SQUISH_IN_PLACE length.6 with AnyBlockMoving=false; TUI records
NORMAL.1 then BUMP_HALT0. No settings or context normalization is assumed.

The additive recursive-family-native-index.json validates all986 PNGs,
route/event delivery, accepted counts, exact fixture endpoints, strict
mechanic predicates and source/evidence hashes. Raw prior evidence remains.
