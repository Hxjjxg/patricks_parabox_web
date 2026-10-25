# Native recursive block content

Native DrawBlock sets the solid backing alpha to zero for an InfZone but still draws the single black center gradient. A nested block must not draw a second backing and gradient before drawLevel. The previous implementation concealed the starfield under gray, and darkened every nested level twice.

The original ticket depth limit is 15. References to a level already on the traversal path are normal recursive game content and are not an excuse to substitute synthetic concentric frames. The Web path now follows those references until the native depth cap rather than stopping at depth 7, size 11, or a repeated Level object.

Native FillLevelWithWalls / MaybeFillDonut compact both the third puzzle player and gold box contents to a 1 by 1 wall level. Filled boxes still render that contained wall through ComputeWallColor and the original texture, instead of rendering a flat solid swatch. Existing compression behavior is preserved; the change is in rendering.

The actual draw-path regressions failed before the fixes and now cover transparent root and nested infinity backing, a self-referential player rendered to 14 child face tickets without synthetic frames, and both compressed player and gold wall contents. Full suite at the candidate passed 387 tests and typecheck. The fresh natural Infinity/flip Web frames are in evidence/web-recursive-v3; remaining epsilon glyph, faces, clone tickets and effect ordering are separate parity work, so this is not a full transition-parity claim.
