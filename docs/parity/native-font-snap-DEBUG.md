# Native GUI horizontal snap cross experiment

## Observations

- v7/v8 newline Move masks match the proposed staged horizontal snap rule.
- v9 single-line Undo is one pixel left of the rule in six samples. Text, width parity, and negative fractional origins changed together, so v9 alone cannot identify the cause.
- All 36 independently measured vertical baselines match the vertical rule. Raw v9 failures remain authoritative evidence.

## Hypotheses

### H1: Width parity and fractional-origin snapping interact (ROOT HYPOTHESIS)
- Supports: v9 combines even width 102 with negative fractional origins; neither combination appeared in v7/v8.
- Conflicts: not yet isolated.
- Test: hold newline Move and even width 102 fixed; vary signed quarter/half/three-quarter origins at all three sizes.

### H2: Text quad or ink overhang determines horizontal placement
- Supports: Move and Undo have different advance parity and overhangs.
- Conflicts: v9 origin and width differences confound the text change.
- Test: first isolate Move under the v9 rectangle conditions; then cross Undo only if necessary.

### H3: Stale atlas coordinates or shared GUI state changes placement
- Supports: the dynamic atlas can repack; GUI state is shared.
- Conflicts: same-generation atlas measurement gives unique exact masks and the observer restores original rect/style.
- Test: retain same-generation atlas and metrics, require unique zero-difference matches in all cross samples.

## Experiment

- Add only a read-only diagnostic cross mode to the existing GUI font pack. Draw.DrawText and GUI.Label remain the native path; no production math changes.
- Width 102, height 82, integer Y, newline Move, sizes 12/16/20. Eighteen samples cover signed .25/.5/.75 X fractions relative to integer column anchors. Absolute negative X is covered by the first column; other columns test translated fractions.
- The five-line overlay experiment reuses the established screen, atlas, metrics, and state-restoration path.
- v10 captured 18 labels at 800x600. Every label has one unique integer pen/baseline matching the same-generation atlas with zero mask difference; all 18 horizontal and vertical predictions pass.
- H1 rejected as a standalone explanation: width 102 and signed fractional origins still work for newline Move. H2 remains open: text, advance parity, overhang, and single-line/multiline layout are not yet distinguished. No production correction is asserted.
- The raw v10 `fractionY` field retains the existing row-derived diagnostic ordinal; actual `rect.y` is integer and authoritative. Analysis uses `rect`, not this legacy field.

## Final four-text cross

- V11 holds width102/height82, X fraction-.25, Y fraction+.25, and sizes12/16/20. Each size compares Move, newline-Move, Undo, and newline-Undo with identical rectangle geometry modulo integer translation.
- All12 glyph masks match exactly and uniquely. Move with or without a newline passes the horizontal rule; Undo with or without a newline is exactly one pixel left at all3 sizes. All12 vertical predictions pass. This rejects leading-newline layout as the cause.
- Native TextGenerator preferred widths equal advance sums: Move30/40/50, Undo29/39/49. Each generated result contains16 actual glyph vertices, with no trailing empty quad. All-vertex X extents are Move[-1,31]/[-1,41]/[-1,51] and Undo[-1,30]/[0,40]/[0,49]. The complete raw characters, lines, vertices and settings are retained.
- Text identity, advance parity, and generated-quad layout remain possible explanations. No universal horizontal rule or offset fit is claimed. Across V7–V11 all66 independent masks and vertical predictions pass; all12 horizontal failures (six V9, six V11) remain in the index.
