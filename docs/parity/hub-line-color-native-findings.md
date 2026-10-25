# Native inactive Hub line color and ordinary particle compositing

Date: 2026-10-25. Scoped source/draw-input investigation, not whole-Hub approval. The coordinator authorized temporary logging-only BepInEx hooks and debug-copy restarts. Original observer source/DLL and save are restored byte-exact; final PID32672 is settled third_puzzle800x600. No production renderer/controller, game rules, colors, exported assets, browser or Steam original changes occur.

[hub-line-color-native-derived.json](evidence/original/hub-line-color-native-derived.json) retains source/asset hashes, actual arguments, pixel data, five raw diagnostic runs and restoration audit. [hub-line-color-native-derived-il.json](evidence/original/hub-line-color-native-derived-il.json) contains read-only Mono.Cecil output from the actual debug Assembly-CSharp.dll. All original reference files remain unchanged.

This owned document carries the debug-hypothesis DEBUG.md trail because the coordinator restricts this module to native evidence documents.

## Observations

Original intro-third-win-held-native-v1-20261025/frame-0096.png has inactive RGB(10,28,52) at(490,367),(490,368), but(13,35,66) at(490,375). Active(300,253),(330,253) is(60,112,190). Native x482 through495 has the dark pair at y367..368, then the brighter inactive color continuously at y369..395. The line rectangle is[482,337,14,59]. The portal shadow ends exactly at y369; that explains the spatial boundary without changing a LineColor formula.

Independent captures show that neither bright baseline nor shadowed color is universal: empty-save/Leave and fresh-loaded Hub samples can have unshadowed(10,28,52), shadowed(7,20,37). The natural-win V1 diagnostic reproduces bright(13,35,66) while the restarted V2 natural-win diagnostic produces ordinary(10,28,52), despite identical input parameters. Random render-layer state, rather than a deterministic win-specific tint, must be considered.

## Hypotheses and experiments

- H1, portal shadow plus a different baseline LineColor RGBA. Shadow geometry/order is confirmed, but a baseline parameter difference is rejected by direct runtime arguments.
- H2, native parent HSV/ticket/fraction differs from Web. Rejected for all five diagnostic captures: actual values below are identical.
- H3, a later spatial overlay modifies some segments. Supported by direct V2 particle draw and exact source compositing predictions. The late layer is an ordinary Hub particle, not a changed line gradient or palette.
- H4, recovered C# differs from executed assembly. Rejected for inspected LineColor, HSVToRGBGUI and DrawPortalShadow IL/constants. This does not inspect all native graphics internals.

The initial source-only pass made no game changes. Logging pass V1 recorded ProcessTicket parent fields, both DrawPortalLines colors, actual segment colors and DrawPortalShadow final DrawTexture color/rect. Pass V2 additionally recorded only DrawTexture calls whose rectangles cover(490,367),(490,375) or(300,253), with caller stack and GUI.color/enabled. Hooks have no ref arguments, no Prefix returning false, no result mutation and no native gameplay/render field writes. All five captures use the existing isolated-save wrapper; all audits confirm unchanged persisted save and restored prior in-memory save. The source patch is preserved under hub-line-input-observer-v1-20261025; the tracked observer source is fully restored.

## Direct runtime line inputs

All logged arguments across all five runs have exactly one unique input tuple:

| Field | Actual native value |
| --- | --- |
| Area | Area_Intro,11?11 |
| Parent HSV | [.6,.8,1] |
| Root ticket (centerX,centerY,width,height) | [400,300,491.9999957084656,491.9999957084656] |
| Hue offset |0 |
| Active raw GUI RGBA | [.119015679,.220178977,.371924,.5] |
| Inactive raw GUI RGBA | [.0206624456,.0537223481,.103312232,.5] |
| Lock-door shadow raw GUI RGBA | [0,0,0,.15] |
| Lock-door shadow actual pixel rect | [469,324,44,45] |

The shadow center is(489.45454467426646,344.72727233713323), cell size44.727272337133236. Native ComputeBorderThickness rounds the cell/30 result to1, and DrawPortalShadow shifts by2. Its[469,324,44,45] rectangle covers y367/368 and excludes y369. Both LineColor values reach DrawPortalLine unchanged. V2 shows GUI.color=[1,1,1,1], GUI.enabled=true at the probe draws. No changed root HSV, palette, fraction, raw RGBA or direct helper argument explains the brighter pixels.

