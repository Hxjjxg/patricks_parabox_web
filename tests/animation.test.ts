import { describe, expect, it } from "vitest";
import type { Block, Level } from "../src/core/model";
import {
  AnimType,
  computeProjection,
  computeProjectionParent,
  quadParabola,
  computeAnimLength,
  doBumpAnim,
  doNudgeAnim,
  doSquishInPlace,
  makePhantom,
  resetCameraOffset,
  setCameraOffset,
  smoothStepInOut,
  updateAnimation,
  updatePhantoms,
  updateWorldAnimations,
  type ProjectionMoveWithBlock,
} from "../src/core/animation";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";

function mockLevel(width: number, height: number): Level {
  return {
    width,
    height,
    camZoomFactor: 1,
    getExitBlock: () => ({ flipH: false, x: 0, y: 0 }),
  } as unknown as Level;
}

function move(
  block: Block,
  moveType: string,
  fromLevel: Level,
  toLevel: Level,
  options: Partial<ProjectionMoveWithBlock> = {},
): ProjectionMoveWithBlock {
  return {
    block,
    moveType,
    fromLevel,
    fromLevelBlock: { flipH: false, x: 1, y: 1 } as Block,
    fromX: 1,
    fromY: 1,
    toLevel,
    toLevelBlock: { flipH: false, x: 1, y: 1 } as Block,
    toX: 0,
    toY: 1,
    dx: 0,
    dy: 0,
    shed: false,
    infExitNum: -1,
    infEnterNum: -1,
    infEnterSourceBlock: null,
    ...options,
  };
}

describe("animation curves (Util port)", () => {
  it("smoothStepInOut goes 0 -> 1 -> 0", () => {
    expect(smoothStepInOut(0)).toBeCloseTo(0);
    expect(smoothStepInOut(0.5)).toBeCloseTo(1);
    expect(smoothStepInOut(1)).toBeCloseTo(0);
  });

  it("quadParabola rises and falls with a peak at the middle", () => {
    expect(quadParabola(0)).toBeCloseTo(0);
    expect(quadParabola(0.25)).toBeCloseTo(0.75);
    expect(quadParabola(0.5)).toBeCloseTo(1);
    expect(quadParabola(0.75)).toBeCloseTo(0.75);
  });
});

describe("projection (Projection.ComputeProjection port)", () => {
  const outer = mockLevel(3, 3);
  const inner = mockLevel(2, 2);
  const block = {} as Block;

  it("slides start one cell away with no scale change", () => {
    const result = computeProjection(
      [move(block, "slide", outer, outer, { dx: 1, toX: 2 })],
      block,
    );
    expect(result).toEqual({ xScale: 1, yScale: 1, xOffset: -1, yOffset: 0 });
  });

  it("entering a box scales up to the box's sub-level size", () => {
    const result = computeProjection(
      [move(block, "enter", outer, inner, { dx: -1, toX: 0, toY: 1 })],
      block,
    );
    expect(result.xScale).toBeCloseTo(2);
    expect(result.yScale).toBeCloseTo(2);
    expect(result.xOffset).toBeCloseTo(1.5);
    expect(result.yOffset).toBeCloseTo(0.5);
  });

  it("exiting a box scales down to one over the sub-level size", () => {
    const result = computeProjection(
      [move(block, "exit", inner, outer, { dx: 1, fromX: 1, fromY: 1 })],
      block,
    );
    expect(result.xScale).toBeCloseTo(0.5);
    expect(result.yScale).toBeCloseTo(0.5);
    expect(result.xOffset).toBeCloseTo(-0.75);
    expect(result.yOffset).toBeCloseTo(-0.25);
  });

  it("does not move the camera for a plain slide", () => {
    const result = computeProjectionParent(
      [move(block, "slide", outer, outer, { dx: 1 })],
      block,
    );
    expect(result).toEqual({ xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 });
  });
});

