import type { Block, Level } from "../core/model";
import { borderThickness } from "./borderRendering";
import { originalDrawRect, type WallRect } from "./wallRendering";

/** Original WallShadowCull tests logical right/down/diagonal neighbors. */
export function wallShadowCull(level: Level, block: Block): boolean {
  const wall = (x: number, y: number) => {
    const neighbor = level.getBlock(x, y);
    return Boolean(neighbor && !neighbor.subLevel);
  };
  const right = block.x === level.width - 1 || wall(block.x + 1, block.y);
  const down = block.y === 0 || wall(block.x, block.y - 1);
  return right && down && (block.x === level.width - 1 || block.y === 0 || wall(block.x + 1, block.y - 1));
}

export function shadowRect(
  block: Block, rect: WallRect, staticRect: WallRect, flipH: boolean,
  screenWidth: number, screenHeight: number, resolution = 1,
): WallRect | null {
  if (!block.outerLevel || block.outerLevel.width === 1 && block.outerLevel.height === 1) return null;
  let offset = 2 * borderThickness(block, rect, staticRect, screenWidth, screenHeight, resolution);
  if (rect.width * resolution < 13 && rect.height * resolution < 13) offset = 1 / resolution;
  let offsetX = flipH ? -offset : offset;
  if (block.fadeFlipH) offsetX *= -1 + 2 * block.animT / block.animLength;
  return { x: rect.x + offsetX, y: rect.y + offset, width: rect.width, height: rect.height };
}

/** Clip the already snapped draw quad, preserving its corresponding UV subset. */
export function clipShadow(rect: WallRect, clip: WallRect, resolution = 1): { rect: WallRect; uv: WallRect } | null {
  const snapped = originalDrawRect(rect, resolution);
  if (snapped.width <= 0 || snapped.height <= 0) return null;
  const x = Math.max(snapped.x, clip.x);
  const y = Math.max(snapped.y, clip.y);
  const right = Math.min(snapped.x + snapped.width, clip.x + clip.width);
  const bottom = Math.min(snapped.y + snapped.height, clip.y + clip.height);
  if (right <= x || bottom <= y) return null;
  return { rect: { x, y, width: right - x, height: bottom - y },
    uv: { x: (x - snapped.x) / snapped.width, y: (y - snapped.y) / snapped.height,
      width: (right - x) / snapped.width, height: (bottom - y) / snapped.height } };
}
