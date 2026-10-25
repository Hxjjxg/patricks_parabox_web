import { describe, expect, it } from 'vitest';
import { parseLevel } from '../src/core/levelParser';
import { getLevelSource } from '../src/core/levelRepository';
import { ProgressionModel } from '../src/core/progression';
import { startHubArrival } from '../src/core/hubTransition';
import { updateAnimation, updateWorldAnimations } from '../src/core/animation';

function hubAt(puzzle: string) {
  const world = parseLevel(getLevelSource('hub'), 'hub');
  const progression = new ProgressionModel();
  progression.markAttempted(puzzle);
  progression.applyToHub(world);
  return world;
}
const advance = (world: ReturnType<typeof hubAt>, deltaTime: number) =>
  updateWorldAnimations(world, { deltaTime, quickAnim: false, handleActionFloor: () => false, random: () => .5 });

describe('native Hub.PositionPlayerOnHubStart arrival', () => {
  it('clears the native wait gate only on strict JumpOut completion', () => {
    const world = hubAt('third_puzzle'); startHubArrival(world, 'third_puzzle');
    const player = world.findPlayerBlock(); let cleared = 0;
    const context = { deltaTime: .5, quickAnim: false, anyBlockMoving: true,
      handleActionFloor: () => false, random: () => .5, onJumpOutComplete: () => cleared++ };
    updateAnimation(player, true, true, context); expect(cleared).toBe(0);
    updateAnimation(player, true, true, { ...context, deltaTime: .001 });
    expect(cleared).toBe(1);
    updateAnimation(player, true, true, context); expect(cleared).toBe(1);
  });
  it('matches measured third-win body quarter phases and strict landing boundary', () => {
    const world = hubAt('third_puzzle');
    const player = world.findPlayerBlock();
    expect(startHubArrival(world, 'third_puzzle')).toBe(true);
    expect(player).toMatchObject({ x: 4, y: 5, anim: 'jumpOut', animT: 0, animLength: .5,
      drawXOffset: 0, drawYOffset: -1, drawXScaleStart: 1, drawYScaleStart: 1 });
    for (let quarter = 0; quarter <= 4; quarter++) {
      if (quarter) advance(world, .125);
      const q = quarter / 4;
      expect(player.drawYOffset).toBeCloseTo(-(1 - q) - 4 * q * (1 - q), 7);
      expect(player.drawXScale).toBeCloseTo(.15 + .85 * q, 7);
      expect(player.drawYScale).toBeCloseTo(player.drawXScale, 7);
      expect(world.anyBlockMoving).toBe(true);
    }
    advance(world, .001);
    expect(player.anim).toBe('bumpHalt');
    expect(world.anyBlockMoving).toBe(false);
  });

  it.each([[0, -1], [0, 1], [-1, 0], [1, 0]])('uses actual placed portal delta (%s,%s) and outward eye target', (dx, dy) => {
    const world = hubAt('third_puzzle');
    const player = world.findPlayerBlock();
    const portal = world.floors.find(floor => floor.sceneName === 'third_puzzle')!;
    player.x = portal.x + dx; player.y = portal.y + dy;
    startHubArrival(world, 'third_puzzle');
    expect(player.drawXOffsetStart).toBe(-dx);
    expect(player.drawYOffsetStart).toBe(dy);
    expect(player.eyeXOffset).toBeCloseTo(dx * .08, 7);
    expect(player.eyeYOffset).toBeCloseTo(-dy * .08, 7);
  });

  it('keeps eyesJump body still and linearly returns the native face phantom', () => {
    const world = hubAt('1by1_order_line');
    const player = world.findPlayerBlock();
    expect(startHubArrival(world, '1by1_order_line')).toBe(true);
    expect(player).toMatchObject({ anim: 'still', animLength: .5, drawIsPlayer: false, moving: true });
    const phantom = player.outerLevel!.phantoms[0]!;
    expect(phantom).toMatchObject({ face: true, jumpOut: true, animT: 0, animLength: .5 });
    expect(phantom.xScale).toBe(Math.fround(.15));
    const initialY = phantom.y;
    advance(world, .25);
    expect(phantom.y).toBeCloseTo(initialY / 2, 7);
    expect(phantom.xScale).toBeCloseTo((Math.fround(.15) + 1) / 2, 7);
    expect(player.drawIsPlayer).toBe(false);
    advance(world, .25);
    expect(player.outerLevel!.phantoms).toHaveLength(0);
    expect(world.anyBlockMoving).toBe(true);
    advance(world, .001);
    expect(player.drawIsPlayer).toBe(true);
    expect(world.anyBlockMoving).toBe(false);
  });

  it.each([[0, .5], [1, 1 / 3], [2, .25], [3, .75]])('uses native enter speed index %s', (enterSpeedIndex, length) => {
    const world = hubAt('third_puzzle'); world.enterSpeedIndex = enterSpeedIndex;
    startHubArrival(world, 'third_puzzle');
    expect(world.findPlayerBlock().animLength).toBe(length);
  });

  it('does not synthesize arrival for a direct puzzle load or absent recent portal', () => {
    const puzzle = parseLevel(getLevelSource('third_puzzle'), 'third_puzzle');
    expect(startHubArrival(puzzle, 'third_puzzle')).toBe(false);
    const hub = hubAt('third_puzzle');
    expect(startHubArrival(hub, null)).toBe(false);
    expect(startHubArrival(hub, 'missing')).toBe(false);
    expect(hub.findPlayerBlock().moving).toBe(false);
  });
});
