import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/GameController';
import type { GameRenderer, RendererUiState } from '../src/render/GameRenderer';
import { stopAllAnimations } from '../src/core/animation';
import nativeInputBoundaries from './fixtures/original-input-boundaries.json';
import nativeHistoryRepeats from './fixtures/original-history-repeat.json';

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
  const uiStates: RendererUiState[] = [];
  let controller: GameController;
  const renderer = {
    canvas: { addEventListener: vi.fn() }, setWorld: vi.fn(), setInspection: vi.fn(),
    setUiState: (state: RendererUiState) => uiStates.push(state),
    renderFrame: (stamp: number) => {
      const world = controller.getDebugApi().world();
      const p = world.findPlayerBlock();
      presented.push({ stamp, x: p.x, y: p.y, t: p.animT, moving: world.anyBlockMoving });
    },
  } as unknown as GameRenderer;
  controller = new GameController(renderer);
  controller.start();
  return {
    api: controller.getDebugApi(), presented, uiStates,
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
    h.frame(interval);
    h.release('ArrowRight', interval + .5);
    expect(h.presented).toHaveLength(2);
    expect(h.presented[1]).toMatchObject({ stamp: interval, x: 3, y: 2, moving: true });
    // Even a 100ms frame includes only 1ms that followed the actual press.
    expect(h.presented[1]!.t).toBeCloseTo(0.001, 10);
    expect(h.api.world().findPlayerBlock().drawXOffset).toBeCloseTo(-0.99, 10);
  });

  it('retains one queued turn and presents it only after the current slide lands', () => {
    const h = controllerHarness();
    h.frame(0);
    h.press('ArrowRight', 1); h.frame(16.7); h.release('ArrowRight', 17);
    h.frame(50);
    h.press('ArrowUp', 51); h.frame(66.7); h.release('ArrowUp', 67);
    h.press('ArrowLeft', 68); h.frame(83.4); h.release('ArrowLeft', 84);
    // Native first-queue-phase-r40-u40: count increments at acceptance,
    // update-after landing precedes the queued impulse by one update.
    expect(h.api.getState().moveCount).toBe(2);
    h.frame(100);
    expect(h.api.getState().player).toMatchObject({ x: 3, y: 2 });
    h.frame(110);
    expect(h.presented.at(-1)).toMatchObject({ x: 3, y: 2, moving: false });
    h.frame(126.7);
    expect(h.api.getState().player).toMatchObject({ x: 3, y: 3 });
    expect(h.api.getState().moveCount).toBe(2);
    expect(h.presented.at(-1)!.t).toBeCloseTo(0.0167, 10);
    expect(h.presented.at(-1)).toMatchObject({ x: 3, y: 3, moving: true });
  });

  it('does not treat a just-applied queued move as idle between frames', () => {
    const h = controllerHarness();
    h.frame(0); h.press('ArrowRight', 1); h.frame(16.7); h.release('ArrowRight', 17);
    h.frame(50); h.press('ArrowLeft', 51); h.frame(66.7); h.release('ArrowLeft', 67);
    h.frame(100); h.frame(110); h.frame(126.7);
    expect(h.api.getState().player).toMatchObject({ x: 2, y: 2 });
    h.press('ArrowUp', 127);
    expect(h.api.getState().player).toMatchObject({ x: 2, y: 2 });
    h.frame(136.7);
    h.release('ArrowUp', 137);
    expect(h.presented.at(-1)).toMatchObject({ x: 2, y: 2, moving: true });
  });
});

function setupBeforeFirstWin(h: ReturnType<typeof controllerHarness>) {
  // Original first-win-held-phase-{a,b}-20261025, settled setup at (1,4).
  for (const key of 'UURRRDDULLLLU') {
    const [dx, dy] = { U: [0, 1], D: [0, -1], L: [-1, 0], R: [1, 0] }[key]!;
    h.api.impulse(dx!, dy!);
    stopAllAnimations(h.api.world());
  }
  expect(h.api.getState()).toMatchObject({ moveCount: 13, winning: false, player: { x: 1, y: 4 } });
}

