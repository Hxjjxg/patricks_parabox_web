import { describe, expect, it } from "vitest";
import multiOrder from "../src/assets/levels/multi_order_0.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { MovementEngine } from "../src/core/movement";

const pushLevel = `version 4
#
Block -1 -1 0 5 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\tBlock 2 1 2 1 1 0.1 0.8 1 1 1 0 0 0 0 0 0
`;

const enterLevel = `version 4
#
Block -1 -1 0 4 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\tBlock 2 1 2 3 3 0.1 0.8 1 1 0 0 0 0 0 0 0
\tWall 3 1 0 0 0
`;

const possessLevel = `version 4
#
Block -1 -1 0 4 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\tWall 2 1 0 1 0
\tWall 3 1 0 0 0
`;

const flipEnterLevel = `version 4
#
Block -1 -1 0 5 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\tBlock 2 1 2 3 3 0.1 0.8 1 1 0 0 0 0 1 0 0
\tWall 3 1 0 0 0
`;

describe("recursive movement", () => {
  it("drives all four original player blocks with one input and one undo", () => {
    const world = parseLevel(multiOrder, "multi_order_0");
    const movement = new MovementEngine(world);

    expect(world.playerBlocks.map((block) => block.playerOrder)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(world.playerBlocks.every((block) => block.isPlayer)).toBe(true);
    expect(movement.applyDirectionalInput(0, 1).moved).toBe(true);
    expect(world.playerBlocks.map((block) => block.y)).toEqual([6, 6, 6, 6]);
    expect(world.moveCount).toBe(1);
    expect(movement.history.past).toHaveLength(4);
    expect(
      movement.history.past.every((turn) => turn.moveCount === 1),
    ).toBe(true);

    expect(movement.undo()).toBe(true);
    expect(world.playerBlocks.map((block) => block.y)).toEqual([5, 5, 5, 5]);
    expect(world.moveCount).toBe(0);

    expect(movement.redo()).toBe(true);
    expect(world.playerBlocks.map((block) => block.y)).toEqual([6, 6, 6, 6]);
    expect(world.moveCount).toBe(1);
  });

  it("does not count an input when every player block is blocked", () => {
    const world = parseLevel(multiOrder, "multi_order_0");
    const movement = new MovementEngine(world);

    expect(movement.applyDirectionalInput(-1, 0).moved).toBe(false);
    expect(world.playerBlocks.map((block) => [block.x, block.y])).toEqual([
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
    ]);
    expect(world.moveCount).toBe(0);
    expect(movement.history.past).toHaveLength(0);
  });

  it("pushes chains and replays the exact turn through undo/redo", () => {
    const world = parseLevel(pushLevel, "push");
    const movement = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const box = player.outerLevel?.getBlock(2, 1);

    expect(world.playerBlocks).toEqual([player]);
    expect(box?.isPlayer).toBe(false);
    expect(movement.applyDirectionalInput(1, 0).moved).toBe(true);
    expect(player.x).toBe(2);
    expect(box?.x).toBe(3);
    expect(world.moveCount).toBe(1);

    expect(movement.undo()).toBe(true);
    expect(player.x).toBe(1);
    expect(box?.x).toBe(2);
    expect(world.moveCount).toBe(0);

    expect(movement.redo()).toBe(true);
    expect(player.x).toBe(2);
    expect(box?.x).toBe(3);
    expect(world.moveCount).toBe(1);
  });

  it("enters a blocked recursive box and exits through its boundary", () => {
    const world = parseLevel(enterLevel, "enter");
    const movement = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const rootLevel = player.outerLevel;
    const target = rootLevel?.getBlock(2, 1);

    expect(target?.subLevel).toBeTruthy();
    expect(movement.impulse(player, 1, 0).moved).toBe(true);
    expect(player.outerLevel).toBe(target?.subLevel);
    expect(player.x).toBe(0);
    expect(player.y).toBe(1);

    expect(movement.impulse(player, -1, 0).moved).toBe(true);
    expect(player.outerLevel).toBe(rootLevel);
    expect(player.x).toBe(1);
    expect(player.y).toBe(1);
  });

  it("tracks camera flip through movement, undo, redo, and restart", () => {
    const world = parseLevel(flipEnterLevel, "flip-enter");
    const movement = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const flippedBox = player.outerLevel?.getBlock(2, 1);

    const result = movement.applyDirectionalInput(1, 0);
    expect(result.moved).toBe(true);
    expect(player.outerLevel).toBe(flippedBox?.subLevel);
    expect(world.cameraFlipH).toBe(true);
    expect(result.turn?.fromCameraFlipH).toBe(false);
    expect(result.turn?.toCameraFlipH).toBe(true);

    expect(movement.undo()).toBe(true);
    expect(world.cameraFlipH).toBe(false);
    expect(movement.redo()).toBe(true);
    expect(world.cameraFlipH).toBe(true);

    expect(movement.restart()).toBe(true);
    expect(world.cameraFlipH).toBe(false);
    expect(movement.undo()).toBe(true);
    expect(world.cameraFlipH).toBe(true);
  });

  it("bumps without creating an undo entry when movement is impossible", () => {
    const world = parseLevel(enterLevel, "blocked");
    const movement = new MovementEngine(world);
    const wall = world.rootBlock?.subLevel?.getBlock(3, 1);
    if (!wall) throw new Error("Fixture wall is missing");
    wall.outerLevel?.setBlock(0, 1, wall);
    wall.x = 0;
    wall.y = 1;
    const player = world.findPlayerBlock();
    player.outerLevel?.setBlock(1, 1, player);

    expect(movement.impulse(player, -1, 0).moved).toBe(false);
    expect(movement.history.past).toHaveLength(0);
    expect(world.moveCount).toBe(0);
  });

  it("restarts as an undoable zero-count turn", () => {
    const world = parseLevel(pushLevel, "restart");
    const movement = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const box = player.outerLevel?.getBlock(2, 1);

    expect(movement.restart()).toBe(false);
    expect(movement.impulse(player, 1, 0).moved).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([2, 3, 1]);

    expect(movement.restart()).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([1, 2, 0]);
    expect(movement.history.past.at(-1)?.isRestart).toBe(true);
    expect(movement.restart()).toBe(false);

    expect(movement.undo()).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([2, 3, 1]);

    expect(movement.undo()).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([1, 2, 0]);

    expect(movement.redo()).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([2, 3, 1]);
    expect(movement.redo()).toBe(true);
    expect([player.x, box?.x, world.moveCount]).toEqual([1, 2, 0]);
  });

  it("restart and undo restore the original and possessed player identities", () => {
    const world = parseLevel(possessLevel, "restart-possession");
    const movement = new MovementEngine(world);
    const originalPlayer = world.findPlayerBlock();
    const possessable = originalPlayer.outerLevel?.getBlock(2, 1);
    if (!possessable) throw new Error("Fixture possessable block is missing");

    expect(movement.impulse(originalPlayer, 1, 0).possessed).toBe(true);
    expect(world.findPlayerBlock()).toBe(possessable);

    expect(movement.restart()).toBe(true);
    expect(world.findPlayerBlock()).toBe(originalPlayer);
    expect(world.moveCount).toBe(0);

    expect(movement.undo()).toBe(true);
    expect(world.findPlayerBlock()).toBe(possessable);
    expect(world.moveCount).toBe(1);
  });
});
