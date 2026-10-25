# Hub caption renderer integration regressions

2026-10-25. Owned files are only new
tests/hubCaptionRendererIntegration.test.ts and this new record. No
existing production/shared file, native/browser UI, injection, staging
or commit was changed by this subtask. Main owns the actual renderer,
helpers and production integration. These are source/callsite regressions,
with no new native screenshot or visual approval.

## Observation and discriminators

Initial GameRenderer had no drawHubCaption/drawWallBody wrapper connection.
Its wall draw could return without captions; portal draw used an ordinary
cell and lacked pause references and the hard2 global-unlocking gate.
Three distinct risks are tested: disconnected live descriptors; applying
source pixel geometry in CSS coordinates or reusing stale camera geometry;
and losing source HDR color/layer order at a GUI insertion. Pure projection
helper tests do not prove any of those production callsites.

The authoritative recovered source is
F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/Draw.cs.
DrawWall2995 onward multiplies dimensions around the unchanged center by
the float32 counting-pop scale. Unlock body brightness at3018 is the
float Lerp(1,1.65,T/Length), before texture sampling. The caption branch
at3053–3078 is after body drawing; it uses the live counting numerator,
independent denominator and separate horizontal texture separator.

Native DrawText uses GUI RGB directly, while DrawTexture's default shader
multiplies GUI RGB by2. Accordingly actual caption glyphs use the wall
shader layer with raw GUI RGB, and the white separator texture uses that
layer with float32 GUI RGB*2. Both must preserve HDR before sampling. A
normal scene fill for the separator was an incorrect initial test
assumption; it was replaced with exact wall-layer tint and white-fill
assertions, rather than relaxing the color contract.

DrawPortal3620 onward expands the full physical cell before hard backing,
inner body and pause text. Draw3659 treats an unwon hard2 portal as locked
while World.unlocking. The pause branch requires Paused, not InBreakMenu,
Unlocked, and both expanded dimensions strictly>10, then draws black shadow
before white foreground with normalized referenceName. It does not add
a !unlocking gate. DrawPortalMarker3679 suppresses the hard2 marker during
unlocking. Draw6080–6107 separately draws celebration-only particles late,
with a stacked level clamp, InHub and !DisableParticles gates; this late
pass has no QuickAnim exclusion.

## Bounded actual integration tests

All fixtures parse unchanged bundled hub.txt and apply actual third-only
progression to retain Intro's real1-over-9 wall. Real GameRenderer prototype
methods run against recorded Graphics submissions, not a Canvas or GPU.
Primitive recorders and selected downstream method recorders expose the
integration boundaries. The completed suite has17 expanded cases:

- Two direct drawHubCaption cases at DPR1/2 check actual native captured
  glyph frame, source, physical-quad/resolution placement and exact raw
  GUI tint. An empty synthetic TextureSource only permits frame creation;
  it provides no atlas-pixel or raster proof. Size18 with null descriptors
  and a missing atlas return false with zero submissions. No font metrics
  or substitute size is invented.
- Two real drawWall wrapper cases check physical counting pop around the
  unchanged center, source body rectangle, body→numerator→denominator→bar,
  and exact separator float32 GUI RGB*2 shader tint.
- One wrapper case distinguishes supported exact size16 from Intro's
  unsupported size18 request. Unsupported labels remain null while the
  independent separator is still submitted.
- One QuickAnim case executes the real body method and its early return,
  then requires both live caption requests and the separator afterward.
- One real drawLevel case checks the per-wall source brightness multiplier,
  unclamped HDR channels, and a fresh ordinary-wall shader span after the
  inserted captions/bar. The real parent block's test color is temporarily
  set to grayscale v10 to discriminate clipping; this is a source stress
  input, not a claimed native scene color.
- Two drawFloor cases at DPR1/2 draw actual hard portal backing/inner body
  before shadow/foreground, using live celebration size. Each repeats with
  a different current camera rectangle to detect cached or CSS-size labels.
- Four drawFloor cases exercise playing, break menu, locked portal and
  strict width10 rejection. Their positive companion cases are required;
  these negative gates passed vacuously before caption integration.
- One hard2 case verifies locked body, absent marker, and still-eligible
  paused caption during unlocking, then positive marker after unlocking.
- Two late-pass cases use actual spawnHubCelebrationEdgeParticles with a
  deterministic unit sample. All16 particles appear exactly once, after
  wall submissions, with exact snapped geometry and parent clamp, including
  QuickAnim with horizontal flip. The active parent container is restored.
  One final case verifies DisableParticles suppresses that pass. The fixed
  unit sample does not assert Unity PRNG sequence equality.

The actual drawWallBody primitive is recorded in wrapper/span cases; the
QuickAnim case separately executes it. Caption invocation is recorded for
wrapper/portal ordering, while direct caption cases execute the real glyph
method. No depth, minimum-size, cull or phase gate is weakened.

## Actual experiment results

Before main's wrapper integration, the first12-case run produced8 failures
and4 passing negative gates. After adding direct glyph cases, an actual
14-case run at16:49:03 produced10 failures and4 passes. The added direct
cases observed drawHubCaption undefined. Other observed failures were no
wrapper body/captions, QuickAnim texture-only output, no wrapper submission
from drawLevel, portal textures without labels, and hard2 unlocking body
remaining white. These are actual red runs, not inferred historical tests.

Main then integrated production wrappers. The separator scene-layer
assertion was corrected from source shader evidence, and three late-particle
cases were added. Those particle cases were not part of the earlier red
run. Final command at16:52:06:

    npx vitest run tests/hubCaptionRendererIntegration.test.ts --reporter=dot

All17 cases pass. npx tsc --noEmit passes. HEAD was
dbf4191d58dba42c38433764b5fa642c8930da72 with main's uncommitted integration.
No shared production source was reverted to manufacture the red result.
Hashes collected following the passing run identify the working-tree
sources, not clean HEAD:

- Initial red-run GameRenderer.ts:
  94cee876bb32ff9119dd457d94678c110172e2cf18ff64d5679bae4c24ceb6d0
- Post-integration GameRenderer.ts:
  4d26caf90785ae7a8378e1d9099be35500584133ff283bc73a9b0cddfbda0b08
- hubShortcutRendering.ts:
  1a81b69241a0c712d37247c1a4c9fb4f4ddab7ae62388e22a81bf7edc2be9dd4
- hubCelebrationParticles.ts:
  8f4034935e46bb4550fcbfd7b73527f0a1fdd5baef23d1d258aad0d2cde1c14c
- Completed hubCaptionRendererIntegration.test.ts:
  63b5c725af8045226368ec65debe07de641786904c804eaaaa1c568d4eb3a76b
- Native Draw.cs:
  e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd

The17 passing cases support bounded source-based renderer callsites. They
do not approve actual native/Web glyph pixels, missing exact font sizes,
whole-scene raster output, sound, runtime timing or controller transitions.
Unsupported exact-size glyph requests remain an explicit coverage gap.

Main follow-up: late celebration particles must also precede the parent border (Draw6113). The real parent border call now follows the clipped late pass. The existing Normal late-pass case temporarily marks the view block locked to identify exact red border strips and asserts both command order and layer order after the final particle. QuickAnim retains its original border gate. Main also restored the original empty wall layer allocation and skips allocating a celebration mask if no celebration particles exist; unchanged draw-policy layer-count assertions remain intact. Legacy wall fixtures now inherit the real renderer prototype after drawWallBody extraction, preserving every existing exact quad assertion. Final source hashes are recorded with actual natural lifecycle captures; the earlier hashes above remain historical.