describe('native automatic level advance', () => {
  it('counts full landing updates and preserves held direction until the next level update', () => {
    const h = controllerHarness();
    h.frame(0); setupBeforeFirstWin(h);
    h.press('ArrowUp', 1);
    h.frame(50);
    expect(h.api.getState().winning).toBe(true);
    expect(window.setTimeout).not.toHaveBeenCalled();
    h.frame(102); // Native animation completion is strict > .1; WinCount=.052.
    expect(h.presented.at(-1)!.moving).toBe(false);
    for (let stamp = 152; stamp <= 1502; stamp += 50) h.frame(stamp);
    expect(h.api.getState().levelName).toBe('first_puzzle');
    h.frame(1552); // .052 + 29*.05 = 1.502
    expect(h.api.getState()).toMatchObject({ levelName: 'second_puzzle', moveCount: 0, player: { x: 4, y: 2 } });
    h.frame(1568.7);
    expect(h.api.getState()).toMatchObject({ levelName: 'second_puzzle', moveCount: 1, player: { x: 4, y: 3 } });
    expect(h.presented.at(-1)!.t).toBeCloseTo(.0167, 10);
    h.release('ArrowUp', 1569);
  });

  it('clears held input for an explicit debug level load', () => {
    const h = controllerHarness();
    h.frame(0); h.press('ArrowUp', 1);
    h.api.loadLevel('second_puzzle');
    h.frame(100); h.frame(200);
    expect(h.api.getState()).toMatchObject({ levelName: 'second_puzzle', moveCount: 0, player: { x: 4, y: 2 } });
  });
});

describe('native control tutorial state', () => {
  it('tracks empty saves and playing fade time, resetting the fade on level load', () => {
    const h = controllerHarness(); h.frame(0); h.frame(50);
    expect(h.uiStates.at(-1)!.controls).toEqual({
      emptySave: true, fromIntro: false, fadeT: .05, secondPuzzleWon: false,
    });
    h.api.loadLevel('third_puzzle');
    expect(h.uiStates.at(-1)!.controls!.fadeT).toBe(0);
    h.frame(100);
    expect(h.uiStates.at(-1)!.controls!.fadeT).toBeCloseTo(.05, 10);
  });
});

describe('native simultaneous keyboard sampling', () => {
  it.each([
    ['ArrowUp', 'ArrowRight', 3, 2],
    ['ArrowRight', 'ArrowUp', 3, 2],
    ['ArrowUp', 'ArrowDown', 2, 1],
    ['ArrowDown', 'ArrowUp', 2, 1],
  ])('samples %s + %s once in native Up/Down/Left/Right order', (first, second, x, y) => {
    const h = controllerHarness(); h.frame(0);
    h.press(first as string, 1); h.press(second as string, 2);
    h.frame(16.7);
    expect(h.api.getState()).toMatchObject({ moveCount: 1, player: { x, y } });
  });

  it('does not accept a physical tap absent from every Controls.Update sample', () => {
    const h = controllerHarness(); h.frame(0);
    h.press('ArrowRight', 1); h.release('ArrowRight', 2); h.frame(16.7);
    expect(h.api.getState()).toMatchObject({ moveCount: 0, player: { x: 2, y: 2 } });
  });
});

