import { describe, expect, it } from "vitest";
import { largeWallQuads, WALL_BIG_QUADS } from "../src/render/wallBigRendering";

describe("native large-wall quadrant rendering", () => {
  it("retains all48 original autotile quadrant selections", () => {
    expect(WALL_BIG_QUADS).toHaveLength(48);
    expect(WALL_BIG_QUADS[28]).toEqual([4, 5, 4, 5]);
    expect(WALL_BIG_QUADS[36]).toEqual([3, 4, 3, 4]);
    expect(WALL_BIG_QUADS[46]).toEqual([4, 4, 4, 4]);
    expect(WALL_BIG_QUADS[47]).toEqual([0, 2, 6, 8]);
  });
  it("uses strict256px threshold for either dimension including HiDPI", () => {
    expect(largeWallQuads(47, { x: 0, y: 0, width: 255.99, height: 255.99 })).toBeNull();
    expect(largeWallQuads(47, { x: 0, y: 0, width: 256, height: 10 })).toHaveLength(4);
    expect(largeWallQuads(47, { x: 0, y: 0, width: 10, height: 256 })).toHaveLength(4);
    expect(largeWallQuads(47, { x: 0, y: 0, width: 128, height: 10 }, 2)).toHaveLength(4);
  });
  it("shares snapped quadrant endpoints through fractional zoom and negative positions", () => {
    const quads = largeWallQuads(47, { x: -72.37, y: 54.23, width: 300.31, height: 401.45 })!;
    const [tl, tr, bl, br] = quads.map((quad) => quad.rect);
    expect(tl!.x + tl!.width).toBe(tr!.x);
    expect(tl!.y + tl!.height).toBe(bl!.y);
    expect(tr!.x + tr!.width).toBe(br!.x + br!.width);
    expect(bl!.y + bl!.height).toBe(br!.y + br!.height);
    expect(quads.map((quad) => quad.textureIndex)).toEqual([0, 2, 6, 8]);
  });
});
