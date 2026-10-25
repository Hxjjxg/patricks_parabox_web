# Hub shortcut fractions and paused portal references

Date: 2026-10-25. This investigation owns only the pure helper, its tests,
and this findings record. It does not change core state or GameRenderer.

## Observations

The current renderer has retained Hub unlock-wall records and native portal
geometry helpers, but shortcut fraction captions and paused portal reference
captions are not represented by those helpers. The original DrawWall and
DrawPortal routines contain separate source rules for these captions. The
available native font atlas supports sizes 12, 16 and 20 only. At the existing
800x600 ordinary Intro cell size, the source requests fraction size18. The
unpaused cell would imply reference size24, but labels draw only when paused:
the actual fully paused camera shrinks its cell and requests fraction size10
and reference size13. Intermediate pause geometry can request further exact
sizes. Callers must pass actual physical paused geometry;18/24 from an ordinary
cell cannot be reused as a settled pause measurement. Missing exact sizes
remain explicitly unsupported.

## Hypotheses and discriminators

1. Missing progress data: ordinary shortcut counts can be recovered from
   the existing outer-level portal floors, canonical puzzle metadata and won
   flags. Discriminator: compare LoadLevel's count loop with parsed Intro
   fixtures and hard-puzzle contributions.
2. Missing label geometry: source draws two centered numbers and a separate
   horizontal bar, rather than a literal slash caption. Discriminator: inspect
   DrawWall's SetDrawRect calls and float/double arithmetic directly.
3. Missing native font coverage: correct source geometry alone cannot draw
   all real viewport labels from the captured atlas. Discriminator: evaluate
   the source font-size expressions against the actual Intro cell and query
   nativeCaptionQuads without nearest-size substitution.
4. Retained-wall visibility: hubUnlockWalls contains removed walls for line
   routing, so treating every record as a visible shortcut can resurrect an
   open wall caption. Discriminator: verify the current grid still owns the
   exact original wall object before projecting its fraction.

## Experiments and conclusions

Read-only source inspection confirms all four discriminators. LoadLevel's
ordinary count loop reads canonical hard metadata and Floor.Won; the parsed
third-only native save produces exactly 1/9. DrawWall makes two DrawText calls
and one FullWhiteTex bar call. nativeCaptionQuads returns null at the actual
Intro font sizes. After all nine core Intro wins, existing progression removes
the wall from its grid but preserves its reference in hubUnlockWalls; the new
visibility helper suppresses that retained object. The all-nine test is a
parsed-data/lifecycle control, not a newly captured native image.

The retained native image
evidence/original/hub-line-third-only-loaded-native-v2-20261025/frame-0021.png
was viewed directly. It visibly has 1 over a horizontal bar over 9 on the
still-present wall above the green exit block. Its SHA256 is
95192d469a03da82758047017648e67b235e91c0da9061dd41a0445aba35743c.
The adjacent hub-start-state.json has only third_puzzle won, nine hard=0 Intro
portals and the lock_door wall at (5,2). No browser/native input, new capture,
injection, restart, staging or commit is performed by this module.

Source root is the retained AssetRipper Assembly-CSharp export. SHA256:

- Draw.cs: e26bd1a20c0db16bf15f3961e368aa2f947880399b7361cc6ad9bbe862b012bd
- LoadLevel.cs: 7de74bb1364a9b7178d912b8eb0439178cf89234c305fda87cedfaa182f10f6d
- Block.cs: b93af533734b8d4fe5457263f11ba80f8857361fc9c80cc3cf541c7e6fccb0d9

## Pure helper APIs

src/render/hubShortcutRendering.ts exports:

