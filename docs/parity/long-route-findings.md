# Retained long-route replay contracts

Date: 2026-10-25. This audit owns only this record and
long-route-capture-contract.json. It prepares actual Web replay options from
retained native evidence. No browser/native input, new capture or production
change occurs here; main owns Canvas replay and immutable review.

## Actual integrated development replay

Main subsequently replayed all three unchanged captureWebOptions on development
HEAD1337643, with GameRenderer source hash identical to7b09993. Each route used
a fresh browser navigation and isolated empty progress at800x600/DPR1. No RR
prefix was added. Actual evidence is in evidence/web-long-routes-after-dev:

| Level | Actual rAF / PNG | Attempts / accepted | Full ordered endpoint |
| --- | --- | --- | --- |
| infenter_first_2 |881 /310|22 /22|exact native fixture fields and71blocks|
| infenter_zone_v2 |1656 /479|41 /29|exact native fixture fields and87blocks|
| 1by1_playerr_flip2 |1275 /339|31 /19|exact native fixture fields and123blocks|

All94 attempted directions and all24 blocked attempts are retained. The
reproducible scripts/parity-compare-long-routes.py checks options, viewport,
starting guards, every recorded accepted/blocked count, complete ordered
endpoint block arrays and1131 capture-file hashes. Past/future counts are not
exposed by the Web debug API and are not newly measured by these captures;
the original-conformance tests cover those independently.

One initial diagnostic classified Zone attempt20 by a timestamp window and
incorrectly included attempt21's count20. The callback has rAF timestamp
16144.3ms but action20-Left after the actual Left dispatch16146.2ms. rAF's
supplied frame timestamp can precede callback execution/input dispatch.
Recorded action labels and next event states identify Down count19 exactly.
The comparator uses recorded action ownership; raw timestamps are unchanged,
and no offset, rescheduling or tolerance was introduced.

The first old full-report relay reached count22 but timed out after300s and
returned no retained PNG or metadata. It receives no evidence credit. The
source capture function/options were then left unchanged, and diagnostic
parity-capture-sink.py plus parity-capture-transport-web.js persisted whole
reports directly through loopback. The receiver checks PNG signatures,
single-component paths, a bounded payload and existing-destination refusal;
it retains all images and per-frame metadata, not selected summaries. The
Zone capture used the equivalent inline transport before that wrapper file
was retained; capture-manifest.json records this distinction.

comparison.json retains nearest actual native/Web phase pairs and unscaled
1600px side-by-side pages, including explicit phase differences and missing
native tails. Main inspected last-motion/end pages for all three routes.
These are diagnostic pairs, not equal-phase pixel approval: the long flip's
independent MiscAnimT/shine and clone-blackout phase must still be matched.
The first route's native white player outline versus Web black at the exact
structural endpoint is a new observed gap under source investigation. No
whole-route visual or timing approval follows from endpoint equality.

Observed screenshot-recording rAF medians are16.7ms; maxima50.2/66.7/150ms
with3/3/4intervals greater than50ms. PNG readback affects pacing, so these are
capture-time observations, not an uninstrumented performance conclusion.
Independent actual image and final immutable integrated review remain pending.

## Scope and early distinctions

The requested routes are infenter_first_2's 22 direction attempts,
infenter_zone_v2's 41 direction attempts, and 1by1_playerr_flip2's retained
31 direction attempts. An attempted input is not necessarily an accepted
turn. The existing structural fixtures end at moveCount22,29,19 respectively.
Whether each native capture begins from fresh source state or includes RR
setup must be resolved from capture records, rather than inferred from the
short flip diagnostic. A recursive initial image does not prove a strict or
generated infinity transition. Final values will be copied from actual native
records, with unsupported tails and discrepancies retained explicitly.

## Exact routes and starting states

All three captures start from a freshly loaded source level with moveCount0,
pastCount0/futureCount0, cameraFlipH=false, no active camera/body movement and
no direction setup. The flip route starts player51 at outer0,(3,2),sub1.
RR is not included before, inside a hidden setup, or in addition to its31
listed inputs. The separate short RR-then-Down capture is a different case.

