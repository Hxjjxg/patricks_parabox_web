# Alternate rendering roots: GRID, TUI_COLOR and QUICK

This module ports the native alternate drawing branches, rather than treating
them as cosmetic changes to the ordinary recursive camera. Native source
anchors are Draw.ComputeTUILevels, Draw.DrawBlocks1601, Draw.DrawTUI2636,
TUIDrawLevel2867/2874, and the QUICK branches of DrawBlocks/DrawLevel.

## Observed failures and source-backed changes

The old actual renderer submitted one enlarged world for grid_clone, one
ordinary recursive world for text_1, and an ordinary .82 player focus for
oldstyle_lock_two_doors. Failing-before renderer tests measured respectively
one scene pass instead of four, one scene pass instead of zero plus100
logical glyphs, and focus width491.9999957 instead of62.9999980 at800x600.
The original QUICK backing test also rejected the flat fill plus center
gradient. These are branch-selection errors, not color adjustments.

GRID and TUI_COLOR now use their native root only in Playing/Paused, outside
EndZoom and screenshotting-blocks. They draw onto black and skip the normal
camera, void and tutorial path. ComputeTUILevels preserves native exclusions
and stable order: nonfilled worlds, visited nontrivial infinity worlds, no
specialEffect11, and the native hub travel/unlock gates. Outside the hub the
worlds are stably ordered by descending width.

GRID maximizes square packing inside95percent of the viewport; each board
occupies80percent of its cell. Each canonical exit representation is drawn
unflipped at depth0 with its own rectangle as clip. At800x600 grid_clone
uses world order[1,0,2,4] and board rectangles[143.5,43.5,228,228],
[428.5,43.5,228,228], [143.5,328.5,228,228], [428.5,328.5,228,228].

TUI_COLOR packs logical worlds with the native exhaustive wrap/font search.
It reads logical cell coordinates immediately, independent of normal motion
offsets, and emits native wall/player/box/title/goal/portal symbols, clone
inverted backgrounds, native HSV colors and clock-driven substitutions.
The two text_1 worlds are[0,2] and produce100 labels.

QUICK uses the original .105 focus fraction, new camera transforms directly
unless instant zoom is selected, input flip for cameraX, and unsquished
usedXS/usedYS. Player draw squash changes dimensions after locating the
camera center. Backings use the original QuickAnimBlock texture with no
CenterGradient. Filled walls use QuickAnimBlock and other walls FullWhite;
the native wall tint multiplier is.8. Paused alternate roots reproduce the
native effective black overlay alpha.64. Core timing and camera-offset
updates are a separate coordinated module.

## Exact TUI geometry and glyph evidence

Independent native v2 captured a settled startup state,100 actual labels,
their GUI style/cursors and the same-generation Inconsolata-SemiBold atlas.
Native v3 additionally traced the unchanged original float level arguments
and double SetDrawRect arguments. Both retain100 unique exact atlas masks.
See native-tui-font-evidence.md and the immutable directories:

- evidence/original/native-tui-fixed-font-v2-20261025
- evidence/original/native-tui-fixed-font-geometry-v3-20261025

The font search selects56, not57:
trunc(floor(600/19)/float32(.55))=56. Cell width is float32
30.80000114440918. Global packing products retain double precision until
the TUIDrawLevel float parameters narrow level origins. Native level0
leftX107.39998626708984 and level2 leftX415.3999938964844 are reproduced
without offsets. The first native SetDrawRect arguments are
[168.9999885559082,440,30.80000114440918,56], which truncate to the cell
[168,440,31,56] and label[168,384,31,112].

Tests compare all100 pre-truncation arguments exactly against v3, and all100
text/color/label rectangles and final glyph positions against independent
v2. The atlas copies every alpha sample of95ASCII glyphs, preserving UV
orientation, advances and bounds. Native LowerCenter placement uses
penX=ceil(cursorX-.5) and the independently observed hinted ascent48; the
native CalcSize height65 and paddingTop3 locate the vertical cursor.

The extractor scripts/extract-native-tui-font.py repacks losslessly into
512x512 and stores provenance hashes in native-tui-font-metrics.json.
Atlas SHA256: a379fbad686f048be04b7743fddf8c2542aa73934a01014b2bf3a65ef6ad6cdc.
QuickAnimBlock was copied from the authorized AssetRipper export; SHA256:
2b692f270633a6a09e63d272887bb1ec3413697e12a39cf3df05e356c0ffb0d6.

Native glyph quads use framed Pixi Sprite textures. A separate actual
Canvas experiment found Graphics.fill(textureSpace:local) normalizes the
whole atlas instead of respecting its subtexture frame in the installed
Pixi version. A renderer regression asserts the Sprite path and pooling.

## Verification and open gates

On2026-10-25 the full current tree passes53test files/858tests and
npm run typecheck. No production build or dist artifact was produced by
this module. Actual immutable production PNG review remains necessary for
GRID, TUI_COLOR, QUICK and their animation phases; unit/source agreement
does not close visual parity.

The original raster atlas is proven only for physical font56. Other font
sizes use the bundled original Inconsolata Text path and remain unaccepted,
as do other viewport/DPR combinations. EndZoom/screenshot state and save
unlock context are optional renderer gates whose controller wiring still
requires the real corresponding state. Hub unlocks, win progression and
clock phases need broader native/live visual coverage. V1 native PNGs are
startup-fade diagnostics and are not color acceptance evidence.
