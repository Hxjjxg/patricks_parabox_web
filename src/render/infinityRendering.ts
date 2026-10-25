import type { Block } from "../core/model";
import { originalDrawRect, type WallRect } from "./wallRendering";
const f = Math.fround;

/** DrawInfEffect: one90percent glyph or the native float vertical stack. */
export function infinityGlyphQuads(block: Block, rect: WallRect, screenHeight: number, resolution = 1):
  Array<{ rect: WallRect; texture: "infParticle" | "infParticleOutline"; alpha: number }> {
  if (!block.isSomeInfEnterBlock && !block.isSomeInfExitBlock) return [];
  const count = block.isSomeInfEnterBlock ? block.someInfEnterNum + 1 : (block.subLevel?.infExitBlocks.indexOf(block) ?? -1) + 1;
  if (count <= 0) return [];
  const fraction = f(f(f(rect.width + rect.height) / 2) / f(screenHeight));
  const alpha = Math.max(0, Math.min(1, f(f(-f(Math.log10(f(fraction + f(0.5))))) + f(0.22)) * 2));
  const texture: "infParticle" | "infParticleOutline" = block.isSomeInfEnterBlock ? "infParticleOutline" : "infParticle";
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  if (count === 1) {
    const width = rect.width * f(0.9), height = rect.height * f(0.9);
    return [{ texture, alpha, rect: originalDrawRect({ x: cx - width / 2, y: cy - height / 2, width, height }, resolution) }];
  }
  const unitWidth = f(f(rect.width) / f(count + 1)), unitHeight = f(f(rect.height) / f(count + 1));
  const gap = f(f(f(rect.height) - f(unitHeight * f(count))) / f(count + 1));
  const width = f(unitWidth * f(1.8)), height = f(unitHeight * f(1.8));
  const start = originalDrawRect({ x: cx - f(width / 2),
    y: cy - f(height / 2) - f(f(f(unitHeight / 2) + f(gap / 2)) * f(count - 1)), width, height }, resolution);
  const result = [];
  let y = start.y;
  for (let i = 0; i < count; i++) {
    result.push({ texture, alpha, rect: { ...start, y } });
    // Native updates the already snapped Unity Rect's float y, without resnapping.
    y = f(y + f(unitHeight + gap));
  }
  return result;
}
