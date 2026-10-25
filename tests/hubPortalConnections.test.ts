import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import hubSource from "../src/assets/levels/hub.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { FloorType, WorldModel } from "../src/core/model";
import { ProgressionModel } from "../src/core/progression";
import { buildHubConnections, captureHubUnlockWalls, computeHubUnlockLineShape, hubConnectionLineColor,
  hubConnectionRectangles, hubConnectionWaypoints, type HubConnection, type HubUnlockWall } from "../src/render/hubPortalRendering";

const evidencePath = fileURLToPath(new URL("../docs/parity/evidence/original/hub-portal-rendering-native-derived.json", import.meta.url));
const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as {sourceDerived: {intro: {visibleLineRoutes: Array<{
  from: string; shape: string; localWaypoints: number[][]; thick: boolean
}>}; lines: {managedIlProof: {finalLitParameterReferenceCount: number}}}};

function intro(wonLevels: string[] = []) {
  const world = parseLevel(hubSource, "hub");
  const walls = captureHubUnlockWalls(world.blocks);
  const progress = new ProgressionModel({wonLevels});
  progress.applyToHub(world);
  const lines = buildHubConnections(world.floors, walls);
  const level = world.levels.find(level => level.hubAreaName === "Area_Intro")!;
  return {world, walls, level, lines: lines.filter(line => line.floor.outerLevel === level)};
}
function grid() {
  const world = new WorldModel("hub");
  const level = world.createLevel(12, 12);
  level.hubAreaName = "Area_Challenge";
  return {world, level};
}
function baseLine(overrides: Partial<HubConnection> = {}) {
  const {world, level} = grid();
  const floor = world.createFloor(2, 2, level, FloorType.LevelPortal);
  floor.sceneName = "first_puzzle";
  return {floor, target: null, dx: 0, dy: 0, shape: "Straight", thick: true, lit: false, kind: "puzzle", ...overrides} as HubConnection;
}

