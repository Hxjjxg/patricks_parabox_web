import { describe, expect, it } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";

const source = (header = "") => [
  "version 4", header, "#",
  "Block -1 -1 0 3 3 0.6 0 0.8 1 0 0 0 0 0 0 0",
  "\tBlock 1 1 1 5 5 0.9 0.5 0.2 1 1 1 1 0 0 0 0",
].join("\n");

describe("original scene palette application", () => {
  it("applies native palette7 to infinity player and green reference blocks", () => {
    const world = parseLevel(getLevelSource("infenter_zone_v2"), "infenter_zone_v2");
    const player = world.findPlayerBlock();
    expect(player.color.h).toBeCloseTo(0.96, 6);
    expect(player.color.s).toBeCloseTo(0.8, 6);
    expect(player.color.v).toBeCloseTo(0.7, 6);
    expect(world.blocks.some((block) => block.subLevel && Math.abs(block.color.h - 0.25) < 1e-6 && Math.abs(block.color.s - 0.83) < 1e-6)).toBe(true);
    const infRoot = world.blocks.find((block) => block.subLevel?.infZone)!;
    expect(infRoot.color).toEqual({ h: 0, s: 0, v: 0.3 });
  });

  it("applies native palette8 to the flip level's purple player", () => {
    const player = parseLevel(getLevelSource("1by1_playerr_flip2"), "1by1_playerr_flip2").findPlayerBlock();
    expect(player.color.h).toBeCloseTo(0.85, 6);
    expect(player.color.s).toBeCloseTo(0.6, 6);
    expect(player.color.v).toBeCloseTo(0.75, 6);
  });

  it("uses native palette0 fallback for unknown debug scenes", () => {
    expect(parseLevel(source(), "test_unknown_scene").findPlayerBlock().color).toEqual({ h: Math.fround(0.9), s: 1, v: Math.fround(0.7) });
  });

  it("preserves custom HSV without a palette header and honors an explicit palette", () => {
    expect(parseLevel(source(), "custom_level").findPlayerBlock().color).toEqual({ h: 0.9, s: 0.5, v: 0.2 });
    const color = parseLevel(source("palette 8"), "custom_level").findPlayerBlock().color;
    expect(color.h).toBeCloseTo(0.85, 6);
    expect(color.s).toBeCloseTo(0.6, 6);
    expect(color.v).toBeCloseTo(0.75, 6);
  });

  it.each(["hub", "palettes"])("leaves native%s source colors intact", (name) => {
    expect(parseLevel(source(), name).findPlayerBlock().color).toEqual({ h: 0.9, s: 0.5, v: 0.2 });
  });
});
