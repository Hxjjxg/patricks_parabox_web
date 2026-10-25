import {describe, expect, it} from "vitest";
import hubSource from "../src/assets/levels/hub.txt?raw";
import {parseLevel} from "../src/core/levelParser";
import {Block, FloorType, WorldModel} from "../src/core/model";
import {ProgressionModel, puzzleMetadata} from "../src/core/progression";

// Recovered LoadLevel.DoHubModifications source contracts, not native/UI traces.
const freshHub = () => parseLevel(hubSource, "hub");
function area(world: WorldModel, name: string) {
  const level = world.levels.find(level => level.hubAreaName === name);
  if (!level) throw new Error("Missing bundled Hub area " + name);
  return level;
}
function portals(world: WorldModel, name: string) {
  return area(world, name).floorList.filter(floor => floor.type === FloorType.LevelPortal);
}
function ordinaryWalls(world: WorldModel, name: string) {
  return world.blocks.filter(block => !block.subLevel && block.unlockerScene !== null
    && !block.unlockerScene.startsWith("*") && block.outerLevel?.hubAreaName === name);
}
function coreNames(world: WorldModel, name: string) {
  return portals(world, name).filter(floor => puzzleMetadata.get(floor.sceneName)!.hard === 0).map(floor => floor.sceneName);
}
function load(progress: ProgressionModel) {
  const world = freshHub(); progress.applyToHub(world); return world;
}
function state(wall: Block) {
  expect(wall.hubCaptionState, "loader initializes the real wall caption state").not.toBeNull();
  return wall.hubCaptionState!;
}
function present(world: WorldModel, wall: Block) {
  return world.blocks.includes(wall) && wall.outerLevel?.getBlock(wall.x, wall.y) === wall;
}
function win(progress: ProgressionModel, names: readonly string[]) {
  for (const name of names) expect(progress.markWon(name)).toBe(true);
}

