import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import hubSource from "../src/assets/levels/hub.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { Block, FloorType, WorldModel } from "../src/core/model";
import { ProgressionModel, puzzleMetadata } from "../src/core/progression";
import { hubPausedPortalReference, hubPortalCelebrationGeometry, hubShortcutCounts,
  hubShortcutFraction, hubShortcutFractionColor, hubShortcutWallGeometry, isHubShortcutWallPresent } from "../src/render/hubShortcutRendering";

const geometry = {centerX: 100, centerY: 80, width: 40, height: 40};
const counts = {numRequired: 9, numSolved: 4, numSolvedUncapped: 4};
const introWins = ["first_puzzle", "second_puzzle", "third_puzzle", "enter", "elbow_finish_idiom",
  "round_corners", "separate", "enter_two_sides", "lock_door"];

function grid(area = "Area_Intro") {
  const world = new WorldModel("hub"), level = world.createLevel(15, 15);
  level.hubAreaName = area;
  const root = new Block(-1); root.subLevel = level; root.color = {h: 0, s: 0, v: 1};
  level.blocksWithThisAsTheirSubLevel.push(root);
  const wall = world.createBlock(5, 2, level, null); wall.unlockerScene = "lock_door";
  const portal = (name: string, won = false) => {
    const floor = world.createFloor(level.floorList.length, 10, level, FloorType.LevelPortal);
    level.floorList.push(floor);
    floor.sceneName = name; floor.won = won; floor.unlocked = true;
    return floor;
  };
  return {world, level, wall, portal};
}

function intro(wonLevels: string[] = []) {
  const world = parseLevel(hubSource, "hub"), progression = new ProgressionModel({wonLevels});
  progression.applyToHub(world);
  const level = world.levels.find(candidate => candidate.hubAreaName === "Area_Intro")!;
  const wall = world.hubUnlockWalls.find(candidate => candidate.outerLevel === level && candidate.unlockerScene === "lock_door")!;
  return {world, level, wall};
}

