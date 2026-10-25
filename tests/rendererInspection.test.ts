import { describe, expect, it } from 'vitest';
import { parseLevel } from '../src/core/levelParser';
import { getLevelSource } from '../src/core/levelRepository';
import { GameRenderer } from '../src/render/GameRenderer';
import { InspectionModel } from '../src/core/inspection';

function hitHarness(flipH = false) {
  const world = parseLevel(getLevelSource('enter'), 'enter');
  const renderer = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 },
      canvas: { getBoundingClientRect: () => ({ left: 20, top: 30, width: 400, height: 300 }) } },
    inspectionBoard: { viewBlock: world.rootBlock, flipH,
      rect: { x: 130, y: 30, width: 540, height: 540 } },
  }) as GameRenderer;
  // Cell(3,5) center in the actual canvas is(340,240), converted to client coordinates.
  return { world, renderer, x: 20 + (flipH ? 460 : 340) / 2, y: 30 + 240 / 2 };
}

describe('native inspection candidate hit testing', () => {
  it('queues the enclosing root during inspection instead of drawing the child alone', () => {
    const world = parseLevel(getLevelSource('enter'), 'enter');
    const child = world.blocks.find(b => b.id === 81)!;
    const inspection = new InspectionModel(world); inspection.push(child);
    const g: any = new Proxy({}, {get: () => () => g});
    const tickets: {id: number; depth: number; width: number}[] = [];
    const r = Object.assign(Object.create(GameRenderer.prototype), {
      world, app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}},
      scene: {}, maskPasses: [], sceneLayers: [], uiState: null, elapsed: 0,
      inspectionBlock: child, inspectionFlipH: false,
      nextSceneLayer: () => g, drawVoid() {}, drawControls() {}, drawModeOverlay() {},
      winText: {position: {set() {}}},
      drawScenePass(block: {id: number}, rect: {width: number}, depth: number) {
        tickets.push({id: block.id, width: rect.width, depth});
      },
    });
    r.draw();
    expect(tickets.map(t => ({id: t.id, depth: t.depth}))).toEqual([{id: 0, depth: -1}]);
    // Draw.focusFractNormal=.82f, so the enclosing board starts at492px.
    expect(tickets[0]!.width).toBeCloseTo(492, 4);
  });
  it.each([false, true])('maps canvas offset/scale and flip=%s to eligible block81', flipH => {
    const h = hitHarness(flipH);
    const hit = h.renderer.inspectionHitAt(h.x, h.y);
    expect(hit.inside).toBe(true); expect(hit.block?.id).toBe(81);
  });
  it('rejects a moving candidate while keeping its cell inside the viewed board', () => {
    const h = hitHarness(); h.world.blocks.find(b => b.id === 81)!.moving = true;
    const hit = h.renderer.inspectionHitAt(h.x, h.y);
    expect(hit.inside).toBe(true); expect(hit.block?.id ?? null).toBeNull();
  });
  it('distinguishes an outside click from an ineligible inside cell', () => {
    const h = hitHarness();
    expect(h.renderer.inspectionHitAt(20, 30)).toEqual({inside: false, block: null});
    expect(h.renderer.inspectionHitAt(20 + 160 / 2, 30 + 60 / 2)).toEqual({inside: true, block: null});
  });
});
