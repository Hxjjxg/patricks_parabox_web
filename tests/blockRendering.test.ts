import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import type { Block, Level } from "../src/core/model";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { GameRenderer } from "../src/render/GameRenderer";

interface Rect { x: number; y: number; width: number; height: number }
interface DrawingMethods {
  drawLevel(graphics: Graphics, level: Level, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
  drawBlock(graphics: Graphics, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
}

describe("original block backing gradient", () => {
  it.each(["level", "nested block"])("preserves the native GUI alpha transfer in the %s draw path", (path) => {
    const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
    const block = world.getDefaultFocusBlock();
    const level = block.subLevel!;
    // Isolate the actual backing commands, independently of walls and particles.
    level.blockList.length = 0;
    level.floorList.length = 0;
    level.particles.length = 0;
    const fills: Array<{ texture?: unknown; alpha?: number }> = [];
    const gradient = { name: "original-center-gradient" };
    const recorder = {
      rect: () => recorder,
      stroke: () => recorder,
      fill: (fill: unknown) => {
        if (fill && typeof fill === "object") fills.push(fill);
        return recorder;
      },
    };
    const graphics = recorder as unknown as Graphics;
    const receiver = {
      app: { screen: { height: 600 } },
      textures: { centerGradient: gradient },
      onScreen: () => true,
      nextWallLayer: () => graphics,
      nextSceneLayer: () => graphics,
      drawLevel: () => graphics,
    };
    const methods = GameRenderer.prototype as unknown as DrawingMethods;
    const rect = { x: 154, y: 54, width: 492, height: 492 };
    if (path === "level") {
      methods.drawLevel.call(receiver, graphics, level, block, rect, 0, new Set(), false);
    } else {
      methods.drawBlock.call(receiver, graphics, block, rect, 0, new Set(), false);
    }
    const command = fills.find((fill) => fill.texture === gradient);
    // Draw.blockGradientColor.a is 0.08 and is passed directly to the native
    // GUI shader, whose x2 multiplier makes the framebuffer opacity 0.16.
    // HSVToRGBGUI's cancelling /2 conversion is not used for this color.
    expect(command?.alpha).toBe(0.16);
    // The independently observed third-puzzle peripheral floor is ~83, not89.
    expect(Math.round(95 * (1 - command!.alpha! * 0.8))).toBe(83);
  });
});