describe("native Hub connection data", () => {
  it("pins source evidence and preserves the genuinely unused draw-pass parameter", () => {
    expect(createHash("sha256").update(readFileSync(evidencePath)).digest("hex")).toBe("1b73c0c69b7247e5e780958de3ad88c8d6140979558f98d65a81a2f976b9a178");
    expect(evidence.sourceDerived.lines.managedIlProof.finalLitParameterReferenceCount).toBe(0);
  });
  it("constructs only the two native Intro routes rather than immediate-neighbor lines", () => {
    const {lines} = intro(["first_puzzle", "second_puzzle", "third_puzzle"]);
    expect(lines).toHaveLength(2);
    for (const native of evidence.sourceDerived.intro.visibleLineRoutes) {
      const line = lines.find(line => line.floor.sceneName === native.from)!;
      expect(line.shape).toBe(native.shape);
      expect(line.thick).toBe(native.thick);
      expect(hubConnectionWaypoints(line).map(point => [point.x, point.y])).toEqual(native.localWaypoints);
    }
    expect(lines.map(line => [line.floor.sceneName, line.kind, line.lit])).toEqual([
      ["third_puzzle", "puzzle", true], ["lock_door", "shortcut", false],
    ]);
  });
  it("retains shortcut coordinates and lights its path after progression removes the wall", () => {
    const won = ["first_puzzle", "second_puzzle", "third_puzzle", "enter", "elbow_finish_idiom", "round_corners", "separate", "enter_two_sides", "lock_door"];
    const {lines, walls, level} = intro(won);
    expect(level.getBlock(5, 2)).toBeNull();
    expect(walls.find(wall => wall.level === level && wall.unlockerScene === "lock_door")).toMatchObject({x: 5, y: 2});
    expect(lines.find(line => line.kind === "shortcut")).toMatchObject({shape: "VertFirstS", dx: -2, dy: -3, lit: true});
  });
  it("does not mutate the source model while building connection records", () => {
    const {world, walls} = intro();
    const floors = world.floors.map(floor => [floor.id, floor.x, floor.y, floor.unlocked, floor.won]);
    const blocks = world.blocks.map(block => [block.id, block.x, block.y]);
    buildHubConnections(Object.freeze([...world.floors]), Object.freeze(walls.map(wall => Object.freeze(wall))));
    expect(world.floors.map(floor => [floor.id, floor.x, floor.y, floor.unlocked, floor.won])).toEqual(floors);
    expect(world.blocks.map(block => [block.id, block.x, block.y])).toEqual(blocks);
  });
  it("orders hard destinations before core destinations and uses destination unlock state", () => {
    const {world, level} = grid();
    const source = world.createFloor(1, 1, level, FloorType.LevelPortal); source.sceneName = "source";
    const core = world.createFloor(4, 1, level, FloorType.LevelPortal); core.sceneName = "core"; core.unlocked = true;
    const hard = world.createFloor(1, 4, level, FloorType.LevelPortal); hard.sceneName = "hard"; hard.hard = 2;
    const links = [{from: "source", to: "core", immediate: false}, {from: "source", to: "hard", immediate: false}];
    expect(buildHubConnections(world.floors, [], {links}).map(line => [line.target?.sceneName, line.thick, line.lit])).toEqual([
      ["hard", false, false], ["core", true, true],
    ]);
  });
  it("uses left/down/up/right shortcut-neighbor priority and honors explicit open state", () => {
    const {world, level} = grid();
    const floor = world.createFloor(1, 1, level, FloorType.LevelPortal); floor.sceneName = "first_puzzle";
    world.createBlock(4, 5, level, world.createLevel(1, 1));
    world.createBlock(5, 4, level, world.createLevel(1, 1));
    const wall: HubUnlockWall = {x: 5, y: 5, level, unlockerScene: "first_puzzle", open: true};
    expect(buildHubConnections(world.floors, [wall], {links: []})).toMatchObject([{dx: 3, dy: 4, lit: true, thick: true, kind: "shortcut"}]);
  });
  it.each(["Area_Challenge", "Area_Gallery", "Area_Priority", "Area_Extrude", "Area_Push"])("omits source-excluded root paths in%s", area => {
    const {world, level} = grid(); level.hubAreaName = area;
    const floor = world.createFloor(2, 3, level, FloorType.LevelPortal); floor.sceneName = "root";
    expect(buildHubConnections(world.floors, [], {links: []})).toEqual([]);
  });
  it("includes the native top-edge root and end-game special paths", () => {
    const {world, level} = grid(); level.hubAreaName = "Area_Enter";
    const root = world.createFloor(2, 3, level, FloorType.LevelPortal); root.sceneName = "root"; root.unlocked = true;
    const last = world.createFloor(6, 3, level, FloorType.LevelPortal); last.sceneName = "iii"; last.won = true;
    const lines = buildHubConnections(world.floors, [], {links: [], nexusUnlocked: true});
    expect(lines.find(line => line.floor === root)).toMatchObject({shape: "Straight", dx: 0, dy: 9, lit: true, kind: "root"});
    expect(lines.filter(line => line.floor === last && line.kind !== "root")).toMatchObject([
      {dx: 3, dy: -2, shape: "VertFirstL", lastPortal: true, lit: true},
      {dx: 4, dy: -1, shape: "HorizFirstL", finishToReception: true, lit: true},
    ]);
  });
});

describe("Floor.ComputeUnlockLineShape routing", () => {
  it.each([[3, 2, "HorizFirstL"], [2, 3, "VertFirstL"], [-2, -2, "HorizFirstL"]] as const)("prefers the larger axis for delta%s,%s", (dx, dy, shape) => {
    const {level} = grid();
    expect(computeHubUnlockLineShape(level, {x: 5, y: 5}, dx, dy).shape).toBe(shape);
  });
  it("excludes the two endpoints but includes the L corner in blocker checks", () => {
    const {world, level} = grid();
    world.createFloor(2, 2, level, FloorType.LevelPortal); world.createFloor(5, 5, level, FloorType.LevelPortal);
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3)).toEqual({shape: "HorizFirstL", destinationExitDY: 1});
    world.createFloor(5, 2, level, FloorType.Info);
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3)).toEqual({shape: "VertFirstL", destinationExitDX: 1});
  });
  it.each([[true, "HorizFirstS"], [false, "VertFirstS"]] as const)("chooses the source one-cell S fallback with adjacentBlocked%s", (adjacent, shape) => {
    const {world, level} = grid();
    world.createBlock(3, 2, level, null);
    world.createBlock(2, adjacent ? 3 : 4, level, null);
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3).shape).toBe(shape);
  });
  it("distinguishes ordinary walls, nested blocks and unlock-wall position records", () => {
    const {world, level} = grid();
    const wall = world.createBlock(3, 2, level, null); wall.unlockerScene = "gate";
    const registry = captureHubUnlockWalls(world.blocks);
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3, false, registry).shape).toBe("VertFirstL");
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3, true, registry).shape).toBe("HorizFirstL");
    world.removeBlock(wall); world.createBlock(3, 2, level, world.createLevel(1, 1));
    expect(computeHubUnlockLineShape(level, {x: 2, y: 2}, 3, 3).shape).toBe("HorizFirstL");
  });
  it("returns straight directions before any obstruction test", () => {
    const {world, level} = grid(); world.createBlock(2, 3, level, null);
    expect(computeHubUnlockLineShape(level, {x: 2, y: 5}, 0, -4)).toEqual({shape: "Straight", destinationExitDX: 0, destinationExitDY: -1});
  });
});

