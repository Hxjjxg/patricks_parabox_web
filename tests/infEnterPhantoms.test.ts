import { describe, expect, it } from "vitest";
import { makePhantom, updateCameraAnimation, updateWorldAnimations } from "../src/core/animation";
import { createInfEnterPhantom, type InfEnterPhantomMove } from "../src/core/infEnterPhantoms";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { Block, DrawStyle, Level } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import { GameRenderer } from "../src/render/GameRenderer";
import { phantomGeometry, shouldDrawPhantom } from "../src/render/phantomRendering";
import { autotileIndex } from "../src/render/wallRendering";

const context = {deltaTime: 1, quickAnim: false, handleActionFloor: () => false, random: () => .5};
const board = {x: 154, y: 54, width: 492, height: 492};
const zone41 = "URDLRRUULDRULLDDRURDLURRRRRUUUUULLLLLDDDD";
function play(route: string) {
  const world = parseLevel(getLevelSource("infenter_zone_v2"), "infenter_zone_v2"), engine = new MovementEngine(world);
  const directions: Record<string, readonly [number, number]> = {D: [0, -1], U: [0, 1], L: [-1, 0], R: [1, 0]};
  for (const [index, command] of [...route].entries()) {
    engine.applyDirectionalInput(...directions[command]!);
    if (index === route.length - 1) continue;
    for (let i = 0; i < 2; i++) {updateWorldAnimations(world, context); updateCameraAnimation(world, 1);}
  }
  return {world, engine, outer: world.levels[0]!};
}

describe("native infinite-enter phantom constructor", () => {
  function fixture() {
    const block = new Block(59), outer = new Level(0, 9, 9);
    block.outerLevel = outer; block.x = 5; block.y = 1;
    const move = (infEaten = false, infEnterNum = 0, moveType = "enter"): InfEnterPhantomMove => ({block, infEaten, infEnterNum, moveType});
    return {block, outer, move};
  }
  it.each([
    [false, 2, -.5], [false, -2, .5], [true, 2, .5], [true, -2, -.5],
    [false, 0, -.5], [true, 0, .5], [false, -0, -.5],
  ])("matches native eaten=%s offset=%s half-cell endpoint=%s", (eaten, offset, expected) => {
    const {block, move} = fixture();
    const phantom = createInfEnterPhantom(block, [move(eaten as boolean)], 1, 0, {xOffset: offset as number, yOffset: 7}, .5)!;
    expect(phantom.xTo).toBe(expected); expect(phantom.yTo).toBe(0);
  });
  it("keeps a full-sized non-simple non-face copy initially then shrinks to zero", () => {
    const {block, outer, move} = fixture();
    const phantom = createInfEnterPhantom(block, [move(true)], 0, 1, {xOffset: 0, yOffset: 2}, .5)!;
    expect(phantom).toMatchObject({block, outerLevel: outer, xpos: 5, ypos: 1,
      x: 0, y: 0, xScale: 1, yScale: 1, xScaleTo: 0, yScaleTo: 0, yTo: .5,
      animT: 0, animLength: .5, face: false, exiting: false, exitedFrom: null});
    expect(outer.phantoms).toHaveLength(0); expect([block.x, block.y]).toEqual([5, 1]);
  });
  it.each([["enter", -1], ["slide", 0], ["exit", 0]])("requires strict Enter instead of %s/%s", (moveType, tier) => {
    const {block, move} = fixture();
    expect(createInfEnterPhantom(block, [move(false, tier as number, moveType as string)], 0, 1, {xOffset: 0, yOffset: 2}, .5)).toBeNull();
  });
  it("ignores other blocks but includes infEaten from any matching Enter", () => {
    const {block, move} = fixture(), other = new Block(60); other.outerLevel = block.outerLevel;
    expect(createInfEnterPhantom(other, [move(true)], 0, 1, {xOffset: 0, yOffset: 2}, .5)).toBeNull();
    const phantom = createInfEnterPhantom(block, [move(false), move(true, -1)], 0, 1, {xOffset: 0, yOffset: 2}, .5)!;
    expect(phantom.yTo).toBe(.5);
  });
  it("has no ordinary-exit reference-count gate and emits one result for repeated strict entries", () => {
    const {block, outer, move} = fixture(); expect(outer.blocksWithThisAsTheirSubLevel).toHaveLength(0);
    expect(createInfEnterPhantom(block, [move(), move()], 0, -1, {xOffset: 0, yOffset: -2}, .5)?.yTo).toBe(.5);
  });
});

