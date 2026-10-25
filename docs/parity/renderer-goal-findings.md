# Native goal rendering port (2026-10-25)

## Proven mismatch

Independent PNG review of shed_first, setup RRRRU then Up40ms, found a stable goal sample at (380,201): native RGB145,162,189 versus Web RGB191,192,192. Eight halted native frames and four Web frames rule out procedural particle variation as the cause. The old renderer used one opaque neutral-gray ButtonTex quad.

## Native implementation

Draw.cs:3516?3628 does not use ButtonTex for normal goals. It uses canonical floor.OuterLevel.GetExitBlock() HSV, saturation multiplied by .75, value1, alpha.6. Active ordinary goals follow FinishesSatisfied; active player goals follow ButtonsSatisfied. QuadOscillate(AnimT+.5) changes alpha from .2 to .6 while retaining the tint. Inactive hub player goals use the native inactive LineColor instead.

The port preserves source float centers/dimensions and physical-pixel arithmetic, .0664 inset, .0725 thickness, the .2<thickness<=1 clamp, ties-to-even thickness rounding, disjoint corner strips, and SetDrawRect endpoint truncation. Player goals add only-eyes textures at the source strict width>200 physical-pixel threshold. QuickAnim uses the captured goal and player-goal textures.

HSVToRGBGUI divides color and alpha by2 before the GUI shader doubles them. Goal alpha is consequently the source .6, not direct-GUI .6*2. The existing measured half-RGB byte transfer is retained; actual PNG confirmation of goal blend quantization is still required.

Floor.cs:183?195 advances both goal clocks independently of activation while DelayFinishGlow is false. World.cs:981 also calls floor animation updates on its paused branch. The new goal clock branch therefore advances when paused; Info/DemoEnd keep their existing paused=-.4 behavior. This build only assigns DelayFinishGlow=false (World.cs:1129), but the explicit editable model flag preserves the source guard.

## Verification

The five actual drawFloor regression cases failed before the port and passed after it. Further tests cover ties-to-even, tiny-strip cutoff, DPR physical geometry, inactive hub color, delayed glow, and both goal types' paused/independent timing. Focused tests:13 tests in2 files pass; TypeScript typecheck passes. No production build/dist changes were made.

Pending: capture and independently compare the corrected actual shed goal and animated active goals. This module does not claim full renderer parity.
