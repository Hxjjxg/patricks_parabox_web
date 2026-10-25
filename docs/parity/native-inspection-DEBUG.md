# Native inspection evidence DEBUG

## Observations

- Enter/third V1 injected-pointer captures retain86/84PNGs but inspection
  samples are empty; phase traces remain populated and inspect identities
  only change from-1 to root0. These V1s are diagnostic, not pointer proof.
- New InspectionBoundaryPatch exists, but Awake explicitly registers every
  patch class rather than scanning the assembly. It omits the new class.
- Original World.ComputeMousePosition reads Mouse.current.position directly,
  independent of Controls.mouseX/mouseY. Input booleans alone cannot replay
  that native mapping path. Original InspectUpdate applies all source gates.

## Hypotheses

1. H1, ROOT for missing telemetry: hook class is never registered. Supported
   by Awake source and zero samples despite hundreds of update phases.
   No conflicting evidence. Experiment: add its one registration line only;
   identical pointer-control scenario must now emit before/after samples.
2. H2, ROOT for wrong mapping: native raw Mouse.current position disagrees
   with injected Controls coordinates. Supported by actual decompiled source;
   no actual candidate telemetry yet. Experiment: after H1, compare declared
   top-left340,210 against actual ComputeMousePosition cell. A true raw input
   path must target enter's nonfilled child at3,5, not an outside/root cell.
3. H3: chosen geometry is wrong. Initial coordinates are based on the native
   root board, but no source-gated candidate recorded yet. Once raw input is
   delivered, inspect exact native candidate/cell and preserve any rejection.

## Experiments

H1 experiment changed one registration line, rebuilt0warnings/errors, and
captured inspection-enter-pointer-hook-diagnostic-v1 (21PNGs). It emits42
before/after samples. H1 is confirmed; this is required final telemetry.

H2 source/data experiment confirms the mismatch: effective Controls340,top210
coexists with actual original ComputeMousePosition cell(-3,-1), out-of-bounds.
All early-return gates pass. The left click therefore calls native PopInspect
and selects root0, rather than the blue child. H2 is confirmed independently
of any guessed coordinate correction. The diagnostic raw files are retained.

## Root cause

New hooks require explicit registration, and original coordinate mapping reads
the Unity Mouse device directly rather than effective Controls coordinates.

## Fix and next experiment

Register read-only inspection telemetry. Supply requested coordinates through
a temporary Unity InputSystem Mouse device, retain existing effective input
flags, and restore the previous device afterward. Do not patch native mapping
or inspectability gates. Record raw current-device identity/coordinates and
the actual native computed candidate.

H2 fix validation: V2 third at400,top190 maps native cell4,6 and candidate56
with SubLevel/FilledWithWalls=true/Moving=false; all other gates pass, native
left click leaves InspectBlock=-1. Temporary device removal/restoration both
record true. V2 enter at340,top210 maps3,6 (a plain wall24), so H3 is confirmed
for the originally estimated enter coordinate. This V2 enter is retained as
a wrong-cell diagnostic; derive corrected enter point340,top250 and observe
the actual native candidate before awarding inspection-push coverage.

H3 result: enter V3 at340,top250 targets actual native cell3,5/raw block81,
SubLevel=true/FilledWithWalls=false/Moving=false. Original left branch
changes InspectBlock-1→81 and starts0.5s camera; later right changes81→root0
and starts0.5s camera. Both temporary-device release checks are true.
The filled third-gold rejection and valid enter push/pop are now independent
source-gated runtime cases; V1/hook/V2-enter diagnostics remain preserved.