describe("real accepted infinite Enter old-cell copies", () => {
  it.each([["DD", 55, 4, 1], ["DDD", 57, 4, 2], [zone41, 59, 5, 1]] as const)("retains the accepted %s block%s old cell", (route, id, x, y) => {
    const {world, engine, outer} = play(route), block = world.blocks.find(b => b.id === id)!;
    const turnMove = engine.history.past.at(-1)!.moves.find(m => m.block === block)!;
    expect([turnMove.fromLevel.id, turnMove.fromX, turnMove.fromY, turnMove.toLevel.id]).toEqual([0, x, y, 7]);
    expect(turnMove.animYOffset).toBe(id === 57 ? -2 : 2);
    expect([turnMove.animXScale, turnMove.animYScale, block.animLength]).toEqual([3, 3, .5]);
    const copies = outer.phantoms.filter(p => p.block === block && !p.exiting);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({block, xpos: x, ypos: y, yTo: .5, animLength: .5,
      xScaleTo: 0, yScaleTo: 0, face: false, exitedFrom: null, exiting: false});
  });
  it("does not misclassify final DDDU generated-zone movement as strict Enter", () => {
    const {world, engine} = play("DDDU"), player = world.findPlayerBlock();
    expect([world.moveCount, world.wentToInfZone, player.outerLevel!.id]).toEqual([4, true, 14]);
    expect(engine.history.past.at(-1)!.moves[0]!.animYOffset).toBeCloseTo(2 / 3, 7);
    expect(world.levels.flatMap(l => l.phantoms).filter(p => p.block === player && !p.exiting)).toHaveLength(0);
  });
  it("expires live copies and clears them for undo without recreating them on redo", () => {
    const {world, engine, outer} = play(zone41); expect(outer.phantoms).toHaveLength(1);
    expect(engine.undo()).toBe(true); expect(world.levels.flatMap(l => l.phantoms)).toHaveLength(0);
    expect(engine.redo()).toBe(true); expect(world.levels.flatMap(l => l.phantoms)).toHaveLength(0);
    const fresh = play(zone41); expect(fresh.outer.phantoms).toHaveLength(1);
    updateWorldAnimations(fresh.world, {...context, deltaTime: .5});
    expect(fresh.outer.phantoms).toHaveLength(0);
  });
});

describe("source phantom rendering discriminators", () => {
  function sourceContractCopy() {
    const state = play(zone41), entering = state.world.blocks.find(b => b.id === 59)!;
    expect(entering.subLevel?.id).toBe(11); expect(entering.subLevel?.filledWithWalls).toBe(true);
    const block = entering;
    expect(block.possessable).toBe(false);
    state.outer.phantoms.splice(0);
    // Exact native old-cell object for actual entering container59.
    const phantom = makePhantom(block, state.outer, 5, 1, .5);
    phantom.yTo = .5; phantom.xScaleTo = phantom.yScaleTo = 0; state.outer.phantoms.push(phantom);
    updateWorldAnimations(state.world, {...context, deltaTime: .175579}); updateCameraAnimation(state.world, .175579);
    return {...state, entering, block, phantom};
  }
  it("matches retained native1603 geometry without global phase squash or added parent clip", () => {
    const {world, outer, phantom} = sourceContractCopy(), c = 492 / 9, p = .175579 / .5;
    const rect = phantomGeometry(phantom, {x: 154 + c * 5, y: 54 + c * 7, width: c, height: c},
      board, world.rootBlock!, false, p, null);
    expect(rect.rect.x).toBeCloseTo(154 + c * (5 + p / 2), 6);
    expect(rect.rect.y).toBeCloseTo(54 + c * (7 + p), 6);
    expect(rect.rect.width).toBeCloseTo(c * (1 - p), 6); expect(rect.rect.height).toBeCloseTo(c * (1 - p), 6);
    expect(rect.clip).toBeNull(); expect(outer.phantoms).toHaveLength(1);
    expect(shouldDrawPhantom(phantom, world.rootBlock!, DrawStyle.Normal)).toBe(true);
    expect(shouldDrawPhantom(phantom, world.rootBlock!, DrawStyle.QuickAnim)).toBe(false);
  });
  function recordScene(world: ReturnType<typeof play>["world"]) {
    const root = world.rootBlock!;
    const events: any[] = [];
    function graphics(kind: string, tint?: Float32Array) {
      const object: any = {kind, tint}; const g: any = new Proxy(object, {get: (o, key) => key in o ? o[key] : () => g}); return g;
    }
    const scene = graphics("scene");
    const r: any = Object.assign(Object.create(GameRenderer.prototype), {
      world, app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}}, scene,
      uiState: {preferences: {disableParticles: true}}, textures: {centerGradient: {}, walls: [], wallsFlip: []}, elapsed: 0,
      maskedScene: () => scene, nextSceneLayer: () => graphics("scene"), nextWallLayer: (tint: Float32Array) => graphics("wall", tint),
      drawFloor() {}, drawInfEffect() {}, drawFlipShine() {},
      drawWall(g: any, level: Level, block: Block, rect: typeof board) {events.push({kind: "wall", g, level, block, rect, tile: autotileIndex(level, block)});},
      drawFace(_g: unknown, block: Block, rect: typeof board) {events.push({kind: "face", block, rect});},
    });
    const native = r.drawLevel; r.drawLevel = (...args: any[]) => {events.push({kind: "backing", block: args[2], rect: args[3], depth: args[4]}); return native.apply(r, args);};
    r.drawScenePass(root, board, 0, false, null);
    return events;
  }
  it("already queues actual old container59 and renders its wall60 through existing recursion", () => {
    const {world, entering} = sourceContractCopy(), c = 492 / 9, p = .175579 / .5;
    const target = {x: 154 + c * (5 + p / 2), y: 54 + c * (7 + p), width: c * (1 - p), height: c * (1 - p)};
    const events = recordScene(world);
    const atTarget = (e: any) => Math.abs(e.rect?.x - target.x) < 1e-8 && Math.abs(e.rect?.y - target.y) < 1e-8;
    const copies = events.filter(e => e.kind === "backing" && e.block === entering && atTarget(e));
    expect(copies).toHaveLength(1);
    expect(events.some(e => e.kind === "wall" && e.block.id === 60 && atTarget(e))).toBe(true);
    expect(events.indexOf(copies[0])).toBeLessThan(events.findIndex(e => e.kind === "wall" && e.block.id === 60 && atTarget(e)));
  });
});
