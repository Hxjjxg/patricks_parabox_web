# Infinite-enter shrinking old-cell phantom

Date:2026-10-25. Source/image investigation using debug-hypothesis. Owned
files are only this record, new core/infEnterPhantoms.ts, new
tests/infEnterPhantoms.test.ts and the separately authorized new
tests/phantomWallRendering.test.ts. No existing source, browser/native input,
injection, staging or commit is authorized for this subtask.

## Observations

Native Movement.ResolveMove1285–1315 creates one shrinking old-cell phantom
if any matching Enter step has infEnterNum!=-1. Web lacks that constructor.
Separately, native Draw6030–6047 calls DrawWall for non-face wall phantoms,
whereas current Web drawLevel routes !block.subLevel phantoms to drawFace.

Read-only actual module replay of infenter_zone_v2 finds:

| route/attempt | block | old level/cell | destination | offsets/scales | eaten | duration |
| --- | --- | --- | --- | --- | --- | --- |
| DDDU/2 Down |55|0/(4,1)|7/(1,0)|(0,+2)/(3,3)|true|.5|
| DDDU/3 Down |57|0/(4,2)|7/(1,2)|(0,-2)/(3,3)|false|.5|
| Zone41/41 Down |59|0/(5,1)|7/(1,0)|(0,+2)/(3,3)|true|.5|

Each has an accepted Enter, infEnterNum0. Both eaten cases resolve dy+1;
non-eaten player57 resolves dy-1. All three source constructors require
yTo=+.5, scale endpoints0, initial scale1 and exiting=false. Old levels
are actual block.OuterLevel0 even though native scratch Enter.fromLevel
can be detached/null, reported as -1. Do not register on scratch fromLevel.

DDDU's final Up has no matching strict Enter and does not require this
shrinking constructor. Its final player moves from7/(1,2) to generated14/
(3,4), offset(0,+.6666666716), scales1/3, .5s. Retained DDDU live PNGs
capture this final Up only; earlier strict Enter moves are setup. They
provide mechanism routes but no retained actual PNG for their transient.

Zone41 final Down accepts move29, wentToInfZone=false. Native accepted
history-before:TurnCompleted at frame94272 preserves block59 Enter0 to7,
while57 and74 Slide. Native frame1603 at body/globalT=.175579/.5 retains
a blue shrinking box filled with wall below the green box, roughly
x437..471,y456..491. Its actual identity is container59/subLevel11, a
1x1 level filled by terminal wall60. It is not terminal wall59.
Frame1611 atT=.312567 retains a smaller blue part beneath the green box.
The old root board(154,54,492,492) is9x9: c=492/9. For p=T/.5, native's
non-simple phantom has x=154+c*(5+p/2), y=54+c*(7+p), w=h=c*(1-p).
Thus at frame1603 the unrounded old-copy rect is approximately
(436.931,455.863,35.470,35.470), with bottom491.333 fixed.

Historical retained Web development source1337643 shows the corresponding
gap in web-long-routes-after-dev/infenter_zone_v2/motion-0069-normal-0.25.png
at actualT=.12740000000148938/.5: the area under its green box is empty
instead of retaining the source-required old-cell blue box. This is an
older actual capture, not a new current-source baseline or after image.
Phase differs from native1603, particles differ, and no whole-image pixel
approval follows. Main owns fresh current baseline/after and independent
review; a source fix cannot retroactively change this historical evidence.

## Hypotheses and discriminators

1. Constructor omission: supported by exact native gate and real accepted
   chains; test actual movement's old outer level for required phantom.
2. Renderer terminal-wall branch omission: source DrawWall differs from
   Web drawFace-only. Initially favored for the blue copy, but the exact
   model identity test falsifies that attribution: block59 has subLevel11,
   filled by wall60. A source-contract phantom59 supplied to the real
   drawScenePass already queues backing59 and renders wall60 at its source
   rectangle. No renderer change is required by this actual counterexample.
3. Valid size/cull/phase rejection: conflicts with >35px source geometry
   fully inside root at retained native1603. Test source-derived rect and
   current cutoff, without threshold, depth or clock changes.
4. Old/new representation autotile confusion: native Phantom retains Block
   identity, while old-cell geometry differs from the moved block's logical
   level7/(1,0). Native DrawWall reads live cached WallTileIndex; check
   Movement.MoveBlock refresh timing before recommending renderer context.

## Source conclusions and experiments

Native Autotile.AutotileWall72–89 uses the block's current OuterLevel/xpos/
ypos. Movement.MoveBlock1134–1135 refreshes both old and new neighborhoods
after relocation. DrawWall2993–3002 reads that live cached index. For a
terminal phantom the current logical level supplies its tile, while old
phantom coordinates and parent ticket supply geometry/tint. This source
contract is independent of the actual container59 case.

### Actual mechanism results

New createInfEnterPhantom returns one constructor result without mutating
inputs or registering it. It matches native flag2/flag3: only matching
Enter steps contribute, any infEnterNum!=-1 enables it, and infEaten from
any matching Enter reverses the endpoint. It deliberately has no ordinary
exit reference-count gate. Mathf.Sign(0) and negative zero are positive.
Initial x/y=0, scales=1, scale endpoints=0, face=false, exiting=false,
exitedFrom=null; duration is the current turn length.

