import { describe, expect, it } from "vitest";
import { quadParabola, updateCameraAnimation, updateWorldAnimations } from "../src/core/animation";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { Block, DrawStyle, Level } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import { GameRenderer } from "../src/render/GameRenderer";
import { shouldDrawPhantom } from "../src/render/phantomRendering";
import { autotileIndex, wallTint } from "../src/render/wallRendering";

// Actual accepted core route from unchanged bundled source. Native runtime/UI
// and PNG evidence for this route remain unavailable; this is not Canvas approval.
const context = {deltaTime: 1, quickAnim: false, handleActionFloor: () => false, random: () => .5};
const board = {x: 154, y: 54, width: 492, height: 492};
function route() {
  const world = parseLevel(getLevelSource("infenter_poswall_setup"), "infenter_poswall_setup"), engine = new MovementEngine(world);
  const steps: Array<{moved: boolean; possessed: boolean; id: number; outer: number; x: number; y: number}> = [];
  for (const [index, command] of [..."LLLR"].entries()) {
    const result = engine.applyDirectionalInput(command === "L" ? -1 : 1, 0), player = world.findPlayerBlock();
    steps.push({moved: result.moved, possessed: result.possessed, id: player.id, outer: player.outerLevel!.id, x: player.x, y: player.y});
    if (index === 3) continue;
    for (let i = 0; i < 2; i++) {updateWorldAnimations(world, context); updateCameraAnimation(world, 1);}
  }
  const player = world.findPlayerBlock(), oldLevel = world.levels[1]!, canonical = world.blocks.find(b => b.id === 27)!, reference = world.blocks.find(b => b.id === 48)!;
  return {world, engine, player, oldLevel, canonical, reference, steps};
}

describe("bundled LLLR terminal phantom route; native image capture unavailable", () => {
  it("accepts all four moves and creates a real non-face terminal old-cell phantom", () => {
    const {world, engine, player, oldLevel, canonical, steps} = route();
    expect(steps).toEqual([
      {moved: true, possessed: false, id: 16, outer: 0, x: 3, y: 4},
      {moved: true, possessed: false, id: 16, outer: 0, x: 2, y: 4},
      {moved: true, possessed: false, id: 16, outer: 1, x: 4, y: 2},
      {moved: true, possessed: false, id: 16, outer: 0, x: 2, y: 1},
    ]);
    expect(world.moveCount).toBe(4); expect(player.subLevel).toBeNull(); expect(player.isPlayer).toBe(true);
    expect(oldLevel.phantoms).toHaveLength(1);
    expect(oldLevel.phantoms[0]).toMatchObject({block: player, outerLevel: oldLevel, xpos: 4, ypos: 2,
      face: false, exiting: true, exitedFrom: canonical, exitingDX: 1, exitingDY: 0, xTo: 1, animLength: .5});
    const move = engine.history.past.at(-1)!.moves[0]!;
    expect([move.fromLevel.id, move.fromX, move.fromY, move.toLevel.id, move.toX, move.toY]).toEqual([1, 4, 2, 0, 2, 1]);
    expect(move.animXScale).toBeCloseTo(.2, 7); expect(move.animXOffset).toBeCloseTo(-.6, 7);
  });
  it("suppresses the canonical occurrence but admits the existing noncanonical reference", () => {
    const {world, oldLevel, canonical, reference} = route(), phantom = oldLevel.phantoms[0]!;
    expect(reference.subLevel).toBe(oldLevel); expect([reference.x, reference.y]).toEqual([1, 4]);
    expect(oldLevel.getExitBlock()).toBe(canonical);
    expect(shouldDrawPhantom(phantom, canonical, world.drawStyle)).toBe(false);
    expect(shouldDrawPhantom(phantom, reference, world.drawStyle)).toBe(true);
    expect(shouldDrawPhantom(phantom, canonical, DrawStyle.Grid)).toBe(true);
    expect(shouldDrawPhantom(phantom, reference, DrawStyle.QuickAnim)).toBe(false);
  });
  it("submits the actual clipped terminal wall and eligible face through drawScenePass", () => {
    const {world, player, reference} = route(), time = .125, phase = .25;
    updateWorldAnimations(world, {...context, deltaTime: time}); updateCameraAnimation(world, time);
    const events: any[] = [];
    const receiver: any = Object.create(GameRenderer.prototype);
    function graphics(kind: string, tint?: Float32Array) {
      const object: any = {kind, tint, clip: receiver.activeSceneContainer?.clip ?? null};
      const g: any = new Proxy(object, {get: (o, key) => key in o ? o[key] : () => g}); return g;
    }
    const scene = {clip: null};
    Object.assign(receiver, {
      world, app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}}, scene,
      uiState: {preferences: {disableParticles: true}}, textures: {centerGradient: {}, walls: [], wallsFlip: []}, elapsed: 0,
      maskedScene: (clip: typeof board | null) => ({clip}),
      nextSceneLayer: () => graphics("scene"), nextWallLayer: (tint: Float32Array) => graphics("wall", tint),
      drawFloor() {}, drawInfEffect() {}, drawFlipShine() {},
      drawWall(g: any, level: Level, block: Block, rect: typeof board) {events.push({kind: "wall", g, level, block, rect, tile: autotileIndex(level, block)});},
      drawFace(g: any, block: Block, rect: typeof board, facePhantom = false, flipH = false) {events.push({kind: "face", g, block, rect, facePhantom, flipH});},
    });
    const native = receiver.drawLevel;
    receiver.drawLevel = (...args: any[]) => {events.push({kind: "backing", block: args[2], rect: args[3], depth: args[4]}); return native.apply(receiver, args);};
    receiver.drawScenePass(world.rootBlock!, board, 0, false, null);
    const parent = events.find(e => e.kind === "backing" && e.block === reference)!; expect(parent).toBeDefined();
    const c = parent.rect.width / 5, q = quadParabola(phase);
    const target = {x: parent.rect.x + c * (4 + phase - .05 * q), y: parent.rect.y + c * (2 + .1 * q),
      width: c * (1 + .1 * q), height: c * (1 - .2 * q)};
    const atTarget = (e: any) => e.block === player && ["x", "y", "width", "height"].every(key => Math.abs(e.rect?.[key] - target[key as keyof typeof target]) < 1e-8);
    const walls = events.filter(e => e.kind === "wall" && atTarget(e)); expect(walls).toHaveLength(1);
    const wall = walls[0]!;
    expect(wall.level).toBe(player.outerLevel); expect(wall.level.id).toBe(0);
    expect(wall.tile).toBe(autotileIndex(player.outerLevel!, player));
    expect(wall.g.kind).toBe("wall"); expect([...wall.g.tint]).toEqual([...wallTint(reference, c / 600)]);
    expect(wall.g.clip).toEqual(parent.rect);
    expect(wall.rect.x).toBeLessThan(parent.rect.x + parent.rect.width);
    expect(wall.rect.x + wall.rect.width).toBeGreaterThan(parent.rect.x + parent.rect.width);
    const faces = events.filter(e => e.kind === "face" && atTarget(e)); expect(faces).toHaveLength(1);
    expect(faces[0]!.facePhantom).toBe(false); expect(faces[0]!.flipH).toBe(false);
    expect(faces[0]!.g.clip).toEqual(parent.rect);
    expect(events.indexOf(wall)).toBeLessThan(events.indexOf(faces[0]));
  });
});
