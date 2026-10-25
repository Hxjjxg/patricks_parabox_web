import { describe, expect, it } from 'vitest';
import captures from './fixtures/original-mechanic-phases.json';
import { getLevelSource } from '../src/core/levelRepository';
import { parseLevel } from '../src/core/levelParser';
import { MovementEngine } from '../src/core/movement';
import { AnimType, stopAllAnimations, updateAnimation, updateCameraAnimation, updateWorldAnimations } from '../src/core/animation';

const vectors: Record<string, readonly [number, number]> = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, 1], DOWN: [0, -1] };
const normalize = (kind: string) => kind.toLowerCase().replaceAll('_', '');
const context = { deltaTime: 0, quickAnim: false, anyBlockMoving: true, handleActionFloor: () => false, random: () => .5 };

// Actual native capture.json samples, with source hashes and PNG filenames.
// Evaluating the measured native phase verifies procedural geometry; it does
// not replace delivered-control replay or actual Canvas/camera image review.
describe('original measured mechanic animation phases', () => {
  for (const capture of captures) {
    it(capture.requestId + ' has native observations', () => expect(capture.frames.length).toBeGreaterThan(0));
    for (const sample of capture.frames) {
      it(`${capture.requestId} ${sample.file} ${sample.anim} t=${sample.animT}`, () => {
        const world = parseLevel(getLevelSource(capture.level), capture.level);
        const engine = new MovementEngine(world);
        for (const direction of capture.setup) {
          const [dx, dy] = vectors[direction]!;
          engine.applyDirectionalInput(dx, dy);
          stopAllAnimations(world);
          updateCameraAnimation(world, 1);
          // Native Draw/production renderer rebases used context after settling.
          world.usedX = 0; world.usedY = 0; world.usedXS = 1; world.usedYS = 1;
        }
        const [dx, dy] = vectors[capture.direction]!;
        expect(engine.applyDirectionalInput(dx, dy).moved).toBe(true);
        const player = world.findPlayerBlock();
        if (sample.anim === 'BUMP_HALT') {
          updateWorldAnimations(world, { ...context, deltaTime: player.animLength + .001 });
          expect(player.anim).toBe(AnimType.BumpHalt);
        }
        expect(normalize(player.anim)).toBe(normalize(sample.anim));
        expect({ count: world.moveCount, outer: player.outerLevel?.id, x: player.x, y: player.y, flip: world.cameraFlipH })
          .toEqual({ count: sample.moveCount, outer: sample.outerLevel, x: sample.x, y: sample.y, flip: sample.cameraFlipH });
        expect(player.animLength).toBeCloseTo(sample.animLength, 6);
        player.animT = sample.animT;
        updateAnimation(player, false, false, context);
        expect(player.drawXOffset).toBeCloseTo(sample.drawXOffset, 6);
        expect(player.drawYOffset).toBeCloseTo(sample.drawYOffset, 6);
        expect(player.drawXScale).toBeCloseTo(sample.drawXScale, 6);
        expect(player.drawYScale).toBeCloseTo(sample.drawYScale, 6);
        expect(world.newX).toBeCloseTo(sample.newX, 6);
        expect(world.newY).toBeCloseTo(sample.newY, 6);
        expect(world.newXS).toBeCloseTo(sample.newXS, 6);
        expect(world.newYS).toBeCloseTo(sample.newYS, 6);
        expect(world.cameraAnimLength).toBeCloseTo(sample.cameraAnimLength, 6);
      });
    }
  }
});
