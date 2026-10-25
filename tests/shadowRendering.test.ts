import { describe, expect, it } from "vitest";
import { Block, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";
import { clipShadow, shadowRect, wallShadowCull } from "../src/render/shadowRendering";

describe("original block shadow pass", () => {
  it("uses twice the native border thickness for filled boxes and mirrors horizontal offsets", () => {
    const block = new Block(1);
    block.init(1, 1, new Level(1, 3, 3), new Level(2, 1, 1));
    const rect = { x: 263, y: 272, width: 55, height: 55 };
    expect(shadowRect(block, rect, rect, false, 800, 600)).toEqual({ x: 267, y: 276, width: 55, height: 55 });
    expect(shadowRect(block, rect, rect, true, 800, 600)).toEqual({ x: 259, y: 276, width: 55, height: 55 });
    block.fadeFlipH = true; block.animT = 0.25; block.animLength = 1;
    expect(shadowRect(block, rect, rect, false, 800, 600)!.x).toBe(261);
  });

  it("uses a one-pixel offset below13px and omits shadows in1x1 enclosing levels", () => {
    const block = new Block(1);
    block.init(1, 1, new Level(1, 3, 3), null);
    const rect = { x: 0, y: 0, width: 12, height: 12 };
    expect(shadowRect(block, rect, rect, false, 800, 600)).toEqual({ x: 1, y: 1, width: 12, height: 12 });
    block.outerLevel = new Level(2, 1, 1);
    expect(shadowRect(block, rect, rect, false, 800, 600)).toBeNull();
  });

  it("culls covered wall shadows only with the diagonal filled as well", () => {
    const level = new Level(1, 3, 3);
    const center = new Block(1); center.init(1, 1, level, null);
    for (const [x, y] of [[2, 1], [1, 0]] as const) new Block(x + y + 2).init(x, y, level, null);
    expect(wallShadowCull(level, center)).toBe(false);
    new Block(5).init(2, 0, level, null);
    expect(wallShadowCull(level, center)).toBe(true);
  });

  it("clips shadow bounds while retaining corresponding native texture UV coordinates", () => {
    expect(clipShadow({ x: 7, y: 8, width: 10, height: 10 }, { x: 0, y: 0, width: 15, height: 15 })).toEqual({
      rect: { x: 7, y: 8, width: 8, height: 7 }, uv: { x: 0, y: 0, width: 0.8, height: 0.7 },
    });
    expect(clipShadow({ x: 16, y: 8, width: 10, height: 10 }, { x: 0, y: 0, width: 15, height: 15 })).toBeNull();
  });

  it("draws a wall shadow before the containing level's direct wall pass", () => {
    const level = new Level(1, 3, 3);
    const root = new Block(0);
    root.init(0, 0, null, level);
    const wall = new Block(1);
    wall.init(1, 1, level, null);
    level.blockList.push(wall);
    const calls: string[] = [];
    const graphics = {
      rect: () => graphics, fill: () => graphics, stroke: () => graphics,
      setFillStyle: () => graphics, texture: () => { calls.push("shadow"); return graphics; },
    };
    const receiver = Object.assign(Object.create(GameRenderer.prototype), {
      app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
      world: null, textures: { centerGradient: {}, walls: Array.from({ length: 48 }, () => ({ source: { style: {} } })) },
      onScreen: () => true, nextWallLayer: () => graphics, nextSceneLayer: () => graphics,
      drawWall: () => calls.push("wall"),
    });
    receiver.drawLevel(graphics, level, root, { x: 100, y: 100, width: 180, height: 180 }, 0, new Set(), false);
    expect(calls).toEqual(["shadow", "wall"]);
  });
});
