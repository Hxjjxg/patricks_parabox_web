import { describe, expect, it } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";

const directions = {
  L: [-1, 0],
  R: [1, 0],
  U: [0, 1],
  D: [0, -1],
} as const;

describe("camera flip state", () => {
  it("flips on an original level only when the player crosses the boundary", () => {
    const levelName = "1by1_playerr_flip2";
    const world = parseLevel(getLevelSource(levelName), levelName);
    const movement = new MovementEngine(world);
    const commands = "DDRURLUDDLUDDLRUDRUDLDRDULDRRRD";

    for (const command of commands.slice(0, -1)) {
      const [dx, dy] = directions[command as keyof typeof directions];
      movement.applyDirectionalInput(dx, dy);
      expect(world.cameraFlipH).toBe(false);
    }

    const finalCommand = commands.at(-1);
    if (!finalCommand) throw new Error("Missing final camera-flip command");
    const [dx, dy] =
      directions[finalCommand as keyof typeof directions];
    const result = movement.applyDirectionalInput(dx, dy);
    expect(result.moved).toBe(true);
    expect(world.cameraFlipH).toBe(true);

    expect(movement.undo()).toBe(true);
    expect(world.cameraFlipH).toBe(false);
    expect(movement.redo()).toBe(true);
    expect(world.cameraFlipH).toBe(true);
  });
});