describe("LoadLevel Hub shortcut count initialization", () => {
  it("matches the retained native third-only save and its actual 1-over-9 wall", () => {
    const native = JSON.parse(readFileSync(new URL("../docs/parity/evidence/original/hub-line-third-only-loaded-native-v2-20261025/hub-start-state.json", import.meta.url), "utf8")) as {
      wonLevels: string[]; portals: Array<{area: string; hard: number; won: boolean}>;
      walls: Array<{area: string; x: number; y: number; unlocker: string}>;
    };
    const {wall} = intro(native.wonLevels);
    const portals = native.portals.filter(floor => floor.area === "Area_Intro");
    expect(portals.filter(floor => floor.hard === 0)).toHaveLength(9);
    expect(portals.filter(floor => floor.won)).toHaveLength(1);
    expect(native.walls).toContainEqual({area: "Area_Intro", x: 5, y: 2, unlocker: "lock_door"});
    expect(hubShortcutCounts(wall)).toEqual({numRequired: 9, numSolved: 1, numSolvedUncapped: 1});
    expect(isHubShortcutWallPresent(wall)).toBe(true);
  });
  it("retains progress but suppresses the caption after all nine Intro wins remove its wall", () => {
    const {world, wall} = intro(introWins);
    expect(world.hubUnlockWalls).toContain(wall);
    expect(hubShortcutCounts(wall)).toEqual({numRequired: 9, numSolved: 9, numSolvedUncapped: 9});
    expect(isHubShortcutWallPresent(wall)).toBe(false);
    expect(hubShortcutFraction(wall, geometry, 600)).toBeNull();
  });
  it("counts hard wins in the numerator but canonical core metadata only in the denominator", () => {
    const {wall, portal} = grid();
    const core = portal("first_puzzle", true), hard = portal("puzzlescript", true);
    core.hard = 2; hard.hard = 0; // Neither mutable display field changes source metadata.
    expect(hubShortcutCounts(wall)).toEqual({numRequired: 1, numSolved: 1, numSolvedUncapped: 2});
  });
  it.each(["Area_Swap", "Area_Wall"])("subtracts exactly one denominator in %s", area => {
    const {wall, portal} = grid(area); portal("first_puzzle"); portal("second_puzzle", true);
    expect(hubShortcutCounts(wall)).toEqual({numRequired: 1, numSolved: 1, numSolvedUncapped: 1});
  });
  it("preserves the source upper cap without inventing a nonnegative denominator clamp", () => {
    const {wall} = grid("Area_Swap");
    expect(hubShortcutCounts(wall)).toEqual({numRequired: -1, numSolved: -1, numSolvedUncapped: 0});
  });
  it.each(["*clear", "*clear_or_unlock_all"])("does not invent counts for %s", unlocker => {
    const {wall, portal} = grid(); portal("first_puzzle", true); wall.unlockerScene = unlocker;
    expect(hubShortcutCounts(wall, {totalWon: 300})).toBeNull();
  });
  it("requires actual global won count for *all and retains its uncapped source numerator", () => {
    const {wall} = grid(); wall.unlockerScene = "*all";
    expect(hubShortcutCounts(wall)).toBeNull();
    expect(hubShortcutCounts(wall, {totalWon: 400, unlockAllPuzzles: true})).toEqual({
      numRequired: puzzleMetadata.size, numSolved: 400, numSolvedUncapped: 0,
    });
    expect(hubShortcutCounts(wall, {totalPuzzles: 368, totalWon: 12})).toEqual({numRequired: 368, numSolved: 12, numSolvedUncapped: 0});
  });
  it("skips ordinary count initialization when UnlockPuzzles bypasses its branch", () => {
    const {wall, portal} = grid(); portal("first_puzzle");
    expect(hubShortcutCounts(wall, {unlockAllPuzzles: true})).toBeNull();
  });
  it("ignores nonportals and rejects missing canonical metadata instead of treating it as core", () => {
    const {world, level, wall, portal} = grid();
    world.createFloor(0, 0, level, FloorType.Info);
    expect(hubShortcutCounts(wall)).toEqual({numRequired: 0, numSolved: 0, numSolvedUncapped: 0});
    portal("missing-test-puzzle");
    expect(() => hubShortcutCounts(wall)).toThrow("Missing Hub puzzle metadata missing-test-puzzle");
  });
  it("rejects nested blocks, unowned blocks and ordinary walls", () => {
    const {world, level, wall} = grid();
    expect(hubShortcutCounts(new Block(-2))).toBeNull();
    wall.unlockerScene = null; expect(hubShortcutCounts(wall)).toBeNull();
    const nested = world.createBlock(1, 1, level, world.createLevel(1, 1)); nested.unlockerScene = "lock_door";
    expect(hubShortcutCounts(nested)).toBeNull(); expect(isHubShortcutWallPresent(nested)).toBe(false);
  });
});

