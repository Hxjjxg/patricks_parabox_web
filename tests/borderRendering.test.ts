import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import { Block, Level } from "../src/core/model";
import { AnimType } from "../src/core/animation";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { GameRenderer } from "../src/render/GameRenderer";
import { borderStrips, borderThickness, guiHsvColor } from "../src/render/borderRendering";

interface Rect { x: number; y: number; width: number; height: number }
interface DrawingMethods {
  drawLevel(graphics: Graphics, level: Level, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
  drawBlock(graphics: Graphics, block: Block, rect: Rect, depth: number, ancestors: Set<Level>, flipH: boolean): Graphics;
}

function recordBacking(levelName: string, target: "root" | "player") {
  const world = parseLevel(getLevelSource(levelName), levelName);
  const root = world.getDefaultFocusBlock();
  const block = target === "root" ? root : world.findPlayerBlock();
  const level = root.subLevel!;
  // Keep the grid for native edge solidity checks but isolate backing commands.
  level.blockList.length = 0;
  level.floorList.length = 0;
  level.particles.length = 0;
  const fills: Array<{ rect: number[]; fill: unknown }> = [];
  let lastRect: number[] = [];
  const recorder = {
    rect: (...rect: number[]) => { lastRect = rect; return recorder; },
    stroke: () => recorder,
    fill: (fill: unknown) => { fills.push({ rect: lastRect, fill }); return recorder; },
  };
  const graphics = recorder as unknown as Graphics;
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
    textures: { centerGradient: {} },
    world,
    onScreen: () => true,
    nextWallLayer: () => graphics,
    nextSceneLayer: () => graphics,
    drawWall: () => {},
  });
  const methods = GameRenderer.prototype as unknown as DrawingMethods;
  const rect = target === "root"
    ? { x: 154, y: 54, width: 492, height: 492 }
    : { x: 263, y: 272, width: 54, height: 54 };
  if (target === "root") {
    methods.drawLevel.call(receiver, graphics, level, block, rect, 0, new Set(), false);
  } else {
    methods.drawBlock.call(receiver, graphics, block, rect, 0, new Set(), false);
  }
  return fills;
}

describe("original inside block borders", () => {
  it.each([
    [{ h: 0.6, s: 0, v: 0.8 }, 0x242424],
    [{ h: 0.9, s: 1, v: 0.7 }, 0x200010],
    [{ h: 0.1, s: 0.8, v: 1 }, 0x2e1c02],
  ])("preserves native GUI half-color byte transfer for %j", (color, expected) => {
    expect(guiHsvColor({ h: color.h, s: color.s * 1.2, v: color.v * 0.18 })).toBe(expected);
  });

  it("draws the third puzzle's native three-pixel dark root border inside its walls", () => {
    const fills = recordBacking("third_puzzle", "root");
    // ComputeBorderThickness: round(clamp(492/30,1,600*0.00508))=3.
    // Native pixels show half-color byte quantization before shader doubling.
    for (const rect of [[154, 54, 3, 492], [643, 54, 3, 492], [154, 54, 492, 3], [154, 543, 492, 3]]) {
      expect(fills).toContainEqual({ rect, fill: 0x242424 });
    }
  });

  it("uses native HSV border color and inward two-pixel strips for a filled player box", () => {
    const fills = recordBacking("third_puzzle", "player");
    // Native player HSV(0.9,1,0.7); border saturation*1.2 stays1.2 through HSV conversion,
    // then GUI half-color byte transfer produces RGB32,0,16.
    for (const rect of [[263, 272, 2, 54], [315, 272, 2, 54], [263, 272, 54, 2], [263, 324, 54, 2]]) {
      expect(fills).toContainEqual({ rect, fill: 0x200010 });
    }
  });

  it("draws only solid edge cells and mirrors both sides and horizontal segments", () => {
    const level = new Level(1, 3, 3);
    const wall = new Block(1);
    wall.init(0, 2, level, null);
    const nested = new Block(2);
    nested.init(1, 2, level, new Level(2, 1, 1));
    const rect = { x: 10, y: 20, width: 90, height: 90 };
    expect(borderStrips(level, rect, 2, false)).toEqual([
      { x: 10, y: 20, width: 2, height: 30 },
      { x: 10, y: 20, width: 30, height: 2 },
    ]);
    expect(borderStrips(level, rect, 2, true)).toEqual([
      { x: 98, y: 20, width: 2, height: 30 },
      { x: 70, y: 20, width: 30, height: 2 },
    ]);
    wall.moving = true;
    wall.anim = AnimType.EnterExit;
    expect(borderStrips(level, rect, 2, false)).toEqual([]);
  });

  it("keeps full solid sides continuous even with moving enter/exit walls", () => {
    const level = new Level(1, 1, 2);
    for (let y = 0; y < 2; y++) {
      const wall = new Block(y);
      wall.init(0, y, level, null);
      wall.moving = true;
      wall.anim = AnimType.EnterExit;
    }
    expect(borderStrips(level, { x: 0, y: 0, width: 30, height: 60 }, 2, false)).toEqual([
      { x: 0, y: 0, width: 2, height: 60 },
      { x: 28, y: 0, width: 2, height: 60 },
      { x: 0, y: 0, width: 30, height: 2 },
      { x: 0, y: 58, width: 30, height: 2 },
    ]);
  });

  it("uses static moving-cell thickness except enter/exit and jumps", () => {
    const block = new Block(1);
    block.moving = true;
    const rect = { x: 0, y: 0, width: 120, height: 120 };
    const cell = { x: 0, y: 0, width: 30, height: 30 };
    block.anim = AnimType.Bump;
    expect(borderThickness(block, rect, cell, 800, 600)).toBe(1);
    for (const anim of [AnimType.EnterExit, AnimType.JumpIn, AnimType.JumpOut]) {
      block.anim = anim;
      expect(borderThickness(block, rect, cell, 800, 600)).toBe(3);
    }
  });

  it("matches native ties-to-even and screen-space pixel limits", () => {
    const block = new Block(1);
    const rect = { x: 0, y: 0, width: 75, height: 75 };
    expect(borderThickness(block, rect, rect, 800, 600)).toBe(2);
    expect(borderThickness(block, rect, rect, 800, 600, 2)).toBe(2.5);
  });
});
