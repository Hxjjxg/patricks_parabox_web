import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import type { Block, Level } from "../src/core/model";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { GameRenderer } from "../src/render/GameRenderer";
import { nativeFocusRect } from "../src/render/focusGeometry";

interface Rect { x: number; y: number; width: number; height: number }
interface DrawingMethods {
  drawLevel(graphics: Graphics, level: Level, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
  drawBlock(graphics: Graphics, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
}

describe("original block backing gradient", () => {
  it.each(["player", "gold"])("renders native compressed %s contents through the wall-texture path", (target) => {
    const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
    const block = target === "player" ? world.findPlayerBlock() : world.getDefaultFocusBlock().subLevel!.getBlock(4, 6)!;
    // LoadLevel.FillLevelWithWalls and MaybeFillDonut both compact to1x1.
    expect(block.subLevel!.filledWithWalls).toBe(true);
    expect(block.subLevel!.width).toBe(1);
    const walls: Block[] = [];
    const graphics = { rect: () => graphics, fill: () => graphics, stroke: () => graphics } as unknown as Graphics;
    const receiver = Object.assign(Object.create(GameRenderer.prototype), {
      app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
      world, textures: { centerGradient: {} },
      onScreen: () => true, nextWallLayer: () => graphics, nextSceneLayer: () => graphics,
      drawWall: (_graphics: Graphics, _level: Level, wall: Block) => walls.push(wall),
      drawFace: () => {},
    });
    receiver.drawBlock(graphics, block, { x: 263, y: 272, width: 55, height: 55 }, 0, new Set(), false);
    expect(walls.map((wall) => wall.id)).toEqual(block.subLevel!.blockList.map((wall) => wall.id));
    expect(walls).toHaveLength(1);
  });

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
    const receiver = Object.assign(Object.create(GameRenderer.prototype), {
      app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
      textures: { centerGradient: gradient },
      onScreen: () => true,
      nextWallLayer: () => graphics,
      nextSceneLayer: () => graphics,
    });
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


it("snaps both solid backing and gradient to native draw endpoints without an exterior gray fringe", () => {
  const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
  const root = world.rootBlock!, level = root.subLevel!;
  level.blockList.length = 0; level.floorList.length = 0; level.particles.length = 0;
  const rects: number[][] = [];
  const graphics = { rect: (...rect: number[]) => { rects.push(rect); return graphics; }, fill: () => graphics, stroke: () => graphics };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } }, world, textures: { centerGradient: {} },
    onScreen: () => true, nextWallLayer: () => graphics, nextSceneLayer: () => graphics,
  });
  receiver.drawLevel(graphics, level, root, nativeFocusRect(800,600,1,1,0,0), 0, new Set(), false);
  expect(rects.slice(0,2)).toEqual([[154,54,491,491],[154,54,491,491]]);
});
