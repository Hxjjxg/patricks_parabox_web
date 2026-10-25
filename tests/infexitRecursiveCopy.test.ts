import { describe, expect, it } from "vitest";
import { AnimType, makePhantom, quadParabola, updateCameraAnimation, updateWorldAnimations } from "../src/core/animation";
import { createExitPhantom, type ExitPhantomMove } from "../src/core/exitPhantoms";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { Block, DrawStyle, Level, type WorldModel } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import { GameRenderer } from "../src/render/GameRenderer";
import { phantomGeometry, shouldDrawPhantom } from "../src/render/phantomRendering";

const context = {deltaTime: 1, quickAnim: false, handleActionFloor: () => false, random: () => .5};
const board = {x: 154, y: 54, width: 492, height: 492};
type Rect = typeof board;
function crossing() {
  const world = parseLevel(getLevelSource("infexit_ref_first"), "infexit_ref_first");
  const engine = new MovementEngine(world);
  const directions: Record<string, readonly [number, number]> = {D: [0, -1], L: [-1, 0], R: [1, 0]};
  for (const command of "DLLDRRRR") {
    engine.applyDirectionalInput(...directions[command]!);
    updateWorldAnimations(world, context); updateWorldAnimations(world, context);
  }
  expect(world.moveCount).toBe(8);
  const root = world.blocks.find(b => b.id === 24)!;
  expect([root.x, root.y]).toEqual([6, 1]);
  expect(engine.applyDirectionalInput(1, 0).moved).toBe(true);
  return {world, engine, root, outer: world.levels[0]!};
}

/** Exercise the real drawLevel queue path; Graphics only records no-op submissions. */
function childTickets(world: WorldModel, root: Block) {
  const g: any = new Proxy({}, {get: () => () => g});
  const texture = {source: {style: {addressMode: "clamp-to-edge"}}};
  const walls = new Proxy([], {get: () => texture});
  const r: any = Object.assign(Object.create(GameRenderer.prototype), {
    world, app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}},
    uiState: {preferences: {disableParticles: true}}, textures: {centerGradient: {}, walls, wallsFlip: walls},
    pendingTickets: [], effectTickets: [], portalMarkerTickets: [], elapsed: 0,
    currentTicket: {block: root, rect: board, depth: 0, parents: [], clip: null},
    nextSceneLayer: () => g, nextWallLayer: () => g, shadowTexture: () => texture, drawWall() {}, drawFloor() {},
  });
  r.drawLevel(g, root.subLevel!, root, board, 0, new Set(), false, board, []);
  return r.pendingTickets as Array<{block: Block; rect: Rect; clip: Rect | null; priority: number; parents: Block[]}>;
}

describe("native ordinary-exit phantom constructor", () => {
  function fixture() {
    const level = new Level(0, 7, 7), exit = new Block(24), alternate = new Block(23), block = new Block(9);
    exit.subLevel = alternate.subLevel = level;
    level.blocksWithThisAsTheirSubLevel.push(exit, alternate); level.infExitBlocks.push(alternate);
    block.outerLevel = level; block.x = 6; block.y = 1;
    const move = (moveType: string, dx = 1, dy = 0, infExitNum = -1): ExitPhantomMove => ({block, moveType, dx, dy, infExitNum});
    return {level, exit, alternate, block, move};
  }
  it("creates exactly one full-sized non-face old-cell copy for repeated exit steps", () => {
    const {block, level, exit, move} = fixture();
    const phantom = createExitPhantom(block, [move("slide"), move("exit"), move("exit")], 1, 0, .5)!;
    expect(phantom).toMatchObject({block, outerLevel: level, xpos: 6, ypos: 1, exitedFrom: exit,
      exiting: true, exitingDX: 1, exitingDY: 0, x: 0, y: 0, xTo: 1, yTo: 0,
      xScale: 1, yScale: 1, xScaleTo: 1, yScaleTo: 1, animT: 0, animLength: .5, face: false});
    expect(level.phantoms).toHaveLength(0); // The helper leaves registration to the caller.
    expect([block.x, block.y]).toEqual([6, 1]);
  });
  it("selects the last nonnegative infinity tier without falling back from null", () => {
    const {block, alternate, move} = fixture();
    expect(createExitPhantom(block, [move("exit", 1, 0, 0), move("exit")], 1, 0, .5)?.exitedFrom).toBe(alternate);
    expect(createExitPhantom(block, [move("exit", 1, 0, 3)], 1, 0, .5)?.exitedFrom).toBeNull();
  });
  it.each([[1, 0], [-1, 0], [0, 1], [0, -1]])("uses the first path direction for %s,%s", (dx, dy) => {
    const {block, move} = fixture();
    const phantom = createExitPhantom(block, [move("slide", dx!, dy!), move("exit", -dx!, -dy!)], dx!, dy!, .5)!;
    expect([phantom.xTo, phantom.yTo]).toEqual([dx || 0, -dy! || 0]);
  });
  it.each(["slide", "enter"])("does not create an exit copy for %s alone", moveType => {
    const {block, move} = fixture(); expect(createExitPhantom(block, [move(moveType)], 1, 0, .5)).toBeNull();
  });
  it("requires an enclosing representation and ignores other blocks' exits", () => {
    const {block, level, move} = fixture(), other = new Block(8); other.outerLevel = level;
    expect(createExitPhantom(other, [move("exit")], 1, 0, .5)).toBeNull();
    level.blocksWithThisAsTheirSubLevel.length = 0;
    expect(createExitPhantom(block, [move("exit")], 1, 0, .5)).toBeNull();
  });
});

