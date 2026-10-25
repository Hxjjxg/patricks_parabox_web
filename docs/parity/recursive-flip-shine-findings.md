# Recursive flip-shine investigation

## Observation

Independent v4 review reports missing broad pale bands on recursive copies at
`BUMP_HALT t0` (`state-0018`, `camera-0001-1`) and at the NORMAL transition
near phase 0.4073. Geometry is closer, but that does not establish appearance
parity. The exact native/Web clock and draw-context correspondence is pending.

Native evidence already records 1,461 `DrawFlipShine` calls and 952 submitted
bands in `flip-recursive-shine-submitted-v1-20261025`. It retains actual
`MiscAnimT`, camera time, ticket geometry, clone-fade context, and submitted
post-clamp rectangles. A movement-phase bracket alone does not synchronize
`MiscAnimT`; the latter independently controls stripe width and position.

## Hypotheses and discriminating checks

1. **Missing effect context:** the Web ticket, flip intensity, clone-fade
   context, or effect ordering differs. Compare actual draw submissions and
   intensity using identical block state and ticket geometry. A correct helper
   result with an absent or overwritten draw implicates the caller.
2. **Clock mismatch:** native/Web movement phases are near each other, but
   `MiscAnimT` differs. Compare this clock before comparing stripe width; use
   recorded native inputs for a deterministic helper regression.
3. **Helper/clamp mismatch:** source `EnableClampAndStack` preserves fractional
   bounds when a ticket clamp already exists, whereas the prior helper
   floored its own rectangle unconditionally. Compare recorded requested and
   submitted rectangles; distinguish fractional clipping from broad band
   absence before choosing a fix.
4. **Different visual layer:** horizontal or broad pale areas belong to
   backing/border/clone layers. Identify source draw type and submission order
   instead of fitting shine offsets or changing alpha to match a screenshot.

## Confirmed local correction

`Draw.cs6169–6188` always adds self bounds to the queued shine ticket with
`StackClampTicket`. `EnableTicketClamp1336–1354` floors the resulting double
intersection. `DrawFlipShine3931` then stacks its own bounds again through
`EnableClampAndStack1357–1368`, using float endpoints. Finally
`DrawTexture1427–1466` intersects the snapped draw rectangle with these
bounds. This is a three-stage operation, even when the incoming block ticket
has no parent clip. The helper now follows these stages and accepts the
incoming parent clip as an optional final argument.

Four recorded ordinary block104 submissions at frames50/52/58/61 failed
before the correction. For example, frame52 previously returned
`[436,430,20,59]`; original submitted `[436,430.979675,20,58.0203247]`. The
regressions convert recorded decimal floats back to float32 and compare
exactly, with no tolerance. Both absent and broad inherited-clamp cases
now match. Restrictive parent clipping and the self right endpoint have
separate source-derived controls.

This changes subpixel edges, not stripe width, opacity, or timing. The main
agent integrated `ticket.clip` propagation through
`GameRenderer.drawFlipShine` to the helper's final argument, preserving
restrictive inherited clipping. Fresh production Canvas verification remains
with the main agent.

## Broad side bands and independent time

The original `shine-submitted` frame77 (`frame-0027.png`) is
`BUMP_HALT t0`, camera phase1, `MiscAnimT9.327032`. Its final ordinary
self1x1 player submissions alternate parity through depth14. Two retained
post-clamp records are depth0/true `[277,177,17,245]` and depth1/false
`[505,177,18,245]`, both raw GUI alpha0.22. Repeated overlapping white
stripes explain the near-neutral pale side bands in that actual PNG. This
is evidence against attributing the broad side bands to an unrelated thick
border; it does not establish the Web effect count or clock.

The v4 review comparison associates Web `state-0018` and `camera-0001-1`
with `flip-recursive-preview-topology-20261025/frame-0027.png`: physical
animation time is exactly0 for both. That original capture does not retain
`MiscAnimT`. The separate `shine-submitted` capture does, but its clock
cannot be silently transferred to the earlier capture. The v4 Web trace
also omits this clock, while setupR waits approximately816ms per command.

