# Native Leave held controls in Web

Native evidence544ac86 establishes horizontal and vertical Leave asymmetry:
RIGHT changes cleared dxLast and reserves during JumpOut; DOWN retains dyLast,
waits through flight and reenters only on the update after landing.

The Web menu previously discarded direction keydowns, explicitly loaded Hub
without preserving controls, and reset controls again at the action footer.
Those reset paths are corrected. Pause retains physical directions and its
existing scheduler. Leave sets the source wait gate and last vertical direction
without adding a delay or changing JumpOut curves. Keyup remains authoritative.

Two further source assumptions were exposed: a newly sampled physical key can
match native dxLast/dyLast, so the wait gate applies to every request; rebuilding
the direction stack must not reset the repeat counter. The native idle counter
continues accumulating even with no held direction. Direct press/release helper
contracts remain intact; logical changes in the controller still mark1000
eligibility and actual impulses consume it.

Right/Down menu regressions fail before the repair; the released-before-Confirm
case passes and remains covered. A separate idle/resampling regression fails
before the scheduler correction. The initial debug-impulse-only setup had only
.067 accumulated seconds at the first post-landing sample, below configured
.07; that is not a production failure. The final controller setup uses actual
held entry/gameplay, preserving native counter eligibility rather than changing
the delay or injecting a balancing value.

Actual800x600/DPR1 natural-rAF traces are retained:

| Capture | Frames | PNGs | Observed behavior |
| --- | ---: | ---: | --- |
| before held-right |214|23|Hub count0 throughout flight and after landing|
| before held-down |215|23|Hub count0; no reentry|
| after held-right |213|40|first observed Hub rAF count1/JumpOut T0; applies Right next update after landing|
| after held-down |214|29|all flight counts0; next update after landing starts JumpIn; returns to first_puzzle|

Directories are evidence/web-hub-leave-controls-before-dev and
evidence/web-hub-leave-controls-after-dev. The latter retains exact source
hashes and phase-comparison.json. Event and rAF clocks are recorded independently;
the Confirm key event records load count0 before the first rAF reservation.
Native controls-delivered and Web KeyboardEvent schedules differ, so these
artifacts establish phase/order support, not equal wall-clock input latency.

Full62files/986tests, typecheck and production build pass with current Hub
rendering candidates present. The affected controller/input suites pass60tests.
Pause/unpause camera scaling is a separately confirmed open discrepancy.
LEFT/UP, simultaneous keys and QUICK_ANIM Leave are not newly runtime-verified;
independent final integrated acceptance remains required.