describe("movement drives block animation state", () => {
  const context = {
    quickAnim: false,
    handleActionFloor: () => false,
    random: () => 0.5,
  };

  it("starts a slide animation and eases it to the destination", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const engine = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const result = engine.applyDirectionalInput(1, 0);
    expect(result.moved).toBe(true);
    expect(player.moving).toBe(true);
    expect(player.anim).toBe(AnimType.Normal);
    expect(player.animLength).toBeCloseTo(0.1);
    expect(player.drawXOffset).toBeCloseTo(-1);
    expect(player.eyeXOffsetTo).toBeCloseTo(0.08);

    updateWorldAnimations(world, { ...context, deltaTime: 0.05 });
    expect(player.drawXOffset).toBeCloseTo(-0.5);
    expect(world.anyBlockMoving).toBe(true);

    updateWorldAnimations(world, { ...context, deltaTime: 0.1 });
    // The slide ends and the original chains a landing BUMP_HALT onto it.
    expect(player.anim).toBe(AnimType.BumpHalt);
    expect(player.moving).toBe(true);

    updateWorldAnimations(world, { ...context, deltaTime: 0.3 });
    expect(player.moving).toBe(false);
    expect(world.anyBlockMoving).toBe(false);
  });

  it("waits for a direction change after a blocked move", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const engine = new MovementEngine(world);
    let moved = true;
    for (let step = 0; step < 8 && moved; step++) {
      moved = engine.applyDirectionalInput(0, 1).moved;
    }
    expect(moved).toBe(false);
    expect(engine.waitingForDirectionChange).toBe(true);
    engine.clearWaitForMoveDirChange();
    expect(engine.waitingForDirectionChange).toBe(false);
  });

  it("bumps the player into a blocked direction", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const engine = new MovementEngine(world);
    const player = world.findPlayerBlock();
    for (let step = 0; step < 8; step++) {
      const result = engine.applyDirectionalInput(1, 0);
      if (result.moved) continue;
      expect(player.anim).toBe(AnimType.Bump);
      expect(player.moving).toBe(true);
      expect(player.drawXOffsetStart).toBe(1);
      expect(player.drawYOffsetStart).toBeCloseTo(0);
      expect(player.eyeXOffsetTo).toBeCloseTo(0.08);
      expect(player.faceAnimT).toBe(0);
      return;
    }
    throw new Error("expected the pushed box to eventually block the player");
  });
});

describe("camera offset (Draw.SetCameraOffset port)", () => {
  it("applies and resets the synced camera transform", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    resetCameraOffset(world);
    expect(world.newCamT).toBe(1);
    setCameraOffset(world, 0.25, -0.5, 0.5, 0.25, 0.5, false);
    expect(world.newCamT).toBe(0);
    expect(world.newX).toBeCloseTo(0.25);
    expect(world.newY).toBeCloseTo(-0.5);
    expect(world.newXS).toBeCloseTo(0.5);
    expect(world.newYS).toBeCloseTo(0.25);
    expect(world.cameraMoving).toBe(true);
    resetCameraOffset(world);
    expect(world.newXS).toBe(1);
    expect(world.newX).toBe(0);
    expect(world.cameraMoving).toBe(false);
  });
});

describe("animation length (Projection.ComputeAnimLength port)", () => {
  const block = {} as Block;
  const level = mockLevel(3, 3);

  it("uses the slide length when the chain only slides", () => {
    expect(
      computeAnimLength([move(block, "slide", level, level, { dx: 1 })], 0.5),
    ).toBeCloseTo(0.1);
  });

  it("uses the enter length whenever the chain enters or exits", () => {
    expect(
      computeAnimLength([move(block, "enter", level, level, { dx: 1 })], 0.5),
    ).toBeCloseTo(0.5);
    expect(
      computeAnimLength([move(block, "exit", level, level, { dx: 1 })], 0.33),
    ).toBeCloseTo(0.33);
  });
});

