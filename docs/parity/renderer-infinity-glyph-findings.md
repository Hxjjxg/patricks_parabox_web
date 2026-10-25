# Native infinity glyphs

DrawInfEffect uses InfParticleOutlineTex for infinite-enter blocks and InfParticleTex for infinite-exit blocks. The count is SomeInfEnterNum+1 or the block's position in its SubLevel.infExitBlocks+1. Both512x512 native DXT5 textures are neutral Direct3D11 Gamma/Linear GPU readbacks from gpu-infinity-effects-20261025, with immutable SHA-256 and exact production/source-byte tests.

One symbol occupies Math.fround(0.9) of the block rectangle. Multiple symbols use the original float width/height/gap arithmetic and vertical stack. SetDrawRect truncates the first rectangle's endpoints; subsequent stacked symbols advance the already-snapped float Rect y. For example the native computed stacked width from100/3*1.8 is59.999996, so its draw width is59, not an artificially rounded60.

Direct white Color alpha uses -log10(fraction+0.5)+0.22 with the native GUI x2 transfer. Three actual draw-method regressions failed before implementation and now pass, plus two GPU provenance tests. The glyph pass currently follows the recursive drawLevel content; native global effect ticket ordering, cloneFade and complete clipping remain to be ported and visually reviewed.