Source Draw.cs:4159-4173 and inspected IL agree on active*.9, inactive*.25, with the parent saturation and active saturation*.85. HSVToRGBGUI halves RGBA (1516-1523). The Hub asset line1422 defines(.6,.8,1); LoadLevel.ApplyPalette explicitly skips its block palette replacement while World.InHub (988-1033). Full_white is32?32 all255RGBA, so a nonopaque source white texture is rejected.

## Logged ordinary particle explains the exact residuals

V2 third-only-loaded final frame26847 logs this additional draw AFTER connection passes and portal shadows:

- texture full_white; rectangle[234,245,214,214]; raw GUI RGBA[.099999994,.259999931,.5,.035].
- Caller stack goes through Draw.ProcessTicket, covering active pixel(300,253). GUI color remains white/enabled.
- The final active pixel changes from ordinary(60,112,190) to(59,113,195), exactly as observed in that frame and at old reference(285,253).

Particle.SpawnParticleLevel (Particle.cs:489-509) chooses random size.3 to.5 of its board, copies the area's exit-block HSV, calls HSVToRGBGUI, then overrides raw alpha to.035. Position/velocity use Random.Range. Draw.cs:5687-5707 draws these non-celebration particles AFTER line and portal-shadow draws. This is a large translucent colored square, distinct from void particles and from the root center-gradient texture.

Using this actual submitted RGBA, the native half-color convention gives approximately RGB(51,133,255), alpha.07. With no fitted brightness or tint, ordinary source-over predicts:

| Base pixel | After logged blue particle | Observed target |
| --- | --- | --- |
| Inactive(10,28,52) |(13,35,66) | old reference unshadowed residual |
| Shadowed inactive(7,20,37) |(10,28,52) | old reference shadowed residual |
| Active(60,112,190) |(59,113,195) | directly logged V2 final pixel |

The fixture preserves both direct float half-color and the previously supported half-color-byte candidate. Both produce the same three predicted byte triplets here, so this argument does not identify all GPU quantization details. The ordinary-particle layer explains the delta without altering LineColor. It also explains why independently seeded/timed native captures need not share those line pixel values.

The exact old frame0096/bright V1 particle rectangle was not captured by the V1 argument-only hook. Assigning those old inactive deltas to the same source particle mechanism is supported source/image inference; it is not falsely labeled a direct per-particle log for that old frame. The V2 direct particle proof is at the active pixel. No late DrawTexture overlay covers the inactive point in the normal V2 win final frame; its unshadowed pixel therefore remains(10,28,52).

## Result and restoration

Keep the source-derived inactive base0a1c34. Do not globally brighten it to0d2342 or compensate the shadowed pair. The Web comparison must respect the native line?portal-shadow?ordinary-level-particle draw order and compare particle-free pixels or synchronized particle state. The unresolved old-particle rectangle and private GPU submission details do not justify a fitted color correction.

Both diagnostic builds report0warnings/errors. The first --no-restore attempt failed only because obj/project.assets.json was absent; the subsequent restore/build succeeded. Build logs and instrumented source/DLLs are retained. Original source SHA25678f656710c7f39193887a0d1c70d4103a3953656e7ba3d6ff4ea5aa64fb9bc45 and DLL SHA256e0e22b2b9be36a02c49cf1f0cd8aa10f3ca67c05edd6344bf810ca1a6e3f9360 are restored. Save SHA25640e7f4ce65bc9819119c0a83f967a77bfa1d20fe78651307329b23a8e271304a is unchanged before instrumentation and after the restored-runtime audit. The temporary raw save backup was removed after verification; only its hash/audit is retained. The short audit captures the original observer running third_puzzle800x600. No production fix or whole-Hub approval is included.

The restored observer source is also rebuilt cleanly (0warnings/errors); Mono.Cecil confirms zero HubLine diagnostic nested types in the build output. The active runtime DLL remains the exact original backup. This clears diagnostic build-cache reuse without changing the restored running observer.