describe("actual DLLDRRRR then Right retained recursive copy", () => {
  it("registers the source-required old-cell copy before moving root24", () => {
    const {world, root, outer} = crossing();
    expect([world.moveCount, root.x, root.y, root.anim, root.animLength]).toEqual([9, 2, 4, AnimType.EnterExit, .5]);
    expect(outer.phantoms).toHaveLength(1);
    expect(outer.phantoms[0]).toMatchObject({block: root, xpos: 6, ypos: 1, animLength: .5,
      exitedFrom: outer.getInfExitBlock(0), exiting: true, exitingDX: 1, xTo: 1, face: false});
  });
  it.each([.1381, .2547, .388])("queues visible retained geometry at actual body T=%s", time => {
    const {world, root} = crossing();
    updateWorldAnimations(world, {...context, deltaTime: time});
    updateCameraAnimation(world, time);
    const copies = childTickets(world, root).filter(t => t.block === root && t.priority === 2);
    expect(copies).toHaveLength(1);
    const copy = copies[0]!, cell = 492 / 7, phase = time / .5, shape = quadParabola(phase);
    expect(copy.rect.x).toBeCloseTo(154 + cell * (6 + phase - .05 * shape), 4);
    expect(copy.rect.y).toBeCloseTo(54 + cell * (5 + .1 * shape), 4);
    expect(copy.rect.width).toBeCloseTo(cell * (1 + .1 * shape), 4);
    expect(copy.rect.height).toBeCloseTo(cell * (1 - .2 * shape), 4);
    expect(copy.rect.x).toBeLessThan(646); expect(copy.rect.x + copy.rect.width).toBeGreaterThan(646);
    expect(copy.clip).toEqual(board); expect(copy.parents).toEqual([root]);
  });
  it("already projects a source-contract copy through the existing renderer without policy changes", () => {
    const {world, root, outer} = crossing();
    // Source-only discriminator: supply exactly the missing native constructor result.
    outer.phantoms.splice(0);
    const phantom = makePhantom(root, outer, 6, 1, .5);
    phantom.exitedFrom = outer.getInfExitBlock(0); phantom.exiting = true; phantom.exitingDX = 1; phantom.xTo = 1;
    outer.phantoms.push(phantom);
    updateWorldAnimations(world, {...context, deltaTime: .1381});
    expect(childTickets(world, root).some(t => t.block === root && t.priority === 2 && t.clip?.width === 492)).toBe(true);
    expect(shouldDrawPhantom(phantom, root, DrawStyle.Normal)).toBe(true);
    expect(shouldDrawPhantom(phantom, outer.getInfExitBlock(0)!, DrawStyle.Normal)).toBe(false);
    expect(shouldDrawPhantom(phantom, root, DrawStyle.QuickAnim)).toBe(false);
    const cell = {x: 154 + 492 * 6 / 7, y: 54 + 492 * 5 / 7, width: 492 / 7, height: 492 / 7};
    expect(phantomGeometry(phantom, cell, board, root, false, .2762, null).clip).toEqual(board);
  });
  it("expires the transient at duration and keeps undo/redo free of old-cell copies", () => {
    const {world, engine, outer} = crossing();
    expect(outer.phantoms).toHaveLength(1);
    updateWorldAnimations(world, {...context, deltaTime: .5}); expect(outer.phantoms).toHaveLength(0);
    expect(engine.undo()).toBe(true); expect(outer.phantoms).toHaveLength(0);
    expect(engine.redo()).toBe(true); expect(outer.phantoms).toHaveLength(0);
  });
  it("leaves adjacent possession's face copy singular", () => {
    const world = parseLevel(getLevelSource("possess_first"), "possess_first"), engine = new MovementEngine(world);
    for (const [dx, dy] of [[-1, 0], [0, -1], [0, -1], [-1, 0]]) {
      engine.applyDirectionalInput(dx!, dy!); updateWorldAnimations(world, context); updateWorldAnimations(world, context);
    }
    expect(engine.applyDirectionalInput(-1, 0).possessed).toBe(true);
    const phantoms = world.levels.flatMap(level => level.phantoms);
    expect(phantoms).toHaveLength(1); expect(phantoms[0]!.face).toBe(true);
  });
});