| Level | Exact retained sequence | Attempts / accepted | Start player | Actual structural endpoint |
| --- | --- | --- | --- | --- |
| infenter_first_2 | URDLRRUULDRULLDDRURDLU | 22 / 22 | index25, outer0,(4,4),sub1,flip=false | move22, outer0,(5,5),sub1,flip=false |
| infenter_zone_v2 | URDLRRUULDRULLDDRURDLURRRRRUUUUULLLLLDDDD | 41 / 29 | index57, outer0,(4,4),sub10,flip=false | move29, outer0,(5,2),sub10,flip=false |
| 1by1_playerr_flip2 | DDRURLUDDLUDDLRUDRUDLDRDULDRRRD | 31 / 19 | index51, outer0,(3,2),sub1,flip=false | move19, outer1,(0,0),sub1,flip=true |

Every endpoint has winning=false, buttonsSatisfied=false, wentToInfZone=false,
futureCount0, and pastCount equal to its accepted-turn count. Only the first
walk has finishesSatisfied=true; zone and flip have finishesSatisfied=false.
Final pruned structural block counts are71,87,123 respectively. Player
movedSinceRestart=true in all three. Starting zone buttonsSatisfied=true;
the other two start false. These are copied from native start/end records,
not inferred from the route names or current Web output.

Native route directories under docs/parity/evidence/original are:

- infenter-first-walk-native-v1-20261025
- infenter-zone-focused-native-v1-20261025
- flip-recursive-long-native-v1-20261025

Their exact structural endpoints match, including complete ordered block
arrays, the respective tests/fixtures/original files
infenter_first_2-walk.json, infenter_zone_v2-focused.json and
1by1_playerr_flip2-long-route.json. The latter is an independent native
structural run; its original route.json fixture field is null, so the
association is established by the full endpoint and all31 commands rather
than inventing a fixture field in the retained capture.

## Attempted versus accepted inputs

The walk accepts every input. Zone's blocked attempts are
14,24,25,26,27,29,30,31,32,35,36,37. Flip's blocked attempts are
2,3,10,13,14,15,18,21,22,23,24,27. Keep these inputs in the Web schedule:
deleting them changes the delivered route and removes its bump/hold phases.

Each accepted native history-before:TurnCompleted boundary was cross-checked
against recursive-family-native-index.json and the full phases.json. Every
fixture hash change corresponds exactly to an accepted boundary, and every
unchanged consecutive fixture hash corresponds to a blocked input. The
contract retains each attempt's actual moveCountAfter, after-command fixture
hash, last saved native image/state, observed key press/release time and
accepted history boundary reference. History-before preserves the accepted
Movement.moves list; later TurnCompleted preview processing reuses it.

## Strict mechanics actually established

infenter_first_2's22-input walk has no accepted strict infinite Enter, no
strict infinite Exit, no clone entry and no generated-zone entry evidence.
Its recursive rendering and level name do not change that coverage limit.

Zone's final attempt41, Down, accepts move29. At native frame94272,
elapsed28358.81ms, the accepted scratch list contains raw block59,
Enter,infEnterNum0,fromLevel-1,toLevel7. This satisfies the strict Enter
predicate: accepted type Enter with infEnterNum>=0. Its other accepted moves
are raw57 and74 Slides. Strict Exit requires type Exit with infExitNum>=0;
none occurs. Endpoint wentToInfZone=false, so no newly generated-zone credit
is assigned. This route is not the separate DDDU generated-zone diagnostic.

Flip's final attempt31, Down, accepts move19. At frame110051,
elapsed21317.8262ms, cloneEntry=true and raw block51 has Slide0->0 followed
by Enter0->1 with infEnterNum=-1. That proves a noncanonical clone entry and
the final self1x1 flipped player. It does not satisfy strict infinite Enter,
strict infinite Exit or generated-zone coverage. Raw movement/focus indices
are not automatically interchangeable with pruned snapshot indices.

## Ready-to-use Web capture options

