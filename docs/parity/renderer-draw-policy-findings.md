# Native minimum draw size and infinity recursion performance

## Observation

The frozen production v3 infenter_zone_v2 DD setup reached the correct
settled player57, outer0, x4,y2, moveCount2, no animation/camera movement.
It nevertheless rendered only5 frames in1849.1ms, median383.2ms, with
the document visible and no PNG capture. Native steady rendering was60FPS.
This rejects the earlier assumption that PNG readback explained every stall.

The development counterpart at800x600 produced4104 drawLevel calls per
draw, including4095 level4 recursive copies;5165 walls,6170 layers,
596 shadow textures, and zero masks. Draw CPU alone was113.7–179.1ms
in the last10 sampled draws. Closing old task tabs and blanking the other
heavy page improved pacing but left7 frames/1990.3ms, median283.2ms.
The active world and level4 rectangle/depth distribution were unchanged.

Evidence is retained under
evidence/web-production-candidate-v3/performance/:
infinity-setup-failure.json, infinity-dev-before.json,
infinity-recursive-tickets.json, infinity-native-threshold-experiment.json,
infinity-dev-after.json and infinity-dev-after.png.
These are diagnostic runtime artifacts, not claims that frozen v3 is fixed.

## Hypotheses and experiments

1. Missing inherited-clip culling could expand recursive queues. Native
   ProcessTicket does use clamp endpoints expanded by2 pixels. However all
   problematic tickets had null clips and masks0. This candidate cannot
   explain the settled DD case and was not added as its fix.
2. Pixi masks/GPU submission or other active tabs could dominate pacing.
   Other tabs contributed some load, but the4104ticket traversal consumed
   over100ms of CPU before rendering; masks were absent. This is not the
   primary cause of the persistent case.
3. The renderer omitted original scene-specific minDrawSize gates. Read-only
   dnSpy source confirmed this. Draw.DrawBlocks token0x0600004B sets
   infenter_zone_v2 to shortScreenEdge*.009f and then max(size,1f).
   At600px the exact float32 threshold is5.399999618530273. The Web
   renderer instead queued descendants and only rejected whole tickets
   at width/height<=.5px. This is the confirmed root cause.

The original ProcessTicket token0x06000086 checks child width OR height
against minDrawSize before drawing shadows/walls or queueing recursive
backings/phantoms. Floor submission checks the parent cell dimensions.
The incoming backing itself remains valid even if its cells are too small.
No native global recursion depth change is involved.

The measured level4 tree was:

| Depth | Width(px) | Original Web entries |
|---|---:|---:|
|1|54.6667|3|
|2|18.2222|12|
|3|6.07407|48|
|4|2.02469|192|
|5|.674897|768|
|6|.224966|3072|

A single-variable browser experiment retained depth15 and rejected only
incoming drawLevel rectangles below the exact native5.4px threshold. It
restored every wrapper in finally. At the same settled DD state it produced
90 rAF callbacks in1520.7ms, median16.6ms, maximum33.3ms. Last10 draw
CPU durations were2.1–9.5ms; renderFrame5.5–12ms. Geometry entries fell
to264, of which192 were rejected;410 layers remained because this
diagnostic still queued the rejected generation. This isolates the native
threshold as the cause of the roughly3.5FPS to60FPS change.

## Implementation

drawPolicy.ts ports the native physical-pixel float arithmetic, converting
the resulting threshold back to CSS units for renderer resolution.
The source policies are default max(short*.0005f,1),
infenter_zone_v2 max(short*.009f,1),
3by3_fun_clone_heist max(short*.013f,1), and iii max(short*.003f,1).
Particle cutoffs are separate: default short*.0005f, heist short*.01f,
iii short*.003f, with no one-pixel particle floor.

The related original heist policy limits moving blocks after depth2,
particles/shadows after that depth, and phantoms after that depth. The iii
specialEffect13 policy suppresses particles/shadows at depth>=1. These
source gates are retained with the same policy rather than hidden in
arbitrary performance constants. Native depth15 is unchanged.

GameRenderer applies the original size criterion to raw child scale before
simple-slide adjustment, so walls, shadows, containers and phantoms are
omitted before expensive geometry or queue submission. The criterion uses
either dimension>=cutoff, preserving thin visible rectangles. A tiny incoming
backing is not silently discarded by the previous generic.5px early return.
No controls, native Jost, TUI font, or game state logic was changed.

The deterministic actual-renderer DD regression derives63 level4 copies:
3*(1+4+16). Its6.074px final boards draw their own backing while their
2.024px cells do not submit children. It asserts72 total backing tickets,
maximum observed depth3 and218 layers for this particular800x600 state.
These are consequences of the source threshold, not new depth/layer limits.
The same test was executed against an isolated HEAD renderer copy and
failed with actual4095 level4 copies versus expected63. Both temporary
source/test copies were removed; the live renderer was not reverted.
The implemented version passes the identical assertion. Helper tests additionally
cover all native policy values, physical/CSS conversion and exact inclusive
either-dimension boundaries.

## Verification scope

The current tree passes55test files/862tests and typecheck. Actual browser
profiling of the implemented prequeue gate at the settled DD state gives
91 rAF callbacks in1505.7ms, median16.7ms and maximum17.4ms. Level4 is
exactly63 copies. The live context submits73 backing entries,126wall calls,
221layers and30shadow textures; last sampled draw CPU is2.4–2.7ms and
renderFrame3.5–5.7ms. This separate actual sample confirms the implementation
recovers natural60FPS without PNG readback. The deterministic harness has
72total entries/218layers; its shared acceptance invariant is the same63
recursive copies, while the live camera/context submits one more nonrecursive
level9 entry. These context totals are observations, not limits.

Independent native/Web PNG review remains a separate acceptance step; the
performance evidence does not establish pixel parity. Frozen production v3
was not rebuilt or modified by this module. Other native clipping and special
scene traversal paths remain independent parity work.
