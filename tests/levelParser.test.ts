import { describe, expect, it } from "vitest";
import firstPuzzle from "../src/assets/levels/first_puzzle.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource, levelNames } from "../src/core/levelRepository";
import { DrawStyle, FloorType } from "../src/core/model";

describe("version 4 level parser", () => {
  it("loads the original first puzzle without translating its data format", () => {
    const world = parseLevel(firstPuzzle, "first_puzzle");
    const root = world.rootBlock;

    expect(root?.subLevel?.width).toBe(7);
    expect(root?.subLevel?.height).toBe(7);
    expect(world.findPlayerBlock().x).toBe(2);
    expect(world.findPlayerBlock().y).toBe(2);
    expect(
      world.floors.filter((floor) => floor.type === FloorType.Button),
    ).toHaveLength(1);
    expect(
      world.floors.filter((floor) => floor.type === FloorType.PlayerButton),
    ).toHaveLength(1);
    expect(world.blocks.length).toBeGreaterThan(20);
  });

  it("preserves shared recursive level references", () => {
    const source = `version 4
#
Block -1 -1 0 4 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.1 0.8 1 1 1 0 0 0 0 0 0
\tRef 2 1 1 0 0 0 0 0 0 0 0 0 0 0 0
`;
    const world = parseLevel(source, "shared_ref");
    const rootLevel = world.rootBlock?.subLevel;
    const first = rootLevel?.getBlock(1, 1);
    const reference = rootLevel?.getBlock(2, 1);

    expect(first?.subLevel).toBeTruthy();
    expect(reference?.subLevel).toBe(first?.subLevel);
    expect(first?.subLevel?.blocksWithThisAsTheirSubLevel).toContain(reference);
  });

  it("uses the original multi-player camera focus marker", () => {
    const marked = parseLevel(
      getLevelSource("multi_order_0"),
      "multi_order_0",
    );
    const focus = marked.multiplePlayerFocusBlock;

    expect(marked.playerBlocks).toHaveLength(4);
    expect(focus?.specialEffect).toBe(12);
    expect(marked.getDefaultFocusBlock()).toBe(focus);
    expect(
      marked.playerBlocks.every(
        (player) => player.outerLevel === focus?.subLevel,
      ),
    ).toBe(true);

    const rootFocused = parseLevel(
      getLevelSource("multi_order"),
      "multi_order",
    );
    expect(rootFocused.playerBlocks.length).toBeGreaterThan(1);
    expect(rootFocused.multiplePlayerFocusBlock).toBe(rootFocused.rootBlock);
    expect(rootFocused.getDefaultFocusBlock()).toBe(rootFocused.rootBlock);
  });

  it("uses special effect 1 for the static-focus puzzle", () => {
    const world = parseLevel(
      getLevelSource("static_focus_block"),
      "static_focus_block",
    );

    expect(world.specificFocusBlock?.specialEffect).toBe(1);
    expect(world.getDefaultFocusBlock()).toBe(world.specificFocusBlock);
  });

  it("preserves draw-style headers that change focus and input rules", () => {
    const oldStyle = parseLevel(
      getLevelSource("oldstyle_lock_two_doors"),
      "oldstyle_lock_two_doors",
    );
    expect(oldStyle.drawStyle).toBe(DrawStyle.QuickAnim);
    expect(oldStyle.getDefaultFocusBlock()).toBe(
      oldStyle.findPlayerBlock(),
    );
    oldStyle.findPlayerBlock().flipH = true;
    oldStyle.cameraFlipH = true;
    expect(oldStyle.inputFlipH()).toBe(true);

    const grid = parseLevel(
      getLevelSource("shed_multi_simultaneous"),
      "shed_multi_simultaneous",
    );
    grid.cameraFlipH = true;
    expect(grid.drawStyle).toBe(DrawStyle.Grid);
    expect(grid.inputFlipH()).toBe(false);

    const tui = parseLevel(getLevelSource("text_1"), "text_1");
    tui.cameraFlipH = true;
    expect(tui.drawStyle).toBe(DrawStyle.TuiColor);
    expect(tui.inputFlipH()).toBe(false);
  });

  it("resolves all original Hub information keys to their English text", () => {
    const hub = parseLevel(getLevelSource("hub"), "hub");
    const infoFloors = hub.floors.filter(
      (floor) => floor.type === FloorType.Info,
    );

    expect(infoFloors).toHaveLength(8);
    expect(
      infoFloors.every(
        (floor) =>
          floor.info.length > 0 && floor.info !== floor.infoKey,
      ),
    ).toBe(true);
    expect(
      infoFloors.find((floor) => floor.infoKey === "Tip_Undo")?.info,
    ).toBe(
      "Undo, Redo, and Reset are useful tools. Don't be afraid to use them often!",
    );
    expect(
      infoFloors.find(
        (floor) => floor.infoKey === "Sign_Congratulations",
      )?.info,
    ).toContain("Thank you for playing!");
  });

  it("loads every original version 4 level resource", () => {
    const failures: string[] = [];

    for (const levelName of levelNames) {
      try {
        const world = parseLevel(getLevelSource(levelName), levelName);
        expect(world.rootBlock, levelName).toBeTruthy();
        expect(world.rootBlock?.subLevel, levelName).toBeTruthy();
        if (world.playerBlocks.length > 1) {
          expect(
            world.multiplePlayerFocusBlock?.subLevel,
            `${levelName} multi-player focus`,
          ).toBeTruthy();
        }
      } catch (error) {
        failures.push(
          `${levelName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
