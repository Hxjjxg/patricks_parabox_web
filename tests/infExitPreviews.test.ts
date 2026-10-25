import { describe, expect, it, vi } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource, levelNames } from "../src/core/levelRepository";
import { Block, Floor, Level, type WorldModel } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import nativeFixtures from "./fixtures/original-inf-exit-previews.json";

function load(name = "1by1_playerr_flip2") {
  const world = parseLevel(getLevelSource(name), name);
  return new MovementEngine(world);
}

function command(engine: MovementEngine, action: string) {
  const directions: Record<string, [number, number]> = {
    LEFT: [-1, 0], DOWN: [0, -1], UP: [0, 1], RIGHT: [1, 0],
  };
  const direction = directions[action];
  if (!direction) throw new Error(`Unknown command ${action}`);
  return engine.applyDirectionalInput(...direction);
}

function previews(world: WorldModel) {
  return world.infExitPreviews?.map(({ dx, dy, exitBlocks }) => ({
    dx, dy, exitBlocks: exitBlocks.map(block => block.id),
  }));
}

function state(engine: MovementEngine) {
  const { world, history } = engine;
  return {
    levelName: world.levelName, moveCount: world.moveCount, winning: world.winning,
    buttonsSatisfied: world.buttonsSatisfied, finishesSatisfied: world.finishesSatisfied,
    wentToInfZone: world.wentToInfZone, pastCount: history.past.length,
    futureCount: history.future.length,
    blocks: world.blocks.map((block, index) => ({
      index, outer: block.outerLevel ? world.levels.indexOf(block.outerLevel) : -1,
      sub: block.subLevel ? world.levels.indexOf(block.subLevel) : -1,
      x: block.x, y: block.y, isPlayer: block.isPlayer, playerOrder: block.playerOrder,
      flipH: block.flipH, movedSinceRestart: block.movedSinceRestart,
    })),
  };
}

/** Include all model/transient fields, not only the gameplay conformance hash. */
function audit(engine: MovementEngine) {
  const normalize = (value: unknown): unknown => {
    if (value instanceof Block) return `block:${value.id}`;
    if (value instanceof Level) return `level:${value.id}`;
    if (value instanceof Floor) return `floor:${value.id}`;
    if (value === engine.world) return "world";
    if (value === engine.history) return "history";
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return record(value);
    return value;
  };
  const record = (object: object) => Object.fromEntries(
    Object.entries(object).filter(([key]) => key !== "infExitPreviews")
      .map(([key, value]) => [key, normalize(value)]),
  );
  return {
    world: record(engine.world), blocks: engine.world.blocks.map(record),
    levels: engine.world.levels.map(record), floors: engine.world.floors.map(record),
    history: record(engine.history), engine: record(engine),
  };
}

describe("native infinite-exit previews", () => {
  it("never allocates infinity zones while probing any bundled level at load", () => {
    for (const name of levelNames) {
      const world = parseLevel(getLevelSource(name), name);
      const exits = vi.spyOn(world, "createInfExitZone");
      const enters = vi.spyOn(world, "createInfEnterZone");
      const counts = [world.blocks.length, world.levels.length, world.floors.length];
      new MovementEngine(world);
      expect(exits, `${name}: infinite exit allocation`).not.toHaveBeenCalled();
      expect(enters, `${name}: infinite enter allocation`).not.toHaveBeenCalled();
      expect([world.blocks.length, world.levels.length, world.floors.length], name).toEqual(counts);
    }
  });

  it("detects the four observed RRD escape chains in native left/down/up/right order", () => {
    const engine = load();
    const fixture = nativeFixtures[0]!;
    command(engine, "RIGHT"); command(engine, "RIGHT");
    expect(previews(engine.world)).toEqual(fixture.beforePreviews);
    command(engine, "DOWN");
    expect(previews(engine.world)).toEqual(fixture.previews);
    for (const preview of engine.world.infExitPreviews) {
      expect(preview.exitBlocks[0]).toBe(engine.world.blocks[101]);
      expect(preview.exitBlocks[0]!.outerLevel).toBe(engine.world.levels[0]);
    }
  });

  it("refreshes after load, undo, redo, restart and undoing restart", () => {
    const engine = load();
    const expected = nativeFixtures[0]!.previews;
    expect(previews(engine.world)).toEqual([]);
    for (const action of ["RIGHT", "RIGHT", "DOWN"]) command(engine, action);
    expect(previews(engine.world)).toEqual(expected);
    expect(engine.undo()).toBe(true);
    expect(previews(engine.world)).toEqual([]);
    expect(engine.redo()).toBe(true);
    expect(previews(engine.world)).toEqual(expected);
    expect(engine.restart()).toBe(true);
    expect(previews(engine.world)).toEqual([]);
    expect(engine.undo()).toBe(true);
    expect(previews(engine.world)).toEqual(expected);
  });

  it.each([
    ["1by1_playerr_flip2", ["RIGHT", "RIGHT", "DOWN"]],
    ["infexit_ref_first", nativeFixtures[1]!.commands],
    ["clone_first_2", nativeFixtures[2]!.commands],
    ["shed_multi_simultaneous", ["RIGHT"]],
    ["first_puzzle", []],
  ] as const)("probes %s without mutating world, history, animation or attempt state", (name, commands) => {
    const engine = load(name);
    for (const action of commands) command(engine, action);
    // Preserve scratch fields too, including values that differ from committed state.
    const player = engine.world.findPlayerBlock();
    player.tempFlipH = !player.flipH; player.tempInnerPush = true;
    const currentTurn = engine.history.currentTurn;
    const before = audit(engine);
    engine.detectInfExitPreviews(player);
    expect(audit(engine)).toEqual(before);
    expect(engine.history.currentTurn).toBe(currentTurn);
  });

  it.each(nativeFixtures)("preserves native gameplay endpoint $source", (fixture) => {
    const engine = load(fixture.expected.levelName);
    for (const action of fixture.commands) command(engine, action);
    expect(state(engine)).toEqual(fixture.expected);
  });
});
