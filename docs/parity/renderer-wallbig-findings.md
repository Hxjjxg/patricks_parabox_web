# Native WallBig rendering

DrawWall selects four large quadrants when either physical dimension reaches 256 pixels, except in QuickAnim. Each of the 48 normal autotile indices maps to TL/TR/BL/BR texture indices through the original Resources/wall_big_data.txt table. The data file is preserved verbatim; both 13-texture families are original GPU readbacks covered by auxTextureConformance.test.ts.

The Web path now uses those quadrant selections and clamps every texture. Each quadrant uses native integer draw endpoints and shares its edge with its neighbor. Three helper regressions cover table identity, the exact threshold and DPR handling, and fractional/negative rectangles; two actual drawWall regressions cover the normal and flipped paths. The previous renderer always scaled a 200px normal wall texture, and both actual-path tests failed before this change.

Natural camera and inspection captures are still required to review large-wall appearance during transitions. This module does not claim general style or transition parity.
