import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";

function drawingHarness() {
  const fills: unknown[] = [];
  let faces = 0;
  let syntheticVoids = 0;
  const graphics = { rect: () => graphics, fill: (fill: unknown) => { fills.push(fill); return graphics; }, stroke: () => graphics };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
    world: { drawStyle: DrawStyle.Normal }, textures: { centerGradient: {} },
    onScreen: () => true, nextWallLayer: () => graphics, nextSceneLayer: () => graphics,
    drawFace: () => { faces++; }, drawRecursiveVoid: () => { syntheticVoids++; },
  });
  return { graphics, receiver, fills, faces: () => faces, syntheticVoids: () => syntheticVoids };
}

describe("native recursive scene contents", () => {
  it.each(["root", "nested"])("preserves the underlying starfield through%s infinity backing", (path) => {
    const level = new Level(1, 7, 7); level.infZone = true;
    const block = new Block(1); block.init(0, 0, null, level);
    block.color = { h: 0, s: 0, v: 0.3 };
    const h = drawingHarness();
    const rect = { x: 10, y: 10, width: 300, height: 300 };
    if (path === "root") h.receiver.drawLevel(h.graphics, level, block, rect, 0, new Set(), false);
    else h.receiver.drawBlock(h.graphics, block, rect, 0, new Set(), false);
    expect(h.fills.filter((fill) => typeof fill === "number")).toEqual([]);
    // Native transparent backing retains its gradient plus the early white-alpha open-edge frame.
    const objects=h.fills.filter((fill):fill is Record<string,unknown>=>typeof fill==="object"&&fill!==null);
    expect(objects.filter(fill=>"texture" in fill)).toHaveLength(1);
    expect(objects.filter(fill=>!("texture" in fill))).toEqual(Array(4).fill({color:0xffffff,alpha:0.4}));
  });

  it("draws repeated world faces to native ticket depth15 instead of replacing them with synthetic frames", () => {
    const level = new Level(1, 1, 1);
    const root = new Block(1); root.init(0, 0, null, level);
    const player = new Block(2); player.init(0, 0, level, level);
    player.isPlayer = true; player.drawIsPlayer = true; level.blockList.push(player);
    const h = drawingHarness();
    h.receiver.drawLevel(h.graphics, level, root, { x: 10, y: 10, width: 300, height: 300 }, 0, new Set(), false);
    expect(h.syntheticVoids()).toBe(0);
    expect(h.faces()).toBe(14);
  });
});
