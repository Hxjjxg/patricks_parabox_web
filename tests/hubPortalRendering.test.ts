import { describe, expect, it } from 'vitest';
import { Block, Floor, FloorType, Level } from '../src/core/model';
import { GameRenderer } from '../src/render/GameRenderer';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

function drawPortal(won: boolean, unlocked: boolean, resolution = 1, hard = 0) {
  const level = new Level(0, 11, 11); const root = new Block(0);
  root.subLevel = level; root.color = { h: .6, s: .8, v: 1 }; level.blocksWithThisAsTheirSubLevel.push(root);
  const floor = new Floor(0, 4, 6, level, FloorType.LevelPortal);
  floor.sceneName = 'third_puzzle'; floor.won = won; floor.unlocked = unlocked;
  floor.hard = hard;
  const calls: Array<{ texture: string; color: number; rect: number[]; alpha: number }> = [];
  let alpha = .16; // preceding native backing-gradient fill in drawLevel
  const g = { roundRect: () => g, fill: () => g, stroke: () => g,
    setFillStyle: (style: {alpha: number}) => { alpha = style.alpha; return g; },
    texture: (texture: string, color: number, ...rect: number[]) => { calls.push({ texture, color, rect, alpha }); return g; } };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution } },
    textures: { portalThumbnails: { third_puzzle: 'actual-exported-preview' } },
  });
  receiver.drawFloor(g, FloorType.LevelPortal, { x: 100, y: 200, width: 45, height: 45 }, level, floor);
  return calls;
}

describe('native Hub portal thumbnail bodies', () => {
  it('retains all368 shipped PNG byte hashes without re-encoding', () => {
    const root = new URL('../src/assets/level-thumbnails/', import.meta.url);
    const files = readdirSync(root).filter(name => name.endsWith('.png')).sort();
    expect(files).toHaveLength(368);
    const records = files.map(name => name + ':' + createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex')).join(String.fromCharCode(10));
    expect(createHash('sha256').update(records).digest('hex')).toBe('9f0cd990824649715c688d9193a0b1d872e6b1cd627639b15e1d113c0dd28ad6');
  });
  it.each([1, 2])('draws source category%s underlay and80percent thumbnail', hard => {
    const calls = drawPortal(false, true, 1, hard);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.rect).toEqual([100, 200, 45, 45]);
    expect(calls[1]).toMatchObject({ texture: 'actual-exported-preview', color: 0xffffff, rect: [104, 204, 36, 36] });
  });
  it.each([[false, true], [true, false], [true, true]])('draws shipped full-cell preview with won=%s unlocked=%s', (won, unlocked) => {
    expect(drawPortal(won, unlocked)).toEqual([{ texture: 'actual-exported-preview', color: 0xffffff, rect: [100, 200, 45, 45], alpha: 1 }]);
  });
  it('uses the native opaque .16 RGB multiplier for a locked unsolved portal', () => {
    expect(drawPortal(false, false)).toEqual([{ texture: 'actual-exported-preview', color: 0x292929, rect: [100, 200, 45, 45], alpha: 1 }]);
  });
});
