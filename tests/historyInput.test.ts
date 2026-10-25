import { describe, expect, it } from 'vitest';
import { HistoryInput } from '../src/core/historyInput';
import nativeHistory from './fixtures/original-history-repeat.json';

describe('native absolute held undo redo cooldown', () => {
  for (const capture of nativeHistory) {
    it(capture.id + ' scheduler matches all recorded float32 transitions', () => {
      const input = new HistoryInput(capture.initialScheduler);
      for (const update of capture.updates) {
        input.tick(update.scaledTime, update.controls.undo, update.controls.redo);
        expect(input.snapshot(), 'native frame' + update.nativeFrame).toEqual({
          nextTime: Math.fround(update.scheduler.nextTime),
          spacing: Math.fround(update.scheduler.spacing),
          undo: update.scheduler.undo,
        });
      }
    });
  }

  it('requires strictly greater time and starts with a145ms cooldown', () => {
    const input = new HistoryInput();
    expect(input.tick(0, true, true)).toBeNull();
    expect(input.tick(1, true, true)).toBe('undo');
    expect(input.snapshot().spacing).toBe(Math.fround(Math.fround(.15) - Math.fround(.005)));
    expect(input.tick(input.snapshot().nextTime, false, true)).toBeNull();
    expect(input.tick(input.snapshot().nextTime + .001, false, true)).toBe('redo');
  });
});
