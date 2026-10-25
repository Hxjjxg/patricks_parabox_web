# Native possession eye transfer

## Observation

The exact `possess_first` route LDDL then L switches donor41 to receiver34.
Native `possess-focused-motion-20261025/frame-0012.png` is STILL/camera
.2537177; clean Web `possess/motion-0001-still-0.5.png` is .2535. Native
solid eyes travel between donor and receiver while the donor becomes hollow.
The old Web retains solid eyes on donor and hides the traveling face.
Settled ownership agrees; this is action phase rather than blink phase.
The independent crop plate is
`evidence/review/production-v2-clean-possess-eye-transfer-crops.png`.

## Hypotheses and minimal experiments

1. **Stale donor draw ownership (confirmed).** `UndoManager.cs367–382` sets
   donor `DrawIsPlayer=false` and receiver `true` with ownership, then sets
   receiver `false` only on a new animated move. Web only changed `isPlayer`.
   A five-line actual-route diagnostic at .25 seconds returned donor
   `[41,false,true]`, receiver `[34,false]`. The unchanged donor flag directly
   selects solid eye texture. Fresh-move and redo regression assertions fail
   before the fix with `[true,false]` and `[false,true,true,false]`.
2. **Moving face obscured by later backing (confirmed).** Native
   `Draw.cs6005–6028` enqueues face phantoms in qFace; qStill/qBump/qPhant/
   qMove and qPossessable exhaust first (`2522–2566`). Web drew the phantom
   inside the root backing pass, before child geometry. The actual-route
   renderer regression returns phantom face event1 before last backing3,
   and fails the required face-after-backing ordering before the fix.
3. **Missing or incorrect phantom interpolation (rejected for this route).**
   The same diagnostic has exactly one face phantom for receiver34 with
   x=.5,y=0,xScale=yScale=1 at .25/.5. This is the expected midpoint of the
   source's unit-cell interpolation and proves that the moving face exists.
   No interpolation speed or camera easing adjustment is needed.

## Fix

`History.applyTurn` ports the exact forward/backward native draw-flag writes,
including immediate undo/redo ownership. The existing fresh-move receiver
override remains intact. No generic post-history draw-flag reset is added.

Face phantoms become deferred effect tickets, sharing qFace priority with
solid player eyes after ordinary hollow faces. They do not enqueue receiver
infinity or flip-shine effects. Their face flip is the parent ticket parity
(`Draw.cs6015` cancels the receiver's own FlipH twice).

`phantomRendering.ts` ports the source representation test: exclude only
`exitedFrom == current ticket.block`, with GRID exception, and suppress
phantoms under QUICK_ANIM. The source flag10 uses the donor's exact first
entered representation rather than its canonical sublevel. Alternate
representations use cell dimensions and intersect the inherited clip with
the current board. Outgoing phantom slides use their local interpolation
and global transition squish (`5975–6004`, `6361–6378`).

## Validation boundary

Six regressions cover the real LDDL+L fixture, halfway and settled flags,
immediate undo/redo flags, moving-face submission order/position, exact
entered versus alternate representation geometry/clips, outgoing slide
shape/flip, and GRID/QUICK_ANIM visibility. The three actual-route tests
failed before the production patch; after it all six pass.
Fresh immutable production PNG comparison remains required; these tests
do not claim full visual acceptance. No production build or dist is changed.