describe('native history with an accepted queued impulse', () => {
  function queueAfterRight(key: string) {
    const h = controllerHarness();
    h.frame(0); h.press('ArrowRight', 1); h.frame(16.7); h.release('ArrowRight', 17);
    h.frame(50); h.press(key, 51); h.frame(66.7); h.release(key, 67);
    expect(h.api.getState()).toMatchObject({ moveCount: 2, player: { x: 3, y: 2 } });
    return h;
  }

  it('flushes a successful queued turn before undo, so redo restores it', () => {
    const h = queueAfterRight('ArrowUp');
    expect(h.api.undo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 1, player: { x: 3, y: 2 } });
    expect(h.api.redo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 2, player: { x: 3, y: 3 } });
  });

  it('flushes before restart and restores that completed queued move when restart is undone', () => {
    const h = queueAfterRight('ArrowUp');
    expect(h.api.restart()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 0, player: { x: 2, y: 2 } });
    expect(h.api.undo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 2, player: { x: 3, y: 3 } });
  });

  it('rolls back a failed queued reservation before undoing the previous success', () => {
    const h = queueAfterRight('ArrowRight');
    expect(h.api.undo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 0, player: { x: 2, y: 2 } });
    expect(h.api.redo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 1, player: { x: 3, y: 2 } });
  });

  it('does not cancel a queued action when redo has no future', () => {
    const h = queueAfterRight('ArrowUp');
    expect(h.api.redo()).toBe(false);
    h.frame(110); h.frame(126.7);
    expect(h.api.getState()).toMatchObject({ moveCount: 2, player: { x: 3, y: 3 } });
  });

  it('keeps redo available until queued execution and cancels the reservation after successful redo', () => {
    const h = controllerHarness(); h.frame(0);
    for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1]]) {
      h.api.impulse(dx!, dy!); stopAllAnimations(h.api.world());
    }
    expect(h.api.undo()).toBe(true);
    h.press('ArrowLeft', 1); h.frame(16.7); h.release('ArrowLeft', 17); h.frame(50);
    h.press('ArrowRight', 51); h.frame(66.7); h.release('ArrowRight', 67);
    expect(h.api.getState().moveCount).toBe(3);
    expect(h.api.redo()).toBe(true);
    expect(h.api.getState()).toMatchObject({ moveCount: 3, player: { x: 1, y: 2 } });
    for (let t = 100; t <= 500; t += 50) h.frame(t);
    expect(h.api.getState()).toMatchObject({ moveCount: 3, player: { x: 1, y: 2 } });
  });
});

describe('original delivered control update conformance', () => {
  for (const capture of [...nativeInputBoundaries, ...nativeHistoryRepeats]) {
    it(capture.id, () => {
      const h = controllerHarness(); h.frame(0);
      for (const direction of capture.setup) {
        const vector = { RIGHT: [1, 0], LEFT: [-1, 0], UP: [0, 1], DOWN: [0, -1] }[direction]!;
        h.api.impulse(vector[0]!, vector[1]!); stopAllAnimations(h.api.world());
      }
      const bindings = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
        undo: 'z', redo: 'x', restart: 'r' } as const;
      let previous: Record<string, boolean> = {};
      let stamp = 0;
      for (const update of capture.updates) {
        // These are already-delivered native update values. Present the
        // controls for the full recorded update delta; browser press-phase
        // clamping is covered separately at8/16.7/25/50/100ms above.
        for (const [control, key] of Object.entries(bindings)) {
          if (previous[control] && !update.controls[control as keyof typeof bindings]) h.release(key, stamp);
        }
        for (const [control, key] of Object.entries(bindings)) {
          if (!previous[control] && update.controls[control as keyof typeof bindings]) h.press(key, stamp);
        }
        stamp += update.deltaTime * 1000;
        h.frame(stamp);
        const world = h.api.world(); const player = world.findPlayerBlock();
        const label = capture.id + ' native frame' + update.nativeFrame;
        expect({ count: world.moveCount, outer: player.outerLevel?.id, x: player.x, y: player.y }, label)
          .toEqual({ count: update.expected.moveCount, outer: update.expected.outerLevel, x: update.expected.x, y: update.expected.y });
        expect(world.anyBlockMoving, label).toBe(update.expected.anyBlockMoving);
        expect(player.anim.toLowerCase().replaceAll('_', ''), label)
          .toBe(update.expected.anim.toLowerCase().replaceAll('_', ''));
        expect(player.animT, label).toBeCloseTo(update.expected.animT, 6);
        expect(player.animLength, label).toBeCloseTo(update.expected.animLength, 6);
        previous = update.controls;
      }
    });
  }
});
