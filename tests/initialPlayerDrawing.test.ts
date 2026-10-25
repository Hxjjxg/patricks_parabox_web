import { describe, expect, it } from 'vitest';
import { getLevelSource } from '../src/core/levelRepository';
import { parseLevel } from '../src/core/levelParser';

// Original LoadLevel.cs503–505 /547–549 /761–763 initializes this flag for
// Block, Wall and Ref records. No animation tick precedes a win-load draw.
describe('native fresh load player drawing state', () => {
  it.each(['first_puzzle', 'second_puzzle', 'third_puzzle', '1by1_playerr_flip2', 'possess_first'])(
    '%s draws every player as a player before the first update', name => {
      const world = parseLevel(getLevelSource(name), name);
      expect(world.playerBlocks.length).toBeGreaterThan(0);
      for (const block of world.blocks) expect(block.drawIsPlayer).toBe(block.isPlayer);
    },
  );
});
