import { describe, expect, it } from 'vitest';
import { AnimType, getBumpLength, getEnterLength, quickAnimCameraOffset, stopAllAnimations, updateAnimation, updateCameraAnimation, updateWorldAnimations } from '../src/core/animation';
import { DrawStyle } from '../src/core/model';
import { parseLevel } from '../src/core/levelParser';
import { getLevelSource } from '../src/core/levelRepository';
import { MovementEngine } from '../src/core/movement';
import { DirectionalInput } from '../src/core/directionalInput';
import quick from './fixtures/original-animation-styles/style-quick-right-motion-20261025.json';
import tui from './fixtures/original-animation-styles/style-tui-up-motion-20261025.json';

const context = { deltaTime: 0, quickAnim: true, anyBlockMoving: false, handleActionFloor: () => false, random: () => .5 };
const load = (id: string) => parseLevel(getLevelSource(id), id);

describe('original alternate style animation rules', () => {
  it('QUICK uses gradual default enter length regardless of preference', () => {
    const world = load(quick.level);
    world.enterSpeedIndex = 2;
    const engine = new MovementEngine(world);
    expect(getEnterLength(engine.history.settings)).toBe(.5);
    expect(getBumpLength(world, engine.history.settings)).toBe(.22);
  });

  it('TUI enter uses .1 and landing has zero length', () => {
    const world = load(tui.level);
    world.enterSpeedIndex = 3;
    const engine = new MovementEngine(world);
    expect(getEnterLength(engine.history.settings)).toBe(.1);
    expect(getBumpLength(world, engine.history.settings)).toBe(0);
    expect(engine.applyDirectionalInput(0, 1).moved).toBe(true);
    const player = world.findPlayerBlock();
    updateWorldAnimations(world, { ...context, quickAnim: false, deltaTime: .101 });
    expect(player.anim).toBe(AnimType.BumpHalt);
    expect(player.animLength).toBe(0);
    updateWorldAnimations(world, { ...context, quickAnim: false, deltaTime: .016 });
    expect(player.moving).toBe(false);
    expect([player.drawXOffset, player.drawYOffset, player.drawXScale, player.drawYScale]).toEqual([0, 0, 1, 1]);
  });

  it('every measured QUICK phase uses squish while AnyBlockMoving remains false', () => {
    const world = load(quick.level);
    const engine = new MovementEngine(world);
    expect(world.drawStyle).toBe(DrawStyle.QuickAnim);
    expect(engine.applyDirectionalInput(1, 0).moved).toBe(true);
    const player = world.findPlayerBlock();
    expect(player.anim).toBe(AnimType.SquishInPlace);
    expect(player.animLength).toBe(.6);
    for (const frame of quick.frames.slice(1)) {
      player.animT = frame.animT;
      updateAnimation(player, false, false, context);
      expect(player.drawXOffset).toBeCloseTo(frame.drawXOffset, 6);
      expect(player.drawYOffset).toBeCloseTo(frame.drawYOffset, 6);
      expect(player.drawXScale).toBeCloseTo(frame.drawXScale, 6);
      expect(player.drawYScale).toBeCloseTo(frame.drawYScale, 6);
    }
    updateWorldAnimations(world, { ...context, deltaTime: 0 });
    expect(world.anyBlockMoving).toBe(false);
  });

  it('measured QUICK camera decay uses gradual delta/3 and independent position decay', () => {
    const world = load(quick.level);
    // QuickAnimCamOff deliberately retains the existing camera animation clock.
    world.cameraAnimT = world.cameraAnimLength = .1;
    const engine = new MovementEngine(world);
    engine.applyDirectionalInput(1, 0);
    expect(world.newX).toBe(1);
    for (const frame of quick.frames.slice(1)) {
      updateCameraAnimation(world, frame.deltaMs / 1000);
      expect(world.newX).toBeCloseTo(frame.newX, 6);
      expect(world.newY).toBeCloseTo(frame.newY, 6);
      expect(world.newXS).toBeCloseTo(frame.newXS, 6);
      expect(world.newYS).toBeCloseTo(frame.newYS, 6);
      expect(world.newCamT).toBeCloseTo(frame.newCamT, 6);
      expect(world.cameraAnimT).toBeCloseTo(frame.cameraAnimT, 6);
    }
  });

  it('QUICK StopAnimations retains live squish, including unrelated blocks', () => {
    const world = load(quick.level);
    new MovementEngine(world).applyDirectionalInput(1, 0);
    const player = world.findPlayerBlock();
    stopAllAnimations(world);
    expect(player.moving).toBe(true);
    expect(player.anim).toBe(AnimType.SquishInPlace);
  });

  it('QUICK camera composes the last drawn context and mirrors only horizontal displacement', () => {
    const world = load(quick.level);
    world.findPlayerBlock().flipH = true;
    world.usedX = .25; world.usedY = -.5;
    world.usedXS = .5; world.usedYS = 2;
    world.cameraAnimT = .1; world.cameraAnimLength = .5;
    quickAnimCameraOffset(world, 1, -.25, 2, .5);
    expect([world.newX, world.newY, world.newXS, world.newYS]).toEqual([-.5, -.5, .25, 4]);
    expect([world.usedX, world.usedY, world.usedXS, world.usedYS]).toEqual([-.5, -.5, .25, 4]);
    expect([world.cameraAnimT, world.cameraAnimLength, world.newCamT]).toEqual([.1, .5, 0]);
    updateCameraAnimation(world, .1);
    expect(world.newX).toBeCloseTo(-.4175, 10);
    expect(world.newXS).toBeCloseTo(1 / 3.505, 10);
    expect(world.newYS).toBeCloseTo(1 / .37375, 10);
    expect(world.newCamT).toBeCloseTo(1 / 30, 10);
    // Unity Lerp clamps a long delta; no overshoot, arbitrary smoothing or epsilon.
    updateCameraAnimation(world, 1);
    expect([world.newX, world.newY, world.newXS, world.newYS]).toEqual([0, 0, 1, 1]);
  });

  it('QUICK camera offset respects the native fixed camera gate', () => {
    const world = load('static_focus_block');
    world.drawStyle = DrawStyle.QuickAnim;
    quickAnimCameraOffset(world, 1, 2, 3, 4);
    expect([world.newX, world.newY, world.newXS, world.newYS]).toEqual([0, 0, 1, 1]);
    expect(world.cameraMoving).toBe(false);
  });

  it('QUICK physical impulse repeat counter starts at minus .1 seconds', () => {
    const input = new DirectionalInput(70);
    input.press('ArrowRight', { dx: 1, dy: 0 });
    // Native Movement.Impulse sets moveDelayCounter=-.1, extending first repeat.
    input.resetRepeatDelay(true);
    expect(input.tick(.071)).toBeNull();
    expect(input.tick(.099)).toBeNull();
    expect(input.tick(.001)).toEqual({ dx: 1, dy: 0 });
  });

  it('normal repeat retains its existing delay and a changed direction emits immediately in QUICK', () => {
    const input = new DirectionalInput(70);
    input.press('ArrowRight', { dx: 1, dy: 0 });
    input.resetRepeatDelay();
    expect(input.tick(.071)).toEqual({ dx: 1, dy: 0 });
    input.resetRepeatDelay(true);
    expect(input.press('ArrowUp', { dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 1 });
    expect(input.tick(.071)).toEqual({ dx: 0, dy: 1 });
  });
});
