import { describe, expect, it } from "vitest";
import { makePhantom, updateCameraAnimation, updateWorldAnimations } from "../src/core/animation";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { Block, Level } from "../src/core/model";
import { MovementEngine } from "../src/core/movement";
import { GameRenderer } from "../src/render/GameRenderer";
import { autotileIndex, wallTint } from "../src/render/wallRendering";

const context = {deltaTime: 1, quickAnim: false, handleActionFloor: () => false, random: () => .5};
const board = {x: 154, y: 54, width: 492, height: 492};

/** Source-only contract. Zone41 moves container59, never terminal child60.
 * The route supplies deterministic scene context; this terminal phantom is
 * deliberately synthetic. No retained accepted terminal-wall route is claimed. */
function sourceOnlyTerminalCopy() {
  const world = parseLevel(getLevelSource("infenter_zone_v2"), "infenter_zone_v2"), engine = new MovementEngine(world);
  const directions: Record<string, readonly [number, number]> = {D: [0, -1], U: [0, 1], L: [-1, 0], R: [1, 0]};
  const route = "URDLRRUULDRULLDDRURDLURRRRRUUUUULLLLLDDDD";
  for (const [index, command] of [...route].entries()) {
    engine.applyDirectionalInput(...directions[command]!);
    if (index === route.length - 1) continue;
    for (let i = 0; i < 2; i++) {updateWorldAnimations(world, context); updateCameraAnimation(world, 1);}
  }
  const entering = world.blocks.find(b => b.id === 59)!;
  expect(entering.subLevel?.id).toBe(11); expect(entering.subLevel?.filledWithWalls).toBe(true);
  const wall = entering.subLevel!.blockList[0]!;
  expect(wall.subLevel).toBeNull(); expect(wall.possessable).toBe(false);
  const outer = world.levels[0]!; outer.phantoms.splice(0);
  const phantom = makePhantom(wall, outer, 5, 1, .5);
  phantom.yTo = .5; phantom.xScaleTo = phantom.yScaleTo = 0; outer.phantoms.push(phantom);
  updateWorldAnimations(world, {...context, deltaTime: .175579}); updateCameraAnimation(world, .175579);
  return {world, wall};
}

describe("source-only terminal wall phantom; actual accepted route unverified", () => {
  it("submits parent-tinted wall with current logical autotile before nested backings and no unowned face", () => {
    const {world, wall} = sourceOnlyTerminalCopy(), root = world.rootBlock!, c = 492 / 9, p = .175579 / .5;
    const target = {x: 154 + c * (5 + p / 2), y: 54 + c * (7 + p), width: c * (1 - p), height: c * (1 - p)};
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
    const atTarget = (e: any) => e.block === wall && Math.abs(e.rect?.x - target.x) < 1e-8 && Math.abs(e.rect?.y - target.y) < 1e-8;
    const copies = events.filter(e => e.kind === "wall" && atTarget(e));
    expect(copies).toHaveLength(1);
    const copy = copies[0]!; expect(copy.level).toBe(wall.outerLevel); expect(copy.level.id).toBe(11);
    expect(copy.tile).toBe(autotileIndex(wall.outerLevel!, wall));
    expect(copy.g.kind).toBe("wall"); expect([...copy.g.tint]).toEqual([...wallTint(root, c / 600)]);
    expect(events.filter(e => e.kind === "face" && atTarget(e))).toHaveLength(0);
    expect(events.indexOf(copy)).toBeLessThan(events.findIndex(e => e.kind === "backing" && e.depth > 0));
    expect(wall.subLevel).toBeNull();
  });
});
