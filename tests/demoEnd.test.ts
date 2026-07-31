import { describe, expect, it } from "vitest";
import { demoEndFade, escapeActionForFloor, isDemoEndFloor } from "../src/core/demoEnd";
import { FloorType } from "../src/core/model";
import { getLevelSource } from "../src/core/levelRepository";
import { parseLevel } from "../src/core/levelParser";
import { localizeEnglish } from "../src/core/localization";

describe("DemoEnd floor behavior", () => {
  it("tracks the original floor animation ramp and pause value", () => {
    const world = parseLevel(
      getLevelSource("test_demo_end"),
      "test_demo_end",
    );
    world.computeBlockLists();
    const floor = world.floors.find(
      (candidate) => candidate.type === FloorType.DemoEnd,
    );
    expect(floor).toBeDefined();
    if (!floor) return;

    const player = world.findPlayerBlock();
    expect(player.outerLevel).toBe(floor.outerLevel);
    expect(player.x).toBe(floor.x);
    expect(player.y).toBe(floor.y);

    world.updateFloorAnimations(1);
    expect(floor.animationT).toBe(1);

    const level = floor.outerLevel;
    level.setBlock(player.x, player.y, null);
    player.x = floor.x - 1;
    level.setBlock(player.x, player.y, player);
    world.updateFloorAnimations(0.2);
    expect(floor.animationT).toBeCloseTo(0.65, 6);

    world.updateFloorAnimations(1, true);
    expect(floor.animationT).toBe(-0.4);
    world.updateFloorAnimations(1);
    expect(floor.animationT).toBe(0);
  });

  it("uses the demo end text and consumes Escape as undo", () => {
    const world = parseLevel(
      getLevelSource("test_demo_end"),
      "test_demo_end",
    );
    world.computeBlockLists();
    const floor = world.floors.find(
      (candidate) => candidate.type === FloorType.DemoEnd,
    ) ?? null;

    expect(isDemoEndFloor(floor)).toBe(true);
    expect(escapeActionForFloor(floor)).toBe("undo");
    expect(escapeActionForFloor(null)).toBe("pause");
    expect(localizeEnglish("DemoEnd_ThankYou")).toContain("demo");
    expect(localizeEnglish("DemoEnd_FullGame")).toContain("350");
    expect(localizeEnglish("DemoEnd_Follow")).toContain("purchase");
  });

  it("matches the original 0.65-second smooth fade curve", () => {
    expect(demoEndFade(0)).toBe(0);
    expect(demoEndFade(0.325)).toBeCloseTo(0.5, 6);
    expect(demoEndFade(0.65)).toBe(1);
    expect(demoEndFade(2)).toBe(1);
  });
});