Integrate once in resolveMove beside the exit constructor, using the
already-computed projection and current turn duration, before History
applies destination coordinates. Register on the returned old outerLevel.
Keep the existing infExitPreviewMode early return. Undo clears live copies,
redo does not recreate them, next impulse clears them and UpdatePhantoms
removes at animT>=length, matching the existing lifecycle.

The supported suite tests20 cases: constructor signs/defaults/gates and
purity; three actual accepted DD/DDD/Zone41 paths; final DDDU non-Enter
classification; expiration/live undo/redo; native1603 source geometry;
and a positive actual renderer discriminator. Before integration it has
16 passing tests and4 expected failures, all missing committed constructor
objects. The exact source-contract phantom59 already dispatches one old
backing59 and its child wall60 using the unchanged renderer and cutoffs.
The initial wrong wall59 assumption failed in fixture setup, was recorded
and retracted; it is not counted as a rendering defect or retained red
regression. Typecheck passes.

### Separate source-only terminal-wall discriminator

Native Draw.cs6030–6047, after the face-phantom branch, draws a terminal
wall via DrawWall and calls DrawFace only if Possessable||IsPlayer. If
flag10 is true, it temporarily stacks parent clamp around those calls.
It then continues without queuing a BlockBacking for the wall. Parent
ProcessTicket draws it before returning, hence before its queued recursive
children are processed. Its color is the parent ProcessTicket's color
(ComputeWallColor(ticket.block,num24,ticket.depth,ticket.cloneFade) at
Draw5787, with num24 the parent cell fraction), not the moved wall's new parent's
color. Web's parent wallTint/nextWallLayer is the equivalent drawing layer.
Native DrawWall uses the terminal block's current cached autotile index,
refreshed by Movement.MoveBlock, not old-cell neighbor queries.

The separate new tests/phantomWallRendering.test.ts retains one explicitly
source-only red test. It uses the real deterministic Zone41 scene solely
as context, substitutes terminal child60 into a synthetic old-cell phantom,
and calls real drawScenePass. Current Web submits zero DrawWall calls at
the required transformed rectangle and takes its unconditional drawFace
path. Expected source contract is a parent-tinted wall layer, current
logical tile context11, no face for nonpossessable/nonplayer60, and drawing
before queued nested backings. No threshold, depth or timing change is
involved. This is a bounded implementation mismatch, but no retained
accepted terminal-wall movement route or actual native transient image
is established for that synthetic copy. It is not the cause of Zone41's
missing container59 and does not justify claiming actual visual parity.
Main owns the separate decision/integration/review for that source branch.

## Evidence hashes and release boundary

- Native frame1603 SHA256:
  8126fb71386d314c26481c0fd44f48edde58e2284f09185a6273423ba4a59c24.
- Native frame1611 SHA256:
  1f292dfd6b78b5214b71a7ad8f0b1641931d26fbdce47051227535d89695a0a3.
- Historical actual Web quarter PNG SHA256:
  9fe432e26493fa2c6970c2584c5b2765f3073af153ce7fe47a7dac115fb77e9b.
- Native Zone41 phases.json SHA256:
  c8aca96fd7d020cd069ab48169d8b378bbdd9686427974b3443ef79be1bf70c3.
- Native Movement.cs SHA256:
  e2b13b05d8bf8e62b3f101de12754d7b8a3908dfbb8cbf1fec5a66da2bfe9377.
- Native Autotile.cs SHA256:
  a0d43cab4a26ff1f5d4efc232f3083a9fe625d08a6f9d4f1eef87fff3c52aa3c.
- Native Draw.cs SHA256:
  e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd.

All actual source replay reads occurred at HEAD2d09419 with main's pending
ordinary-exit integration; this subtask did not change those existing
production files. Main owns constructor integration, final green tests,
new actual Web baseline/after, independent review and commits. The source
and queue proof establishes mechanism, not whole-route Canvas equality.
No arbitrary depth, cull, size cutoff, phase fitting or tolerance change
is proposed.

## Main integration and actual before/after

createInfEnterPhantom is now registered once beside the ordinary-exit constructor, before history applies logical relocation.57focused tests and typecheck pass. Full completed-scope verification73files/1137testspass, typecheck/buildpass (Vite chunk advisory only). Only the separately pending phantomWallRendering and terminalPhantomRoute suites were explicitly excluded; no terminal branch approval is implied. The19new unintegrated Hub state mechanism tests are included in that count and do not prove Hub integration. All six production/test source hashes equal actual capture provenance after verification.

Fresh current before1595rAF/478PNG and after1594rAF/479PNG repeat the unchanged native41-action contract. Both have all41action-ownedcounts and complete87ordered-block endpoints exact, verified by the existing comparator now accepting explicit --web-root/--level without changing its default full-route inventory/assertions. Hashes479+480capturefiles verified. Main viewed actual full Canvas and strict-enter-time-brackets.png: the blue shrinking copy below the green box is restored. Actual body/global times.1364/.2584/.3833 are bracketed by native saved.0421976969/.175579/.312567/.4485238. Sparse native bracket intervals and independent particles/face clocks preclude whole-frame pixel approval. Independent targeted recheck and immutable final capture remain pending.
