import { describe, expect, it } from 'vitest';
import { getLevelSource } from '../src/core/levelRepository';
import { parseLevel } from '../src/core/levelParser';
import { MovementEngine } from '../src/core/movement';
import { AnimType, updateAnimation, updateWorldAnimations } from '../src/core/animation';

interface NativeFrame {
  file: string; elapsedMs: number; deltaMs: number; anim: string;
  animT: number; animLength: number; drawXOffset: number; drawYOffset: number;
  drawXScale: number; drawYScale: number;
}
interface NativeCapture { requestId: string; level: string; frames: NativeFrame[] }
const captures = import.meta.glob<NativeCapture>('./fixtures/original-animation/*.json', { eager: true, import: 'default' });
const context = { deltaTime: 0, quickAnim: false, anyBlockMoving: true, handleActionFloor: () => false, random: () => 0.5 };

// Original observer PNGs and complete state/timing metadata are preserved under
// docs/parity/evidence/original/<requestId>/. These are measured native values,
// not values computed by the implementation under test. Align by animation
// kind and its actual time rather than comparing unrelated captured frames.
describe('original measured animation phases', () => {
  for (const capture of Object.values(captures)) {
    const direction = capture.level === 'first_puzzle' ? [1, 0] as const : [0, 1] as const;
    const samples = capture.frames.filter(frame =>
      (frame.anim === 'NORMAL' || frame.anim === 'BUMP_HALT') &&
      frame.animLength > 0 && frame.animT >= 0 && frame.animT <= frame.animLength);
    it(`${capture.requestId} contains both real slide and landing observations`, () => {
      expect(samples.some(frame => frame.anim === 'NORMAL' && frame.animT > 0)).toBe(true);
      expect(samples.some(frame => frame.anim === 'BUMP_HALT' && frame.animT > 0)).toBe(true);
    });
    for (const sample of samples) {
      it(`${capture.requestId} ${sample.file} ${sample.anim} t=${sample.animT}`, () => {
        const world = parseLevel(getLevelSource(capture.level), capture.level);
        const engine = new MovementEngine(world);
        const player = world.findPlayerBlock();
        expect(engine.applyDirectionalInput(direction[0], direction[1]).moved).toBe(true);
        if (sample.anim === 'BUMP_HALT') {
          updateWorldAnimations(world, { ...context, deltaTime: player.animLength + 0.001 });
          expect(player.anim).toBe(AnimType.BumpHalt);
        } else {
          expect(player.anim).toBe(AnimType.Normal);
        }
        expect(player.animLength).toBeCloseTo(sample.animLength, 6);
        player.animT = sample.animT;
        updateAnimation(player, false, false, context);
        // A 1e-6 bound allows native single precision serialization error; it
        // is much tighter than a physical pixel at these captured board sizes.
        expect(player.drawXOffset).toBeCloseTo(sample.drawXOffset, 6);
        expect(player.drawYOffset).toBeCloseTo(sample.drawYOffset, 6);
        expect(player.drawXScale).toBeCloseTo(sample.drawXScale, 6);
        expect(player.drawYScale).toBeCloseTo(sample.drawYScale, 6);
      });
    }
  }
});