describe("native Hub connection rectangles and colors", () => {
  it("constructs the Intro L/S strips with y inversion and native segment order", () => {
    const line = baseLine({dx: -2, dy: -2, shape: "HorizFirstL"});
    expect(hubConnectionRectangles(line, {x: 400, y: 250, cellWidth: 50, cellHeight: 40})).toEqual([
      {x: 293, y: 243, width: 115, height: 15}, {x: 293, y: 243, width: 15, height: 95},
    ]);
    expect(hubConnectionRectangles({...line, dy: -3, shape: "VertFirstS"}, {x: 550, y: 330, cellWidth: 50, cellHeight: 40})).toEqual([
      {x: 543, y: 323, width: 15, height: 55}, {x: 443, y: 363, width: 15, height: 95}, {x: 443, y: 363, width: 115, height: 15},
    ]);
  });
  it("retains float32 width coefficients instead of rounding nominal32/12 widths", () => {
    const line = baseLine({dy: -1});
    const geometry = {x: 0, y: 0, cellWidth: 100, cellHeight: 40};
    expect(hubConnectionRectangles(line, geometry)).toEqual([{x: -15, y: -15, width: 31, height: 71}]);
    expect(hubConnectionRectangles({...line, thick: false}, geometry)).toEqual([{x: -5, y: -5, width: 11, height: 51}]);
  });
  it("truncates signed endpoints separately with minimum one-pixel thickness", () => {
    expect(hubConnectionRectangles(baseLine({dx: 1, thick: false}), {x: -2.9, y: -1.1, cellWidth: 2, cellHeight: 2})).toEqual([
      {x: -2, y: -1, width: 2, height: 1},
    ]);
  });
  it("preserves both identical draw passes and screenshot-only unlit suppression", () => {
    const line = baseLine({dx: 1}); const geometry = {x: 10, y: 10, cellWidth: 40, cellHeight: 30};
    expect(hubConnectionRectangles(line, geometry, false, false)).toEqual(hubConnectionRectangles(line, geometry, false, true));
    expect(hubConnectionRectangles(line, geometry, true)).toEqual([]);
    expect(hubConnectionRectangles({...line, lit: true}, geometry, true)).toHaveLength(1);
  });
  it("uses native special endpoint offsets, including width for the reception y shift", () => {
    const geometry = {x: 100, y: 100, cellWidth: 50, cellHeight: 40};
    expect(hubConnectionRectangles(baseLine({dx: 3, dy: -2, shape: "VertFirstL", lastPortal: true}), geometry)).toEqual([
      {x: 93, y: 93, width: 15, height: 95}, {x: 93, y: 173, width: 136, height: 15},
    ]);
    expect(hubConnectionRectangles(baseLine({dx: 4, dy: -1, shape: "HorizFirstL", finishToReception: true}), geometry)).toEqual([
      {x: 271, y: 193, width: 187, height: 15}, {x: 443, y: 193, width: 15, height: 55},
    ]);
  });
  it("derives Intro active/inactive colors from its enclosing block HSV and scale", () => {
    const color = {h: .6, s: .8, v: 1};
    expect(hubConnectionLineColor(color, true, 492, 492, 600)).toBe(0x3c70be);
    expect(hubConnectionLineColor(color, false, 492, 492, 600)).toBe(0x0a1c34);
    expect(hubConnectionLineColor(color, true, 600, 600, 600)).toBe(0x3a6cb8);
  });
});