describe("adjacent movement phantom guards", () => {
  const exitLevel = `version 4
#
Block -1 -1 0 5 3 0 0 0.8 1 0 0 0 0 0 0 0
	Block 2 1 2 3 3 0.1 0.8 1 1 0 0 0 0 0 0 0
		Block 2 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
`;
  it("registers an ordinary exit copy and suppresses it only in its exited representation", () => {
    const world = parseLevel(exitLevel, "ordinary-exit"), engine = new MovementEngine(world);
    const player = world.findPlayerBlock(), oldLevel = player.outerLevel!;
    expect(engine.applyDirectionalInput(1, 0).moved).toBe(true);
    expect(player.outerLevel).not.toBe(oldLevel);
    expect(oldLevel.phantoms).toHaveLength(1);
    const phantom = oldLevel.phantoms[0]!;
    expect(phantom).toMatchObject({block: player, exitedFrom: oldLevel.getExitBlock(), xpos: 2, ypos: 1, xTo: 1, face: false});
    expect(shouldDrawPhantom(phantom, oldLevel.getExitBlock(), DrawStyle.Normal)).toBe(false);
    expect(shouldDrawPhantom(phantom, oldLevel.getExitBlock(), DrawStyle.Grid)).toBe(true);
  });
  it("leaves a blocked exit without committed phantoms", () => {
    const world = parseLevel(exitLevel + "\tWall 3 1 0 0 0\n", "blocked-exit"), engine = new MovementEngine(world);
    expect(engine.applyDirectionalInput(1, 0).moved).toBe(false);
    expect(world.levels.flatMap(l => l.phantoms)).toHaveLength(0);
  });
  it("does not create ordinary exit copies for a plain enter", () => {
    const source = `version 4
#
Block -1 -1 0 4 3 0 0 0.8 1 0 0 0 0 0 0 0
	Block 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
	Block 2 1 2 3 3 0.1 0.8 1 1 0 0 0 0 0 0 0
	Wall 3 1 0 0 0
`;
    const world = parseLevel(source, "ordinary-enter"), engine = new MovementEngine(world), before = world.findPlayerBlock().outerLevel;
    expect(engine.applyDirectionalInput(1, 0).moved).toBe(true);
    expect(world.findPlayerBlock().outerLevel).not.toBe(before);
    expect(world.levels.flatMap(l => l.phantoms)).toHaveLength(0);
  });
  it("clears the previous exiting copy on the next impulse instead of accumulating it", () => {
    const {world, engine, outer} = crossing();
    expect(outer.phantoms).toHaveLength(1);
    engine.applyDirectionalInput(0, 1);
    expect(world.levels.flatMap(l => l.phantoms)).toHaveLength(0);
  });
});