describe("animation starters (Block.Do*Anim ports)", () => {
  const context = { quickAnim: false };

  function playerBlock(): Block {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    return world.findPlayerBlock();
  }

  it("bump starts from a one-cell offset and lasts 0.22s", () => {
    const block = playerBlock();
    doBumpAnim(block, 1, 0, false, context);
    expect(block.moving).toBe(true);
    expect(block.anim).toBe(AnimType.Bump);
    expect(block.animLength).toBeCloseTo(0.22);
    expect(block.drawXOffsetStart).toBe(1);
    expect(block.drawYOffsetStart).toBeCloseTo(0);
    doBumpAnim(block, 0, -1, true, context);
    expect(block.anim).toBe(AnimType.BumpHalt);
    expect(block.drawYOffsetStart).toBe(1);
  });

  it("nudge keeps the block in place and only squishes", () => {
    const block = playerBlock();
    doNudgeAnim(block, true, 0.4);
    expect(block.anim).toBe(AnimType.Nudge);
    expect(block.drawNudgeHoriz).toBe(true);
    expect(block.animLength).toBeCloseTo(0.4);
    expect(block.drawXOffsetStart).toBe(0);
    expect(block.drawYOffsetStart).toBe(0);
  });

  it("undo squish is in place for 0.125s", () => {
    const block = playerBlock();
    doSquishInPlace(block, true, 0.125, context);
    expect(block.anim).toBe(AnimType.SquishInPlace);
    expect(block.animLength).toBeCloseTo(0.125);
    expect(block.moving).toBe(true);
    expect(block.drawXOffset).toBe(0);
    expect(block.drawYOffset).toBe(0);
    expect(block.drawXScale).toBeGreaterThan(1);
    expect(block.drawYScale).toBeLessThan(1);
  });

  it("chains a landing BUMP_HALT after a slide finishes", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const block = world.findPlayerBlock();
    block.moving = true;
    block.anim = AnimType.Normal;
    block.animLength = 0.1;
    block.animT = 0.11;
    block.drawXOffsetStart = -1;
    block.drawYOffsetStart = 0;
    updateAnimation(block, false, false, {
      deltaTime: 0,
      quickAnim: false,
      anyBlockMoving: true,
      handleActionFloor: () => false,
      random: () => 0.5,
    });
    expect(block.anim).toBe(AnimType.BumpHalt);
    expect(block.smallBumpHalt).toBe(false);
    expect(block.animLength).toBeCloseTo(0.22);

    // Enter/exit halts are smaller.
    block.moving = true;
    block.anim = AnimType.EnterExit;
    block.animLength = 0.5;
    block.animT = 0.51;
    block.drawXOffsetStart = 0;
    block.drawYOffsetStart = 1;
    updateAnimation(block, false, false, {
      deltaTime: 0,
      quickAnim: false,
      anyBlockMoving: true,
      handleActionFloor: () => false,
      random: () => 0.5,
    });
    expect(block.anim).toBe(AnimType.BumpHalt);
    expect(block.smallBumpHalt).toBe(true);
  });

  it("skips the landing bump on action floors", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const block = world.findPlayerBlock();
    block.moving = true;
    block.anim = AnimType.Normal;
    block.animLength = 0.1;
    block.animT = 0.11;
    updateAnimation(block, false, false, {
      deltaTime: 0,
      quickAnim: false,
      anyBlockMoving: true,
      handleActionFloor: () => true,
      random: () => 0.5,
    });
    expect(block.moving).toBe(false);
    expect(block.anim).not.toBe(AnimType.BumpHalt);
  });
});

describe("phantoms", () => {
  it("interpolates and retires after its length", () => {
    const world = parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
    const level = world.findPlayerBlock().outerLevel!;
    const phantom = makePhantom(
      world.findPlayerBlock(),
      level,
      2,
      2,
      0.2,
    );
    phantom.xFrom = 0;
    phantom.xTo = 1;
    phantom.xScaleFrom = 1;
    phantom.xScaleTo = 0;
    level.phantoms.push(phantom);

    updatePhantoms(world, 0.1);
    expect(phantom.x).toBeCloseTo(0.5);
    expect(phantom.xScale).toBeCloseTo(0.5);
    expect(level.phantoms).toContain(phantom);

    updatePhantoms(world, 0.11);
    expect(level.phantoms).not.toContain(phantom);
  });
});
