import { describe, expect, it } from "vitest";
import { parseCustomLevel } from "../src/core/customLevels";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { FloorType } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import {
  chooseRandomOrientation,
  sourceHasFlippedBlock,
  transformLevelCoordinate,
  type LevelOrientation,
} from "../src/core/orientation";

const allRecordTypesSource = [
  "version 4",
  "#",
  "Block -1 -1 0 3 3 0 0 0.8 1 0 0 0 0 0 0 0",
  "\tBlock 0 1 1 1 1 0.1 0.8 1 1 0 0 0 0 0 0 0",
  "\t\tWall 0 0 0 0 0",
  "\tWall 1 0 0 0 0",
  "\tFloor 2 0 Button",
  "\tRef 2 2 1 0 0 0 0 0 -1 0 0 0 0 0 0",
].join("\n");

const movementSource = [
  "version 4",
  "#",
  "Block -1 -1 0 3 1 0 0 0.8 1 0 0 0 0 0 0 0",
  "\tBlock 0 0 1 1 1 0.1 0.8 1 1 0 1 0 0 1 0 0",
  "\tFloor 1 0 PlayerButton",
].join("\n");

function sequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index++];
    if (value === undefined) throw new Error("Random sequence exhausted");
    return value;
  };
}

describe("random level orientation", () => {
  it("matches all eight original mirror-then-rotation coordinate transforms", () => {
    const cases: Array<readonly [LevelOrientation, readonly [number, number]]> = [
      [{ flipH: false, rotation: 0 }, [1, 2]],
      [{ flipH: true, rotation: 0 }, [3, 2]],
      [{ flipH: false, rotation: 1 }, [2, 3]],
      [{ flipH: true, rotation: 1 }, [2, 1]],
      [{ flipH: false, rotation: 2 }, [3, 1]],
      [{ flipH: true, rotation: 2 }, [1, 1]],
      [{ flipH: false, rotation: 3 }, [2, 1]],
      [{ flipH: true, rotation: 3 }, [2, 3]],
    ];

    for (const [orientation, expected] of cases) {
      const result = transformLevelCoordinate(1, 2, 5, 4, orientation);
      expect([result.x, result.y], JSON.stringify(orientation)).toEqual(expected);
    }
  });

  it("can select every non-identity orientation and retries identity", () => {
    const cases: Array<readonly [readonly number[], LevelOrientation]> = [
      [[0.1, 0.3], { flipH: false, rotation: 1 }],
      [[0.1, 0.55], { flipH: false, rotation: 2 }],
      [[0.1, 0.8], { flipH: false, rotation: 3 }],
      [[0.8, 0.1], { flipH: true, rotation: 0 }],
      [[0.8, 0.3], { flipH: true, rotation: 1 }],
      [[0.8, 0.55], { flipH: true, rotation: 2 }],
      [[0.8, 0.8], { flipH: true, rotation: 3 }],
    ];

    for (const [samples, expected] of cases) {
      expect(
        chooseRandomOrientation(allRecordTypesSource, sequenceRandom(samples)),
      ).toEqual(expected);
    }

    expect(
      chooseRandomOrientation(
        allRecordTypesSource,
        sequenceRandom([0.1, 0.1, 0.1, 0.8]),
      ),
    ).toEqual({ flipH: false, rotation: 3 });
  });

  it("restricts rotation to zero or 180 degrees when any Block or Ref is flipped", () => {
    const flippedBlock = allRecordTypesSource.replace(
      "0 0 0 0\n\t\tWall",
      "0 1 0 0\n\t\tWall",
    );
    const flippedRef = allRecordTypesSource.replace(
      "\tRef 2 2 1 0 0 0 0 0 -1 0 0 0 0 0 0",
      "\tRef 2 2 1 0 0 0 0 0 -1 0 0 0 1 0 0",
    );

    expect(sourceHasFlippedBlock(flippedBlock)).toBe(true);
    expect(sourceHasFlippedBlock(flippedRef)).toBe(true);
    expect(
      chooseRandomOrientation(flippedBlock, sequenceRandom([0.1, 0.9])),
    ).toEqual({ flipH: false, rotation: 2 });
    expect(
      chooseRandomOrientation(flippedRef, sequenceRandom([0.9, 0.1])),
    ).toEqual({ flipH: true, rotation: 0 });
  });

  it("applies one orientation to Block, Wall, Floor, and Ref records", () => {
    const world = parseLevel(allRecordTypesSource, "orientation_records", {
      randomOrientation: true,
      orientation: { flipH: false, rotation: 1 },
    });
    const root = world.rootBlock;
    const level = root?.subLevel;

    expect([root?.x, root?.y]).toEqual([-1, -1]);
    expect(level?.getBlock(1, 2)?.subLevel).toBeTruthy();
    expect(level?.getBlock(0, 1)?.subLevel).toBeNull();
    expect(level?.getBlock(2, 0)?.subLevel).toBe(
      level?.getBlock(1, 2)?.subLevel,
    );
    expect(
      world.floors.find((floor) => floor.type === FloorType.Button),
    ).toMatchObject({ x: 0, y: 0 });
  });

  it("never randomizes the Hub and does randomize custom levels", () => {
    const hubNamed = parseLevel(allRecordTypesSource, "hub", {
      randomOrientation: true,
      random: () => {
        throw new Error("Hub must not sample an orientation");
      },
    });
    expect(hubNamed.rootBlock?.subLevel?.getBlock(0, 1)?.subLevel).toBeTruthy();

    const custom = parseCustomLevel(allRecordTypesSource, {
      randomOrientation: true,
      orientation: { flipH: true, rotation: 0 },
    });
    expect(custom.rootBlock?.subLevel?.getBlock(2, 1)?.subLevel).toBeTruthy();
  });

  it("rotates movement layouts while leaving each block's own flip flag unchanged", () => {
    const mirrored = parseCustomLevel(movementSource, {
      randomOrientation: true,
      orientation: { flipH: true, rotation: 0 },
    });
    expect(mirrored.findPlayerBlock()).toMatchObject({ x: 2, y: 0, flipH: true });

    const result = new MovementEngine(mirrored).applyDirectionalInput(-1, 0);
    expect(result).toMatchObject({ moved: true, won: true });
    expect(mirrored.findPlayerBlock()).toMatchObject({ x: 1, y: 0 });
  });

  it("reproduces the original rectangular 90-degree load failure boundary", () => {
    const source = getLevelSource("7by3ref");

    expect(() =>
      parseLevel(source, "7by3ref", {
        randomOrientation: true,
        orientation: { flipH: false, rotation: 1 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      parseLevel(source, "7by3ref", {
        randomOrientation: true,
        orientation: { flipH: false, rotation: 2 },
      }),
    ).not.toThrow();
  });
});
