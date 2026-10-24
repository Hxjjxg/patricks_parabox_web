import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/GameController';
import type { GameRenderer } from '../src/render/GameRenderer';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function controllerHarness() {
  let clock = 0;
  let nextFrame: FrameRequestCallback | null = null;
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  const storage = new Map<string, string>();
  const proto = GameController.prototype as unknown as {
    createDevPanel(): HTMLElement; createCustomLevelInput(): HTMLInputElement;
  };
  vi.spyOn(proto, 'createDevPanel').mockReturnValue({ querySelector: () => ({}) } as unknown as HTMLElement);
  vi.spyOn(proto, 'createCustomLevelInput').mockReturnValue({} as HTMLInputElement);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('window', {
    location: { search: '?level=first_puzzle' },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => listeners.set(type, listener),
    requestAnimationFrame: (callback: FrameRequestCallback) => { nextFrame = callback; return 1; },
    clearTimeout: vi.fn(), setTimeout: vi.fn(),
  });
  vi.stubGlobal('document', { visibilityState: 'visible', hasFocus: () => true });
  vi.stubGlobal('HTMLInputElement', class {});
  vi.stubGlobal('HTMLSelectElement', class {});
  const presented: Array<{ stamp: number; x: number; y: number; t: number; moving: boolean }> = [];
  let controller: GameController;
  const renderer = {
    canvas: { addEventListener: vi.fn() }, setWorld: vi.fn(), setInspection: vi.fn(), setUiState: vi.fn(),
    renderFrame: (stamp: number) => {
      const world = controller.getDebugApi().world();
      const p = world.findPlayerBlock();
      presented.push({ stamp, x: p.x, y: p.y, t: p.animT, moving: world.anyBlockMoving });
    },
  } as unknown as GameRenderer;
  controller = new GameController(renderer);
  controller.start();
  return {
    api: controller.getDebugApi(), presented,
    frame(stamp: number) { clock = stamp; if (!nextFrame) throw new Error('No scheduled controller frame'); nextFrame(stamp); },
    press(key: string, stamp: number) { clock = stamp; listeners.get('keydown')?.({ key, repeat: false, preventDefault() {} } as KeyboardEvent); },
    release(key: string, stamp: number) { clock = stamp; listeners.get('keyup')?.({ key, preventDefault() {} } as KeyboardEvent); },
  };
}

describe('controller update and presentation ordering', () => {
  it.each([8, 16.7, 25, 50, 100])('presents the current post-press phase with a %sms frame', (interval) => {
    const h = controllerHarness();
    h.frame(0);
    h.press('ArrowRight', interval - 1);
    h.release('ArrowRight', interval - 0.5);
    h.frame(interval);
    expect(h.presented).toHaveLength(2);
    expect(h.presented[1]).toMatchObject({ stamp: interval, x: 3, y: 2, moving: true });
    // Even a 100ms frame includes only 1ms that followed the actual press.
    expect(h.presented[1]!.t).toBeCloseTo(0.001, 10);
    expect(h.api.world().findPlayerBlock().drawXOffset).toBeCloseTo(-0.99, 10);
  });

  it('retains one queued turn and presents it only after the current slide lands', () => {
    const h = controllerHarness();
    h.frame(0);
    h.press('ArrowRight', 1); h.release('ArrowRight', 2);
    h.frame(50);
    h.press('ArrowUp', 51); h.release('ArrowUp', 52);
    h.press('ArrowLeft', 53); h.release('ArrowLeft', 54);
    h.frame(100);
    expect(h.api.getState().player).toMatchObject({ x: 3, y: 2 });
    h.frame(110);
    expect(h.api.getState().player).toMatchObject({ x: 3, y: 3 });
    expect(h.presented.at(-1)).toMatchObject({ x: 3, y: 3, t: 0, moving: true });
  });

  it('does not treat a just-applied queued move as idle between frames', () => {
    const h = controllerHarness();
    h.frame(0); h.press('ArrowRight', 1); h.release('ArrowRight', 2);
    h.frame(50); h.press('ArrowLeft', 51); h.release('ArrowLeft', 52);
    h.frame(100); h.frame(110);
    expect(h.api.getState().player).toMatchObject({ x: 2, y: 2 });
    h.press('ArrowUp', 111); h.release('ArrowUp', 112);
    expect(h.api.getState().player).toMatchObject({ x: 2, y: 2 });
    h.frame(120);
    expect(h.presented.at(-1)).toMatchObject({ x: 2, y: 2, moving: true });
  });
});