The same completed camera phase produces side bands at `MiscAnimT9.327032`
and no band at `MiscAnimT10`, using the unchanged source formula. This
deterministic control demonstrates why a missing band in movement-phase
brackets is insufficient to establish a shine defect. The active-instance
telemetry below now supplies the previously missing Web clock evidence.

## Actual active-instance clock evidence

`web-recursive-shine-clock-active-dev/flip/shine-telemetry.json` retains791
selected actual renderer calls from23,570 diagnostic observations. Its scope
is the capture window plus/minus30ms, player51 depths0/1 and ordinary104
depth<=1. It is not a complete record of all recursive depths or a claim
that every observation corresponds to a displayed frame. The actual
`trace.json` and16 PNGs retain image/frame timestamps. The earlier
`web-recursive-shine-clock-dev` prototype attempt recorded zero calls and
is an invalid diagnostic, not evidence of absent effects.

The recorded Web clocks are different from the native shine-probe clocks:

| Observed context | MiscAnimT | Source modulo phase | Actual output |
| --- | ---: | ---: | --- |
| Native probe halted t0 / camera1 |9.327032|0.7635162|17px and18px opposite-side stripes|
| Web initial camera0 actual call |9.949500000000002|1.0747502|No band; source pause interval|
| Web NORMAL camera0.282 actual call |10.090500000004475|1.1452501|No band; source pause interval|
| Web first halted t0 / camera1 |10.456900000004472|0.0284500|Depth0 `[522,177,1,245]`; depth1 opposite parity null|
| Web later settled / camera1 |11.023500000004477|0.3117504|Depth0 `[485,177,38,245]`; depth1 `[277,177,37,245]`|

The phases use the unchanged native float32 expression
`(MiscAnimT*0.5f)%1.3f`. For the same246px board, the first halted Web
clock requests only0.3185811px before snapping/clipping, whereas its later
clock requests38.25332px. The selected actual calls have alpha0.44 after
the established GUI transfer. The body and camera can therefore remain
unchanged while the shine becomes much wider.

The reviewer directly viewed `camera-0001-1.png`, `end.png`, and
`motion-0001-normal-0.5.png` in this active-instance capture. The first
halted PNG has no broad pale side bands; the later end PNG visibly has
broad white strips on both sides, with no clock override or fitted phase
correction. This observed progression supports **unmatched independent
shine phase**, rather than an omitted band formula/effect, as the explanation
for this capture's broad-strip presence/absence. The immutable v4 comparison
still lacks its exact shine clocks; this later diagnostic cannot retroactively
assign them. It invalidates treating a movement-phase match alone as proof
of a missing shine implementation.

The mostly black NORMAL midpoint image was separately compared with original
preview-topology frames0013/0014, which bracket Web body/camera time0.2575.
Both original images likewise show a black field and small magenta panel
near the bottom; that observation does not establish a missing-board defect.
Its numerical/source comparison is retained in
`recursive-flip-content-findings.md`. Wall brightness, exact
color/compositing, other phases and universal recursive appearance remain
outside this bounded conclusion.

## Scope and acceptance

This investigation owns the pure flip-shine helper and its regression tests.
GameRenderer/core integration and fresh Canvas captures remain with the main
agent. No clock alterations, tolerance inflation, fitted constants, or universal
visual approval is justified by helper tests alone.

## Verification

`npx vitest run tests/recursiveFlipShine.test.ts tests/flipShineRendering.test.ts`
passes 18/18 cases (14 new recursive cases plus4 existing renderer-wrapper
cases). `npm run typecheck` passes. Only the helper, new recursive test file,
and this findings document were initially edited by this investigation; no
staging or commit was performed. These checks establish the bounded native
rectangle correction, not approval of the v4 recursive scene appearance.

The follow-up `tests/flipShineRenderer.test.ts` adds three actual-clock
renderer-wrapper regressions and two inherited-clip integration regressions.
The three actual-clock outcomes pass without changing the clock or shine
formula. Both inherited-clip cases failed before main-agent callsite
integration: `[196,200.25,4,99.75]` instead of `[198,205,2,81]`. The main
agent completed the corresponding wrapper/effect-queue integration. The
combined focused run of `flipShineRenderer`, `recursiveFlipShine` and
`flipShineRendering` now passes23/23 tests, including both previously failing
inherited-clip cases. No clock override or shine formula adjustment was
introduced.
