import type { DirectionCommand } from "./directionalInput";

export interface TouchEndResult {
  readonly accepted: boolean;
  readonly moved: boolean;
}

/**
 * Models the original mobile swipe gesture independently of DOM events.
 * A gesture emits one cardinal direction whenever its displacement crosses
 * min(viewportWidth, viewportHeight) / 15, then starts measuring again from
 * the current point. A short gesture remains a tap for inspection hit-tests.
 */
export class TouchSwipeInput {
  private readonly thresholdRatio: number;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private moved = false;

  constructor(thresholdRatio = 1 / 15) {
    this.thresholdRatio = Math.max(0, thresholdRatio);
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  start(
    pointerId: number,
    x: number,
    y: number,
  ): boolean {
    if (this.pointerId !== null) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.pointerId = pointerId;
    this.originX = x;
    this.originY = y;
    this.moved = false;
    return true;
  }

  move(
    pointerId: number,
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number,
  ): DirectionCommand | null {
    if (this.pointerId !== pointerId) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const dx = x - this.originX;
    const dy = y - this.originY;
    const threshold =
      Math.max(0, Math.min(viewportWidth, viewportHeight)) *
      this.thresholdRatio;
    if (Math.hypot(dx, dy) <= threshold) return null;

    this.originX = x;
    this.originY = y;
    this.moved = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      return { dx: dx > 0 ? 1 : -1, dy: 0 };
    }
    return { dx: 0, dy: dy > 0 ? -1 : 1 };
  }

  end(pointerId: number): TouchEndResult {
    if (this.pointerId !== pointerId) {
      return { accepted: false, moved: false };
    }
    const result = { accepted: true, moved: this.moved } as const;
    this.reset();
    return result;
  }

  cancel(pointerId?: number): boolean {
    if (this.pointerId === null) return false;
    if (pointerId !== undefined && this.pointerId !== pointerId) {
      return false;
    }
    this.reset();
    return true;
  }

  reset(): void {
    this.pointerId = null;
    this.originX = 0;
    this.originY = 0;
    this.moved = false;
  }
}
