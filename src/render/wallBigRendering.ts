import rawQuads from "../assets/wall_big_data.txt?raw";
import { originalDrawRect, type WallRect } from "./wallRendering";

/** Exact48 TL/TR/BL/BR rows from the original Resources/wall_big_data.txt. */
export const WALL_BIG_QUADS: ReadonlyArray<readonly [number, number, number, number]> = rawQuads.trim().split(/\r?\n/).map((line) => {
  const row = line.trim().split(/\s+/).map(Number);
  if (row.length !== 4 || row.some((value) => !Number.isInteger(value) || value < 0 || value >= 13)) throw new Error("Invalid original large-wall quadrant data");
  return row as [number, number, number, number];
});
if (WALL_BIG_QUADS.length !== 48) throw new Error("Expected48 original wall autotiles");

/** Native selects large quadrants when either physical dimension reaches256. */
export function largeWallQuads(index: number, rect: WallRect, resolution = 1): Array<{ textureIndex: number; rect: WallRect }> | null {
  if (rect.width * resolution < 256 && rect.height * resolution < 256) return null;
  const indices = WALL_BIG_QUADS[index];
  if (!indices) throw new RangeError("Invalid wall autotile index");
  const width = rect.width / 2;
  const height = rect.height / 2;
  return indices.map((textureIndex, quadrant) => ({ textureIndex, rect: originalDrawRect({
    x: rect.x + quadrant % 2 * width, y: rect.y + Math.floor(quadrant / 2) * height, width, height,
  }, resolution) }));
}