- hubShortcutCounts(block,progress?) returns native numRequired, numSolved
  and numSolvedUncapped. Ordinary walls count every won portal, including
  hard ones, toward a denominator containing only canonical hard=0 portals.
  Swap/Wall each subtract one denominator. Only the upper cap is applied.
  Special *clear and *clear_or_unlock_all return null because source does
  not initialize their count labels. UnlockPuzzles bypasses ordinary counts.
  *all needs explicit progress.totalWon (the complete save's LevelWon.Count);
  its denominator defaults to puzzleMetadata.size or accepts totalPuzzles.
  Null also marks unavailable *all totals rather than fabricating a count.
- isHubShortcutWallPresent(block) checks grid identity and wall kind. A
  retained route record can still provide counts after removal but cannot
  supply a visible fraction. A replacement at identical coordinates does
  not make the old object drawable.
- hubShortcutWallGeometry(geometry,countingScaleT?) projects the same
  QuadIn/Lerp pop used by DrawWall's body and fraction. Pass the unpopped
  body geometry; the result must not be popped again by the renderer.
- hubShortcutFraction(block,geometry,screenHeight,options?) returns popped
  geometry, numerator/denominator caption descriptors and the bar. Options
  accept explicit native counts, static progress, animation draw state and
  hueOffset. No clock advances or gameplay writes occur.
- hubShortcutFractionColor(parentColor,parentWidth,parentHeight,
  screenHeight,state?,hueOffset?) preserves raw pre-byte GUI RGBA.
- hubPortalCelebrationGeometry(geometry,celebrationSizeT?) returns native
  float32 expansion of the full portal cell.
- hubPausedPortalReference(floor,geometry,{paused,inBreakMenu?,
  celebrationSizeT?}) returns the expanded geometry, black shadow and white
  foreground captions. Canonical reference names include area prefixes:
  first_puzzle is a1 and third_puzzle is a3, not bare numerals.

Caption descriptors retain exact text, fontSize, MiddleCenter alignment,
draw rectangle, raw guiColor, and native glyph quads or null. Geometry uses
native physical pixels; callers at non-unit DPR must convert before source
float/truncation stages. Inherited clamps and rendering queues remain the
caller's responsibility. No independent arbitrary-DPR claim is made.

## Literal drawing rules

DrawWall (Draw.cs2993-3085) multiplies its double width/height by the float32
counting pop before calculating the label, parent fraction-of-screen and bar.
fontSize is trunc(height*.42f). The numerator is numSolved-CountingDelta only
while Counting. The number rects are twice the cell dimensions, centered
with vertical offsets -height*.26f and +height*.26f. The horizontal bar is
width*.6f by height*.05f. SetDrawRect (1308-1310) independently truncates
signed endpoints before writing the float Rect. A 40x40 cell centered at
(100,80) therefore yields number rects (60,29,80,80)/(60,50,80,80) and bar
(87,78,25,3), rather than a cosmetically rounded 24x2 bar. No pause, won,
screenshot or draw-style gate is added to the source numRequired!=0 gate.

LineColor (4159-4173) first computes the inactive color from the outer
level's exit block, full popped parent size and screen height. HSVToRGBGUI
clamps HSV output channels and divides RGB by two. DrawWall then sets alpha
to one, scales RGB by 1.25, applies Unlocking's clamped Lerp(1.5,6,t), and
halves RGB again only for the bar. The helper preserves these float32 stages
and unbounded final raw channels. Multiplying packed hubConnectionLineColor
bytes would quantize too early and is deliberately not used.

Raw caption color and texture color must be handled by their corresponding
native transfer paths. DrawText (1477-1493) writes GUIStyle.normal.textColor
and calls GUI.Label; the bar calls DrawTexture. The helper does not claim
that text and texture use an identical effective byte transfer, and does not
derive a fitted packed tint from the existing image. Source color arithmetic
tests alone are not a captured glyph/shader color acceptance.

DrawPortal (3618-3673) expands the full cell for celebration first. Paused
references require Paused, !InBreakMenu, Unlocked, width>10 and height>10.
Won portals remain eligible; hard portal thumbnail shrinkage does not shrink
the caption. The initial rect is twice the full expanded cell. fontSize is
trunc(float(height*.55f)). The black shadow adds width*.06f/height*.06f to
the already-truncated float Rect, then the foreground subtracts those exact
float offsets again. Recomputing the foreground from untruncated geometry
or rounding the shadow shift to whole pixels would alter the source path.

## Animation state still required

The current Block does not retain the native count/unlock lifecycle. Static
counts can be derived, but source-equivalent moving labels require owned
numRequired/numSolved/numSolvedUncapped and these presentation fields:
Counting, CountingT (initial -2.5f), CountingTotalDelta, CountingDelta,
CountingScaleT, Unlocking, UnlockingT, UnlockingLength (default 1.75f),
and UnlockingSuppressSound. World.counting, levelsNewlyWon, RecentArea,
wallUnlockAnimPlayed and the original load/history flags decide initialization
and removal order. The optional draw-state projection is not that lifecycle.

LoadLevel.cs1289-1299 sets CountingTotalDelta to levelsNewlyWon minus the
uncapped excess, only for surviving ordinary walls in RecentArea. Block.cs
513-549 increments CountingT by dt/.3f; on a crossed integer at T>=1 it sets
CountingScaleT=1 and decrements CountingDelta once, then stops Counting when
T>CountingTotalDelta. The pop decays by dt/.2f. UpdateUnlocking (489-510)
waits while World.counting, then advances its own timer and removes the wall
at UnlockingLength. The wall body must use the same pop as its labels.

Floor also needs native celebrationSizeT before animated portal references
can match. This module accepts that explicit field but does not synthesize
it from existing generic Floor.animationT.

## Verification and limits

The owned focused suite has 28 passing tests and TypeScript typecheck passes.
Tests cover the retained native third-only save, parsed all-nine removal,
hard contributions/canonical metadata, special-wall branches, missing global
totals, source upper cap, exact integer and negative geometry, count/pop and
unlock projections, raw HDR color order, supported glyphs, unsupported real
Intro sizes, pause/menu/size gates, prefixed references and celebration.
Initial failures exposed only test fixture setup and assumptions: createFloor
does not populate level.floorList until a list rebuild, and references are
a1/a3. The fixture now explicitly populates its list and expects canonical
names. No production fallback was added to mask those failures.

Native atlas sizes 18 and 24 remain absent. Real 800x600 Intro captions retain
their source font descriptors with glyphs=null; no nearest-size scaling,
Canvas/system-font substitute, synthetic glyph or fitted placement is used.
Parent owns any native glyph capture, renderer/core integration, immutable
browser/native comparisons and eventual commits. This helper module does
not establish full caption pixel parity or full Hub visual acceptance.

Integration status after native capture audit1337643: these pure descriptors
and28tests are retained as a completed source investigation module only.
GameRenderer does not dispatch them yet, and Counting/Unlocking/celebration
state lifecycle is not implemented by this module. The extended native-font
diagnostic deployment was automatically rejected; all134 later hidden-launch
PNGs were black and rejected. Native10/13/18 and other required sizes have
no usable new capture. See native-font-hub-18-24-findings.md for the exact
restoration audit. No substitute font, approximate scaling or full Hub pass
is authorized by these source descriptors.

Combined helper regression: 108 tests pass across hubShortcutRendering,
hubPortalConnections, hubPortalRendering, hubPortalMarkers and
nativeFontRendering. Native18/24 glyph capture requirements were handed to
the original-evidence owner: fractions require decimal digits (no slash),
and paused references use the canonical character set
0123456789Labcdefghijkmnopqrstuvw. The current metadata contains364 references;
shipped thumbnail file count is not used as the *all denominator.
