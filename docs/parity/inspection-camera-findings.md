# Native pointer inspection camera

## References and reproduced failure

Original World.cs InspectUpdate/PushInspect/PopInspect/DoInspectZoomIn/DoInspectZoomOut and Draw.cs SetCameraOffset/DrawBlocks establish the mechanism. Native commit40cd690 captures actual source-gated pointer input: enter at top-left340,250 selects eligible child81; push and pop each use.5seconds. The gold56 at400,190 in third_puzzle is filled and is correctly rejected. The old forced INSPECT_56 capture bypassed InspectUpdate and supplies no physical-click approval.

Immutable Web candidate-v3 selects81/root0 using the same pointer coordinates, but cameraAnimLength remains0 and newCamT remains1 throughout94rAFstates. InspectionModel changed only logical focus. Four core regressions and two actual controller-pointer gate regressions fail before the fix.

## Changes and second root

InspectionModel now composes native float32 zoom arguments through the existing shared camera animation, including post-push/post-pop flip parity, enclosing/departing CamZoomFactor and enter-speed preference. ResetInspect resets offsets only when inspection has been active. Controller cameraMoving/AnyBlockMoving and child Moving gates mirror native eligibility; filled and direct-child rejection remain intact.

The timing-only dev-v1 capture restored offsets but exposed missing surrounding geometry: renderer skipped the entire existing ancestor walk when inspectionBlock was set. Native DrawBlocks2078–2148 walks enclosing levels regardless of inspection. A failing-before ticket regression records81/depth0 instead of0/depth-1. A single-line diagnostic, restored afterward, produces95rAFstates/12actualPNGs with the enclosing gray board restored. Production removes only the inspection exclusion; native3-level ancestry and recursive depth are retained.

## Bounded verification

- Focused52tests pass across inspection/controller/hit testing. Eight initial regressions fail before the corresponding fixes; additional checks cover4speed preferences, variable/long frames, flip/zoom factors, reset isolation, canvas CSS offset/scaling and mirrored hit testing. Full56files/879tests and typecheck pass.
- Complete actual development capture: evidence/web-inspection-camera-dev-v2,94rAFstates/12PNGs,800x600physical/CSS backing,DPR1. Natural pointer schedule:left0/up50/right850/up900. Captures quarter camera phases separately from player motion. Source hashes are equal before/after capture and the precise working-tree source patch is retained.
- Push retains newX/newY=-1/-1,newXS/newYS=float32(1/9); pop retains float32(1/9),float32(1/9),9,9. Both interpolate for.5seconds with unchanged existing easing. End state is inspected root0/player62 at(1,1),count0.
- The old dev-v1 is an explicitly incomplete timing-only intermediate; ancestor-experiment is a diagnostic, not a production revision. Final immutable integrated v4 and independent actual-image approval remain pending. No sampled result establishes universal parity.

## Reproducible production evidence

scripts/parity-build-snapshot.py archives the previous dist only after verifying every manifest hash, builds with npm run build, rejects source or HEAD changes during build, saves new source/dist hashes and retains the exact new assets under build-dist. Existing manifests are never overwritten. This lets subsequent capture/review use immutable assets even when development continues.