describe("DrawWall source fraction projection", () => {
  it("projects two native captions plus the independently truncated horizontal bar", () => {
    const {wall} = grid(); const result = hubShortcutFraction(wall, geometry, 600, {counts})!;
    expect(result.numerator).toMatchObject({text: "4", fontSize: 16, alignment: "MiddleCenter", rect: {x: 60, y: 29, width: 80, height: 80}});
    expect(result.denominator).toMatchObject({text: "9", fontSize: 16, rect: {x: 60, y: 50, width: 80, height: 80}});
    expect(result.bar.rect).toEqual({x: 87, y: 78, width: 25, height: 3});
    expect(result.numerator.glyphs).toHaveLength(1); expect(result.denominator.glyphs).toHaveLength(1);
    expect(result.numerator.guiColor).toEqual({r: .125, g: .125, b: .125, a: 1});
    expect(result.bar.guiColor).toEqual({r: .0625, g: .0625, b: .0625, a: 1});
  });
  it("does not resurrect a retained object when another block occupies the same cell", () => {
    const {world, level, wall} = grid(); world.removeBlock(wall); world.createBlock(5, 2, level, null);
    expect(isHubShortcutWallPresent(wall)).toBe(false);
    expect(hubShortcutFraction(wall, geometry, 600, {counts})).toBeNull();
  });
  it("only suppresses a zero denominator, matching DrawWall's literal gate", () => {
    const {wall} = grid();
    expect(hubShortcutFraction(wall, geometry, 600, {counts: {...counts, numRequired: 0}})).toBeNull();
    expect(hubShortcutFraction(wall, geometry, 600, {counts: {...counts, numRequired: -1}})?.denominator.text).toBe("-1");
  });
  it("projects counting subtraction without normalizing negative or excess supplied counts", () => {
    const {wall} = grid();
    const result = hubShortcutFraction(wall, geometry, 600, {counts, state: {counting: true, countingDelta: 7}})!;
    expect(result.numerator.text).toBe("-3");
    expect(hubShortcutFraction(wall, geometry, 600, {counts, state: {counting: false, countingDelta: 7}})?.numerator.text).toBe("4");
  });
  it("uses QuadIn and clamped float Lerp for the shared wall/label pop", () => {
    expect(hubShortcutWallGeometry(geometry, .5)).toEqual({...geometry, width: 45, height: 45});
    expect(hubShortcutWallGeometry(geometry, 1)).toEqual({...geometry, width: 60, height: 60});
    expect(hubShortcutWallGeometry(geometry, 2)).toEqual({...geometry, width: 60, height: 60});
    const {wall} = grid();
    expect(hubShortcutFraction(wall, geometry, 600, {counts, state: {countingScaleT: 1}})?.numerator.fontSize).toBe(25);
  });
  it("keeps the real Intro font request unsupported rather than scaling size16 or20 glyphs", () => {
    const {wall} = intro(["third_puzzle"]);
    const cell = Math.fround(492 / 11);
    const result = hubShortcutFraction(wall, {...geometry, width: cell, height: cell}, 600)!;
    expect(result.numerator.text).toBe("1"); expect(result.denominator.text).toBe("9");
    expect(result.numerator.fontSize).toBe(18); expect(result.numerator.glyphs).toBeNull();
    expect(result.denominator.glyphs).toBeNull();
  });
  it("truncates signed double endpoints independently", () => {
    const {wall} = grid();
    const result = hubShortcutFraction(wall, {...geometry, centerX: -.2, centerY: -.2}, 600, {counts})!;
    expect(result.numerator.rect).toEqual({x: -40, y: -50, width: 79, height: 79});
    expect(result.bar.rect).toEqual({x: -12, y: -1, width: 23, height: 1});
  });
  it("keeps unlock multipliers before byte conversion and retains source HDR output", () => {
    const color = {h: 0, s: 0, v: 1};
    expect(hubShortcutFractionColor(color, 600, 600, 600, {unlocking: true, unlockingT: 0})).toEqual({r: .1875, g: .1875, b: .1875, a: 1});
    expect(hubShortcutFractionColor(color, 600, 600, 600, {unlocking: true, unlockingT: 1.75})).toEqual({r: .75, g: .75, b: .75, a: 1});
    expect(hubShortcutFractionColor({...color, v: 10}, 600, 600, 600, {unlocking: true, unlockingT: 2})).toEqual({r: 3.75, g: 3.75, b: 3.75, a: 1});
  });
  it("preserves saturation and hue offset before the minimum-value inactive conversion", () => {
    expect(hubShortcutFractionColor({h: 0, s: 1, v: 1}, 600, 600, 600)).toEqual({r: .125, g: 0, b: 0, a: 1});
    expect(hubShortcutFractionColor({h: 0, s: 1, v: 1}, 600, 600, 600, {}, .5)).toEqual({r: 0, g: .125, b: .125, a: 1});
    const low = hubShortcutFractionColor({h: .6, s: .8, v: 0}, 492, 492, 600);
    expect(low).toEqual(hubShortcutFractionColor({h: .6, s: .8, v: .4}, 492, 492, 600));
    expect(low.b).toBeGreaterThan(low.g); expect(low.g).toBeGreaterThan(low.r);
  });
  it("does not mutate a model or caller-owned count/animation/geometry snapshots", () => {
    const {wall} = grid();
    const state = Object.freeze({counting: true, countingDelta: 2, countingScaleT: .5, unlocking: true, unlockingT: .75});
    const before = JSON.stringify(wall, (key, value) => ["outerLevel", "startOuterLevel"].includes(key) ? undefined : value);
    hubShortcutFraction(wall, Object.freeze({...geometry}), 600, {counts: Object.freeze({...counts}), state});
    expect(JSON.stringify(wall, (key, value) => ["outerLevel", "startOuterLevel"].includes(key) ? undefined : value)).toBe(before);
  });
});