describe("source-based Hub caption load integration; no native image approval", () => {
  it("initializes ordinary closed-wall counts before evaluating removal", () => {
    const world = freshHub(), walls = ordinaryWalls(world, "Area_Enter"), names = coreNames(world, "Area_Enter");
    expect(walls.length).toBeGreaterThan(0); expect(names.length).toBeGreaterThan(2);
    new ProgressionModel().applyToHub(world);
    for (const wall of walls) {
      expect(present(world, wall)).toBe(true); expect(wall.hubShortcutOpen).toBe(false);
      expect(state(wall)).toMatchObject({numRequired: names.length, numSolved: 0, numSolvedUncapped: 0,
        counting: false, countingT: -2.5, countingTotalDelta: 0, countingDelta: 0, countingScaleT: 0,
        unlocking: false, unlockingT: 0, unlockingLength: 1.75, unlockingSuppressSound: false});
    }
  });

  it("suppresses opening and celebration on the first Hub load and records their histories", () => {
    const template = freshHub(), names = portals(template, "Area_Enter").map(floor => floor.sceneName);
    const progress = new ProgressionModel({wonLevels: names});
    const first = freshHub(), walls = ordinaryWalls(first, "Area_Enter"); progress.applyToHub(first);
    for (const wall of walls) {
      expect(present(first, wall)).toBe(false); expect(wall.hubShortcutOpen).toBe(true);
      expect(state(wall).unlocking).toBe(false);
    }
    expect(first.hubUnlocking).toBe(false); expect(first.hubCelebration.active).toBe(false);
    expect(first.hubCelebrationLevel).toBeNull(); expect(first.hubCelebrationNumLevels).toBe(0);
    const second = load(progress);
    expect(ordinaryWalls(second, "Area_Enter")).toHaveLength(0);
    expect(second.hubUnlocking).toBe(false); expect(second.hubCelebration.active).toBe(false);
  });

  it("retains a newly open ordinary wall with an open route on a later Hub load", () => {
    const progress = new ProgressionModel(), initial = load(progress);
    const names = coreNames(initial, "Area_Enter"); progress.setRecentArea("Area_Enter"); win(progress, names);
    const world = freshHub(), walls = ordinaryWalls(world, "Area_Enter"); progress.applyToHub(world);
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) {
      expect(present(world, wall)).toBe(true); expect(wall.hubShortcutOpen).toBe(true);
      expect(state(wall)).toMatchObject({unlocking: true, unlockingT: 0, counting: true, countingT: -2.5,
        countingTotalDelta: names.length, countingDelta: names.length});
    }
    expect(world.hubUnlocking).toBe(true); expect(world.hubCounting).toBe(true);
    const immediate = load(new ProgressionModel({wonLevels: names}));
    expect(world.floors.filter(f => f.type === FloorType.LevelPortal).map(f => [f.sceneName, f.unlocked]))
      .toEqual(immediate.floors.filter(f => f.type === FloorType.LevelPortal).map(f => [f.sceneName, f.unlocked]));
    const repeated = load(progress);
    expect(ordinaryWalls(repeated, "Area_Enter")).toHaveLength(0);
    expect(repeated.hubUnlocking).toBe(false); expect(repeated.hubCounting).toBe(false);
  });

  it("clears ordinary area opening history when that area becomes closed", () => {
    const progress = new ProgressionModel(), initial = load(progress), names = coreNames(initial, "Area_Enter");
    win(progress, names); load(progress); load(progress);
    const restored = names.at(-1)!; progress.wonLevels.delete(restored);
    const closed = load(progress);
    expect(ordinaryWalls(closed, "Area_Enter").every(wall => !state(wall).unlocking)).toBe(true);
    expect(progress.markWon(restored)).toBe(true);
    const reopened = load(progress), walls = ordinaryWalls(reopened, "Area_Enter");
    expect(walls.length).toBeGreaterThan(0); expect(walls.every(wall => state(wall).unlocking)).toBe(true);
  });

  it("retains all newly opening Center walls but only the first reverse-order sound", () => {
    const progress = new ProgressionModel(), initial = load(progress); win(progress, coreNames(initial, "Area_Center"));
    const world = freshHub(), reverseWalls = ordinaryWalls(world, "Area_Center").reverse();
    expect(reverseWalls.length).toBeGreaterThan(1); progress.applyToHub(world);
    for (const [index, wall] of reverseWalls.entries()) {
      expect(present(world, wall)).toBe(true); expect(wall.hubShortcutOpen).toBe(true);
      expect(state(wall)).toMatchObject({unlocking: true, unlockingSuppressSound: index > 0});
    }
  });

  it("counts newly won canonical puzzles once in the retained recent-area wall", () => {
    const progress = new ProgressionModel(), initial = load(progress), names = coreNames(initial, "Area_Enter");
    expect(names.length).toBeGreaterThan(2); progress.setRecentArea("Area_Enter");
    win(progress, names.slice(0, 2)); expect(progress.markWon(names[0]!)).toBe(false);
    expect(progress.markWon("first_puzzle")).toBe(true);
    const world = load(progress), walls = ordinaryWalls(world, "Area_Enter");
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) expect(state(wall)).toMatchObject({numSolved: 2, numSolvedUncapped: 2,
      counting: true, countingTotalDelta: 3, countingDelta: 3});
    expect(world.hubCounting).toBe(true);
    const repeated = load(progress);
    expect(ordinaryWalls(repeated, "Area_Enter").every(wall => !state(wall).counting)).toBe(true);
  });

  it("subtracts wins beyond the capped Swap numerator from the count delta", () => {
    const template = freshHub(), names = portals(template, "Area_Swap").map(floor => floor.sceneName);
    const required = coreNames(template, "Area_Swap").length - 1;
    expect(required).toBeGreaterThan(0); expect(names.length).toBeGreaterThan(required);
    const progress = new ProgressionModel({wonLevels: names.slice(0, required - 1), recentArea: "Area_Swap"});
    load(progress); win(progress, names.slice(required - 1));
    const world = load(progress), walls = ordinaryWalls(world, "Area_Swap");
    expect(walls.length).toBeGreaterThan(0);
    for (const wall of walls) expect(state(wall)).toMatchObject({numRequired: required, numSolved: required,
      numSolvedUncapped: names.length, unlocking: true, counting: true, countingTotalDelta: 1, countingDelta: 1});
    expect(world.hubCounting).toBe(true);
  });

  it("celebrates every-portal completion rather than the ordinary shortcut threshold", () => {
    const template = freshHub(), core = coreNames(template, "Area_Enter");
    const all = portals(template, "Area_Enter").map(floor => floor.sceneName), remaining = all.filter(name => !core.includes(name));
    expect(remaining.length).toBeGreaterThan(0);
    const progress = new ProgressionModel({wonLevels: core}); load(progress);
    const threshold = load(progress);
    expect(area(threshold, "Area_Enter").hubShortcutWon).toBe(false); expect(threshold.hubCelebration.active).toBe(false);
    win(progress, remaining); const completed = load(progress), completedArea = area(completed, "Area_Enter");
    expect(completedArea.hubShortcutWon).toBe(true); expect(completed.hubCelebrationLevel).toBe(completedArea);
    expect(completed.hubCelebration).toEqual({active: true, t: -1.25, playedStartSound: false, levelAttached: true});
    expect(completed.hubCelebrationNumLevels).toBe(all.length);
    for (const floor of portals(completed, "Area_Enter")) expect(floor.hubCelebration).toEqual({
      celebrationIndex: Number(puzzleMetadata.get(floor.sceneName)!.referenceName) - 1, celebrationPopped: false, celebrationSizeT: 0});
    const repeated = load(progress); expect(repeated.hubCelebration.active).toBe(false); expect(repeated.hubCelebrationLevel).toBeNull();
  });

  it("resets first-Hub animation history on the title/session reset without serializing it", () => {
    const progress = new ProgressionModel(), initial = load(progress);
    const names = portals(initial, "Area_Enter").map(floor => floor.sceneName); win(progress, names); load(progress);
    const saved = progress.serialize();
    const reset = (progress as ProgressionModel & {resetHubAnimations?: () => void}).resetHubAnimations;
    expect(reset).toBeTypeOf("function"); reset!.call(progress);
    expect(progress.serialize()).toEqual(saved);
    const returned = load(progress);
    expect(ordinaryWalls(returned, "Area_Enter")).toHaveLength(0); expect(returned.hubUnlocking).toBe(false);
    expect(returned.hubCelebration.active).toBe(false); expect(returned.hubCelebrationLevel).toBeNull();
    const restored = load(new ProgressionModel(saved));
    expect(restored.hubUnlocking).toBe(false); expect(restored.hubCelebration.active).toBe(false);
  });
});
