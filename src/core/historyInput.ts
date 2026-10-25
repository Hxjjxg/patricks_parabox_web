export interface HistoryInputState {
  readonly nextTime: number;
  readonly spacing: number;
  readonly undo: boolean;
}

/** Original UndoInput.Update: independent of OS keyboard-repeat events. */
export class HistoryInput {
  private nextTime = 0;
  private spacing = Math.fround(.15);
  private undo = false;

  constructor(initial?: HistoryInputState) {
    if (initial) {
      this.nextTime = Math.fround(initial.nextTime);
      this.spacing = Math.fround(initial.spacing);
      this.undo = initial.undo;
    }
  }

  tick(timeSeconds: number, undoHeld: boolean, redoHeld: boolean): 'undo' | 'redo' | null {
    const time = Math.fround(timeSeconds);
    if (!undoHeld && !redoHeld) {
      this.nextTime = time;
      this.spacing = Math.fround(.15);
      return null;
    }
    if (time <= this.nextTime) return null;
    // Undo wins if both are down. Switching direction waits for the old
    // cooldown, then resets acceleration only when this attempt is eligible.
    if (undoHeld !== this.undo) this.spacing = Math.fround(.15);
    this.undo = undoHeld;
    this.spacing = Math.max(Math.fround(.04), Math.fround(this.spacing - Math.fround(.005)));
    this.nextTime = Math.fround(time + this.spacing);
    return undoHeld ? 'undo' : 'redo';
  }

  snapshot(): HistoryInputState {
    return { nextTime: this.nextTime, spacing: this.spacing, undo: this.undo };
  }
}