describe("DrawPortal paused reference projection", () => {
  it("uses canonical reference text and full cell, then shadow and white foreground", () => {
    const {portal} = grid(), floor = portal("first_puzzle"); floor.hard = 2; floor.won = true;
    const result = hubPausedPortalReference(floor, {...geometry, height: 30}, {paused: true})!;
    expect(result.foreground).toMatchObject({text: "1", fontSize: 16, alignment: "MiddleCenter", rect: {x: 60, y: 50, width: 80, height: 60}, guiColor: {r: 1, g: 1, b: 1, a: 1}});
    expect(result.shadow.guiColor).toEqual({r: 0, g: 0, b: 0, a: 1});
    expect(result.shadow.rect.x).toBe(Math.fround(60 + Math.fround(40 * Math.fround(.06))));
    expect(result.shadow.rect.y).toBe(Math.fround(50 + Math.fround(30 * Math.fround(.06))));
    expect(result.foreground.glyphs).toHaveLength(1);
  });
  it.each([{paused: false}, {paused: true, inBreakMenu: true}])("respects the native menu gates %j", options => {
    const {portal} = grid(); expect(hubPausedPortalReference(portal("first_puzzle"), geometry, options)).toBeNull();
  });
  it("requires an unlocked LevelPortal and both expanded dimensions strictly greater than10", () => {
    const {world, level, portal} = grid(), floor = portal("first_puzzle");
    floor.unlocked = false; expect(hubPausedPortalReference(floor, geometry, {paused: true})).toBeNull();
    floor.unlocked = true;
    expect(hubPausedPortalReference(floor, {...geometry, width: 10}, {paused: true})).toBeNull();
    expect(hubPausedPortalReference(floor, {...geometry, height: 10}, {paused: true})).toBeNull();
    expect(hubPausedPortalReference(world.createFloor(0, 0, level, FloorType.Info), geometry, {paused: true})).toBeNull();
  });
  it("applies float celebration expansion before the size gate and font selection", () => {
    const {portal} = grid(), floor = portal("first_puzzle");
    expect(hubPortalCelebrationGeometry(geometry, .25)).toEqual({...geometry, width: 45, height: 45});
    expect(hubPortalCelebrationGeometry(geometry, .5)).toEqual(geometry);
    expect(hubPortalCelebrationGeometry(geometry, -.25)).toEqual(geometry);
    const expanded = hubPausedPortalReference(floor, {...geometry, width: 10, height: 10}, {paused: true, celebrationSizeT: .25});
    expect(expanded?.geometry.width).toBe(11.25);
    expect(expanded?.foreground.fontSize).toBe(6); expect(expanded?.foreground.glyphs).toBeNull();
  });
  it("preserves unsupported Intro reference size24 and does not shrink it for hard thumbnails", () => {
    const {portal} = grid(), floor = portal("third_puzzle"); floor.hard = 1;
    const cell = Math.fround(492 / 11);
    const result = hubPausedPortalReference(floor, {...geometry, width: cell, height: cell}, {paused: true})!;
    expect(result.foreground.fontSize).toBe(24);
    expect(result.foreground.text).toBe("3"); expect(result.foreground.glyphs).toBeNull();
    expect(result.shadow.glyphs).toBeNull();
  });
});