long-route-capture-contract.json contains routes[].captureWebOptions for
scripts/parity-capture-web.js. Main can use the object's options unchanged
with its actual Canvas capture transport. Each options object has the source
level, setupActions=[], expectedStarting,800x600/DPR1 viewport guard, all
direction events, captureStateChanges/captureMotion/captureCameraMotion=true
and650ms final release observation. No browser action has been run here.

The source-native schedule is direction40ms then NONE650ms per attempt.
Actual native event starts fall on instrumented frame boundaries: for
example the first walk's initial release is55.76706ms, not40ms. The contract's
primary Web events use each actual capture eventStartMs and the difference
between its release and press event starts. The source-spec nominal690ms
press spacing/40ms hold is recorded separately as an explicit alternate,
not silently substituted. Preserve actual Web event timestamps: timers,
Canvas encoding and frame boundaries still prevent identical wall-clock
delivery from being assumed.

The options' expectedStarting fields are compatible with the current script
sample shape. expectedEndingStructural is a separate comparison contract;
the existing capture function does not assert those fields automatically.
It includes the original ordered-state SHA256 used by the conformance
harness. Main should compare the actual live Web endpoint and attempt
acceptance, then align states/phases for image review. Running the pure
MovementEngine harness cannot substitute for actual Canvas route coverage.

## Native state and phase anchors

Native SparseMotion retained all frame states but sampled PNGs at event
starts, every eighth frame and the final40ms of each event. The three routes
have910/214,1633/376 and1268/304 states/PNGs;696,1257 and964 frame image
entries respectively remain null. The contract never reconstructs them.

Each attempt has its last retained release image plus actual player state
and animation/camera phase. Beginning and final accepted primary motions
also have nearest saved PNG selections for nominal.25/.5/.75/1 targets,
with actualPhase, phaseDifference and a flag recording whether the requested
target lies inside saved primary-motion phase coverage. A target label
does not turn a nearest PNG into that exact phase.

For example the final walk's nearest saved primary image is only.50701
at frame-0871.png for both nominal.75 and1 targets. Those tails are explicitly
unsupported as requested-phase PNGs. The zone final primary NORMAL length.5
has actual saved phases.351158/.625134/.897048; the flip final primary NORMAL
length.5 has.366438/.633565/.900663. Match Web to these actual values and
states, not to the lookup labels. All metadata remains available in the
hashed native capture if more exact nonimage states are needed.

The final native PNGs are frame-0909.png, frame-1632.png and frame-1267.png.
All have AnyBlockMoving=false and settled camera phase1, but their recorded
BUMP_HALT times/lengths are.235931888/.22,.1815567/.22 and.1904213/.22.
Zone and flip still have nonzero draw offsets/scales; do not call these
animation-neutral endpoints merely because the structural route is done.
The flip final camera is newX=-1,newY=3,newXS=newYS=.111111112 and
cameraFlipH=true. Full native start/end draw anchors are included in JSON.

## Provenance and limits

JSON provenance stores SHA256 for all route/capture/phases/start/end files,
the original structural fixtures, selected actual PNGs, observer-build
records, source level text, capture/index generators, current Web capture
script and conformance harness. The original source hashes for Draw,
Projection, Movement, UndoManager, World and Block are copied from the
retained native index and match the available original export. Observer
source/DLL SHA256 values are the retained build record, not a claim that
the currently evolving observer binary is the same build.

No suffix after the final retained input is supported by these captures.
Undo/redo/restart, pause, extra RR prefixes, further direction tails and
generated-zone routes need separate evidence. Native accepted routes and
ordered structural hashes do not establish Web visual equality, frame
pacing, cross-DPR behavior or full-game approval. Main owns actual integrated
Web replay, state/phase pairing, immutable PNG review and any later commits.

Final read-only validation checks all94 attempt/event entries, all28 critical
per-route provenance files,20 selected PNG hashes, six original source hashes,
fixture start/end ordered-state hashes, every acceptance map and each selected
frame's actual state/phase against the retained originals. All checks pass.
The prepared JSON SHA256 is
a09e4ae08035f47c01e4e4cfab6b393d1530ca5d661707e1e3553f9a6156253b.
This validates the capture contract, not an unperformed Web replay.
