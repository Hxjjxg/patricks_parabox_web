import { describe, expect, it } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";

type Direction = readonly [dx: number, dy: number];

function play(levelName: string, directions: readonly Direction[]): MovementEngine {
  const world = parseLevel(getLevelSource(levelName), levelName);
  const movement = new MovementEngine(world);
  for (const [dx, dy] of directions) {
    movement.applyDirectionalInput(dx, dy);
  }
  return movement;
}

describe("focused recursive mechanics", () => {
  it("moves the player block across a recursive level boundary", () => {
    const movement = play("enter", [
      [1, 0],
      [0, 1],
      [0, 1],
      [0, 1],
      [-1, 0],
      [0, 1],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]);

    expect(
      movement.history.past.some((turn) =>
        turn.moves.some((move) => move.fromLevel !== move.toLevel),
      ),
    ).toBe(true);
  });

  it("transfers control through possession", () => {
    const movement = play("possess_first", [
      [-1, 0],
      [0, -1],
      [0, -1],
      [-1, 0],
      [-1, 0],
    ]);

    expect(
      movement.history.past.some((turn) => turn.playerSwitches.length > 0),
    ).toBe(true);
  });

  it("applies recursive horizontal reflection", () => {
    const movement = play("flip_first", [
      [1, 0],
      [0, -1],
      [0, -1],
      [1, 0],
      [1, 0],
    ]);

    expect(
      movement.world.blocks.some(
        (block) => block.flipH !== block.startFlipH,
      ),
    ).toBe(true);
  });

  it("moves a non-player box into another box through eating", () => {
    const movement = play("eat_same_side", [
      [-1, 0],
      [-1, 0],
    ]);

    expect(
      movement.history.past.some((turn) =>
        turn.moves.some(
          (move) => !move.block.isPlayer && move.fromLevel !== move.toLevel,
        ),
      ),
    ).toBe(true);
  });

  it("moves the exiting block and its container in one shed input", () => {
    const movement = play("shed_first", [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
    ]);

    expect(
      movement.history.past.some(
        (turn) =>
          turn.moves.length >= 2 &&
          turn.moves.some((move) => move.fromLevel !== move.toLevel),
      ),
    ).toBe(true);
  });
});
