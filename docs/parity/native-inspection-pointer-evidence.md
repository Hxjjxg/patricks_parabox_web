# Native inspection pointer evidence

Run scripts/parity-original/summarize-inspection-pointer.py to validate six
retained captures:467PNGs, including179PNGs in two valid source-gated branches,
plus four explicit diagnostics. The index is
docs/parity/evidence/original/inspection-pointer-native-index.json.

## Actual branches

- inspection-enter-pointer-native-v3-20261025: raw temporary Unity Mouse and
  effective Controls agree at340,top250. Original ComputeMousePosition maps
  cell(3,5), raw block81, nonfilled/still child. Original left branch at
  134.017944ms pushes81 and starts0.5s camera animation. Right at964.9048ms
  pops to root0 with0.5s camera. Settled end has unchanged puzzle state.
- inspection-third-gold-pointer-native-v2-20261025: point400,top190 maps
  cell(4,6), raw gold56, SubLevel=true/FilledWithWalls=true/Moving=false.
  Other original early gates pass. Left at117.177963ms leaves InspectBlock-1
  and camera still: native filled-child rejection is preserved.

Both click edges record ApplicationFocused=true. All raw device coordinates,
effective held/pressed/released values, native cell/candidate, hover, source
gates and before/after inspect identities are retained. Device audits observe
temporary-device removal and restoration of the previous Mouse.

## Scope and rejected attempts

The authorized BepInEx observer supplies a temporary in-process Unity
InputSystem Mouse for the original raw-coordinate read. Effective click flags
use the existing post-Controls.Update injection boundary. It never patches
ComputeMousePosition, InspectUpdate, FilledWithWalls or movement gates, and
does not invoke PushInspect/PopInspect during pointer timelines. This is not
an OS mouse, CUA, physical focus or whole-desktop input replay.

The two V1 attempts lack hook registration and raw-device coordinates. A
registration-only diagnostic records Controls340,210 but native cell(-3,-1),
proving the raw Mouse.current read. Enter V2 has correct device injection but
targets plain wall(3,6); the corrected V3 point targets the actual child.
All diagnostic PNGs/traces remain intact and are never accepted as parity.

Older inspection-third-push-pop-20261025 directly calls PushInspect(56),
bypassing the actual filled-child gate. Its raw camera evidence remains valid
only for the internal method/camera math. It proves neither a possible mouse
acceptance branch nor a production pointer interaction. Manifest and hardpath
index explicitly retain this distinction.

Source hashes, DLL hashes and source-gated regression assertions are recorded.
The registration-only diagnostic has an exact DLL hash but null source hash
because its source was not archived before later additions. No source hash is
invented. Screenshot cadence does not approve interactive frame pacing, and
these captures do not constitute final visual parity approval.
