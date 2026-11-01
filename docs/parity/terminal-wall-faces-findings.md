# Terminal wall faces investigation

Scope: terminal-LLLR native versus frozen v7 missing black/ring eyes. Own only GameRenderer.ts, terminalWallFaces.test.ts and this report; no UI/native/staging/commit actions. The debug-hypothesis skill was read; parent owns DEBUG.md.

## Hypotheses before experiment

1. ROOT H1: terminal wall path omits face submission. Supports: drawLevel wall loop calls drawWall but neither drawFace nor a face ticket; the container path records effects. Conflicts: phantom-terminal copies have a separate immediate-face branch and may mask the omission. Test the actual bundled infenter_poswall_setup LLLR route through real drawScenePass, distinguishing the current player body from old-cell phantom copies and checking possessable terminal bodies.
2. H2: face submitted with alpha zero/blink. Supports: moving possession fades player classification and faceAnimT changes textures. Conflicts: possessable rings do not blink. Test real faceQuads on the exact body rects and real drawFace fill calls, recording alpha/texture without changing time.
3. H3: eyes submitted but covered or clipped by later bodies. Supports: wall bodies share a shader graphics batch; queued containers can cover immediate draws. Conflicts: no observed direct call in the terminal loop. Test body/face submissions and graphics layer order under normal, flipped and inherited-clip passes; compare native ProcessTicket ordering.

## Source observations

Original exported Draw.cs ProcessTicket5882–5891 draws terminal DrawWall then immediately DrawFace when Possessable/IsPlayer, before continuing to later children/backings. It restores the ticket clamp after the shared simple-slide scope. DrawWall is geometry only. Terminal calls pass ticket.flipH as facePhantom and false as eye flipH, cloneFade=false (not the container XOR convention). Container6117–6149 instead queues Face with ticket.flipH!=block.FlipH and inherited clamp. DrawFace3952 onwards picks DrawIsPlayer||facePhantom, returns for QUICK_ANIM, computes positive size alpha for terminal walls, and blinks only the player classification. These source paths require separate ordering conventions.

## Experiments

Each diagnostic assertion body is at most five physical lines, on a reusable renderer recording harness. The actual real-route assertion failed before any production fix.

E1 (red, before production change): reusable harness drives the real bundled LLLR route, updates phase.25, and invokes real GameRenderer.drawScenePass/drawLevel. Only GPU/texture sinks are replaced by recording graphics; drawFace itself and faceQuads remain real. The <=5-line diagnostic assertion fails on absent face submissions. The one-line transient recorder showed root terminal16(player,possessable) alpha[.64510846138,.64510846138], submissions0; terminal15(possessable) alpha[.64106059074,.64106059074], submissions0. The existing old-cell phantom16 instead has one face and alpha.64651274681. Removing the transient recorder preserves the red regression. Owner+logical level identifies the current body because phantom16 shares both the player object and logical outer level.

Root cause confirmed: the regular terminal-wall branch omitted native ProcessTicket's immediate DrawFace call; eyes were never submitted. Positive quads refute zero-alpha as the cause at the observed phase, and zero submissions refute later masking/overdraw as the primary missing-eye cause. This does not claim every blink frame is identical to native.

## Focused fix and regression

After reporting red/root cause to the parent, added the exact native immediate-face call after terminal drawWall: facePhantom=parent flipH, eye flipH=false, cloneFade=false. It uses a fresh scene layer rather than the wall shader layer. Invalidating wallGraphics after this face ensures every subsequent wall is physically submitted after the face; otherwise its batched geometry could remain below/above an interleaved face incorrectly. No effectTickets, faceQuads, clock, textures, phantom rendering, or core logic changes.

The final test has six cases using real LLLR route: required current-body face submission, three phases.25/.5/.75, and both normal/flipped parent passes with a nontrivial inherited clip. It checks terminal15/16 identities, exactly adjacent wall→face submission, positive two-eye quads, native argument values, inherited clip equality, scene rather than wall shader layer, and subsequent wall layers above each face. Existing phantom route remains unchanged.

Validation: terminalWallFaces/terminalPhantomRoute/rendererDrawPolicy/faceRendering:4files16tests passed. TypeScript typecheck passed. Full suite (already completed before parent requested no more parallel runs):81files1195tests passed. Browser/native image validation remains parent-owned; this unit recording is not a claim of image parity. Parent has immutable-v7 before-route/before-continuous evidence under evidence/terminal-wall-faces-20261101 and original native evidence under evidence/original/terminal-LLLR-native-20261101.


## Retained red run transcript

The red evidence is preserved in this report (no separate log file was created outside ownership). Command: `npx vitest run tests/terminalWallFaces.test.ts`, before GameRenderer.ts edits, 2026-11-01 21:37:39 local. The temporary one-line recorder was subsequently removed.

```text
[{"id":16,"player":true,"possessable":true,"alpha":[0.6451084613800049,0.6451084613800049],"faces":0},
 {"id":15,"player":false,"possessable":true,"alpha":[0.6410605907440186,0.6410605907440186],"faces":0},
 {"id":16,"player":true,"possessable":true,"alpha":[0.6465127468109131,0.6465127468109131],"faces":1}]
FAIL tests/terminalWallFaces.test.ts > submits visible faces for the actual LLLR terminal current bodies
AssertionError: expected false to be true
Test Files 1 failed (1)
Tests 1 failed (1)
```

The third row is the existing phantom occurrence, not the missing current body. The final harness additionally requires currentTicket owner===logical level so the regression cannot pass accidentally by matching that phantom.

Owned files are released to the parent. No staging/commit occurred. Browser after-capture and any further full verification are parent-owned.
