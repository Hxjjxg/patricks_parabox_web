# Scene palettes, 2026-10-25

## Observations and hypotheses

Independent synchronized captures of `infenter_zone_v2` show native green epsilon blocks and a red player while Web rendered blue and magenta. `1by1_playerr_flip2` is purple in native captures. Body movement and camera interpolation were independently supported, so color/content defects must not be hidden by movement timing changes.

1. **Missing official palette application (confirmed):** native `LoadLevel.cs:184` invokes `ApplyPalette(Hub.GetScenePalette(currentLevelName))`. `Hub.cs:265` returns the puzzle metadata palette, default0. `LoadLevel.cs:988-1046` replaces colors by original HSV category after references and generated worlds exist. Web parsed `puzzle_data.txt` palette metadata for progression but never applied it.
2. **Hue-shift animation (rejected for these scenes):** native only enables `Draw.HueShift` for `hue_shift`; the two scenes instead match their static palette resources exactly.
3. **GPU wall tint or recursive camera interpolation (rejected as the hue cause):** neither can correctly turn all source blue/player categories into the resource-defined green/red and purple pairs. Changing hue by the original mapping explains the scene-wide mismatch without changing deterministic moves.

## Native definitions

`Resources/palettes.txt` is copied verbatim to `src/assets/data/palettes.txt`. Eleven palettes each define root/orange/blue/player/teal/green HSV categories. Palette7 applies to infinity; palette8 applies to the flip scene. Values are stored at native float precision. Walls and generated infinity-zone root backings retain their source colors. Nonstandard source hues retain their original values.

The hub keeps its source colors. The `palettes` showcase is also untouched. Unknown debug scene names use native palette0. `custom_level` keeps raw HSV unless an explicit nonnegative `palette` header selects a resource palette; this follows `LoadLevel.cs:108,172-181,412`. Native randomized palette selection remains a separate unsupported randomization path; this module does not invent a random seed or replacement policy.

## Fix and verification

`src/core/palettes.ts` reads the same palette and puzzle metadata resources without importing progression/customLevels, avoiding a parser dependency cycle. A single `levelParser` finalization call applies colors after all references, compressed walls and generated infinity worlds exist. Parent-owned `drawIsPlayer` initialization lines remain intact.

Six parser regressions cover both failing official scenes, infinity-root preservation, fallback0, custom header/raw behavior, hub and showcase. Before implementation4 failed/2 passed; after implementation6 pass. Tests compare actual parsed world colors rather than replacing the renderer with expected mock colors. Static first/third palette0 remains visually equivalent; infinity transparency, glyph overlays and clone-fade are separate renderer paths.
