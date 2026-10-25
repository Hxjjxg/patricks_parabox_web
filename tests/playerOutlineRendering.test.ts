import type { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { AnimType } from "../src/core/animation";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { Block, DrawStyle, FloorType, WorldModel } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import { drawBlockBorder, guiHsvColor, isInfinityBorder } from "../src/render/borderRendering";
import nativeWalk from "./fixtures/original/infenter_first_2-walk.json";

interface Rect {x: number; y: number; width: number; height: number}
interface SourceBorderContext {
  readonly screenshottingBlocks?: boolean;
  readonly inHub?: boolean;
  readonly buttonsSatisfied?: boolean;
  readonly drawStyle?: DrawStyle;
  readonly depth?: number;
}
// This deliberately calls the existing helper. Before integration, JavaScript
// ignores the new context and the missing positive overrides fail below.
const invokeBorder = drawBlockBorder as (
  graphics: Graphics, block: Block, rect: Rect, staticRect: Rect, flipH: boolean,
  screenWidth: number, screenHeight: number, resolution: number, time: number,
  context: SourceBorderContext,
) => void;

const rect = {x: 10, y: 20, width: 54, height: 54};
function render(block: Block, context: SourceBorderContext = {}, time = 0) {
  const calls: Array<{rect: number[]; color: number}> = [];
  let last: number[] = [];
  const g = {rect: (...values: number[]) => {last = values; return g;},
    fill: (color: number) => {calls.push({rect: last, color}); return g;}};
  invokeBorder(g as unknown as Graphics, block, rect, rect, false, 800, 600, 1, time,
    {drawStyle: DrawStyle.Normal, depth: 1, inHub: false, buttonsSatisfied: false, ...context});
  return calls;
}
function localGoal(isPlayer = true, type: FloorType = FloorType.PlayerButton) {
  const world = new WorldModel("outline-test"), outer = world.createLevel(3, 3), sub = world.createLevel(1, 1);
  const block = world.createBlock(1, 1, outer, sub); block.isPlayer = isPlayer;
  block.color = {h: .9, s: 1, v: .7};
  world.createBlock(0, 0, sub, null); sub.filledWithWalls = true;
  world.createFloor(1, 1, outer, type);
  return {world, outer, sub, block};
}
const baseColor = (block: Block) => guiHsvColor({h: block.color.h, s: block.color.s * 1.2, v: block.color.v * .18});
const colors = (block: Block, context: SourceBorderContext = {}, time = 0) => render(block, context, time).map(call => call.color);

describe("native local goal outline override", () => {
  it("makes the actual22-input native endpoint player white before the whole level is won", () => {
    const world = parseLevel(getLevelSource(nativeWalk.levelName), nativeWalk.levelName), engine = new MovementEngine(world);
    const vectors: Record<string, readonly [number, number]> = {LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, 1], DOWN: [0, -1]};
    for (const command of nativeWalk.trace.slice(1)) {
      const vector = vectors[command.command]; if (!vector) throw new Error("Unexpected fixture command");
      engine.applyDirectionalInput(...vector);
    }
    const player = world.findPlayerBlock();
    expect(world.moveCount).toBe(22);
    expect([world.finishesSatisfied, world.buttonsSatisfied, world.winning]).toEqual([true, false, false]);
    expect([world.levels.indexOf(player.outerLevel!), player.x, player.y]).toEqual([0, 5, 5]);
    expect(player.outerLevel!.getFloor(5, 5)?.type).toBe(FloorType.PlayerButton);
    expect(isInfinityBorder(player)).toBe(false);
    expect(colors(player, {buttonsSatisfied: false})).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
  });
  it.each([FloorType.Button, FloorType.PlayerButton])("whitens the correct local %s occupant", type => {
    const {block} = localGoal(type === FloorType.PlayerButton, type);
    expect(colors(block)).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
  });
  it.each([[true, FloorType.Button], [false, FloorType.PlayerButton]] as const)("does not whiten player=%s on the wrong %s floor", (isPlayer, type) => {
    const {block} = localGoal(isPlayer, type);
    expect(colors(block, {buttonsSatisfied: true})).toEqual(Array(4).fill(baseColor(block)));
  });
  it("does not use any other goal in the world as the local coverage predicate", () => {
    const {world, outer, block} = localGoal(); world.removeFloor(outer.getFloor(1, 1)!);
    world.createFloor(2, 2, outer, FloorType.PlayerButton);
    expect(colors(block, {buttonsSatisfied: true})).toEqual(Array(4).fill(baseColor(block)));
  });
  it("suppresses the local white override while ScreenshottingBlocks", () => {
    const {block} = localGoal();
    expect(colors(block, {screenshottingBlocks: true})).toEqual(Array(4).fill(baseColor(block)));
  });
  it.each([false, true])("applies the Hub-only ButtonsSatisfied=%s gate", buttonsSatisfied => {
    const {block} = localGoal();
    expect(colors(block, {inHub: true, buttonsSatisfied})).toEqual(Array(4).fill(buttonsSatisfied ? 0xffffff : baseColor(block)));
  });
  it.each([0, 1])("suppresses GRID's local white only at native ticket depth0, depth=%s", depth => {
    const {block} = localGoal();
    expect(colors(block, {drawStyle: DrawStyle.Grid, depth})).toEqual(Array(4).fill(depth === 0 ? baseColor(block) : 0xffffff));
  });
  it("keeps locked red after the local white override", () => {
    const {block} = localGoal(); block.locked = true;
    expect(colors(block)).toEqual([0xff0000, 0xff0000, 0xff0000, 0xff0000]);
  });
  it("overrides an infinity tier's oscillating color without changing its full strips", () => {
    const {block, sub, world, outer} = localGoal();
    world.removeBlock(sub.getBlock(0, 0)!); sub.filledWithWalls = false; outer.infZone = true;
    expect(isInfinityBorder(block)).toBe(true);
    const active = render(block), suppressed = render(block, {screenshottingBlocks: true});
    expect(active.map(call => call.color)).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
    expect(active.map(call => call.rect)).toEqual(suppressed.map(call => call.rect));
    expect(suppressed.map(call => call.color)).toEqual([0xa69600, 0xa69600, 0xa69600, 0xa69600]);
  });
  it("keeps the source white goal override ahead of the animated infinity clock", () => {
    const {block} = localGoal(); block.isSomeInfExitBlock = true;
    expect(colors(block, {}, 0)).toEqual(colors(block, {}, 5 / 3));
    expect(colors(block, {}, 0)).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
    block.locked = true; expect(colors(block, {}, 5 / 3)).toEqual([0xff0000, 0xff0000, 0xff0000, 0xff0000]);
  });
  it("selects local coverage from logical destination while the player is still animating toward it", () => {
    const {block} = localGoal(); block.moving = true; block.anim = AnimType.Normal;
    block.animT = .050701; block.animLength = .1; block.drawYOffset = .492990017;
    const moving = colors(block); block.moving = false; block.anim = AnimType.BumpHalt;
    block.animT = .235931888; block.animLength = .22; block.drawYOffset = 0;
    expect(moving).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
    expect(colors(block)).toEqual(moving);
  });
});
