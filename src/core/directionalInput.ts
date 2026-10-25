export interface DirectionCommand {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

interface HeldDirection extends DirectionCommand {
  count: number;
}

function directionId(direction: DirectionCommand): string {
  return `${direction.dx},${direction.dy}`;
}

/**
 * Mirrors the original logical direction stack independently of DOM input.
 *
 * A direction becomes newest only when its first bound key is pressed. Holding
 * W and ArrowUp therefore still represents one logical Up direction. A new
 * direction, or revealing an older held direction after key release, emits
 * immediately; sustained input repeats at the configured move delay.
 */
export class DirectionalInput {
  private moveDelaySeconds: number;
  private readonly physicalKeys = new Map<string, string>();
  private readonly directions = new Map<string, HeldDirection>();
  private readonly directionOrder: string[] = [];
  private repeatElapsed = 0;

  constructor(moveDelayMilliseconds = 70) {
    this.moveDelaySeconds = 0;
    this.setMoveDelayMilliseconds(moveDelayMilliseconds);
  }

  setMoveDelayMilliseconds(moveDelayMilliseconds: number): void {
    this.moveDelaySeconds =
      moveDelayMilliseconds > 500
        ? Number.POSITIVE_INFINITY
        : Math.max(0, moveDelayMilliseconds) / 1000;
    this.repeatElapsed = 0;
  }

  reset(): void {
    this.physicalKeys.clear();
    this.directions.clear();
    this.directionOrder.length = 0;
    this.repeatElapsed = 0;
  }

  press(
    physicalKey: string,
    direction: DirectionCommand,
  ): DirectionCommand | null {
    if (
      this.physicalKeys.has(physicalKey) ||
      Math.abs(direction.dx) + Math.abs(direction.dy) !== 1
    ) {
      return null;
    }

    const before = this.current();
    const id = directionId(direction);
    this.physicalKeys.set(physicalKey, id);
    const held = this.directions.get(id);
    if (held) {
      held.count++;
    } else {
      this.directions.set(id, { ...direction, count: 1 });
      this.directionOrder.push(id);
    }
    return this.emitIfChanged(before);
  }

  release(physicalKey: string): DirectionCommand | null {
    const id = this.physicalKeys.get(physicalKey);
    if (!id) return null;

    const before = this.current();
    this.physicalKeys.delete(physicalKey);
    const held = this.directions.get(id);
    if (held) {
      held.count--;
      if (held.count <= 0) {
        this.directions.delete(id);
        const orderIndex = this.directionOrder.indexOf(id);
        if (orderIndex >= 0) {
          this.directionOrder.splice(orderIndex, 1);
        }
      }
    }
    return this.emitIfChanged(before);
  }

  /** Controls.Update samples the whole keyboard before Movement walks U/D/L/R. */
  syncPhysicalKeys(keys: ReadonlyMap<string, DirectionCommand>): DirectionCommand | null {
    const before = this.current();
    const order: DirectionCommand[] = [
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    this.physicalKeys.clear();
    for (const [key, direction] of keys) this.physicalKeys.set(key, directionId(direction));
    for (const direction of order) {
      const id = directionId(direction);
      const count = [...this.physicalKeys.values()].filter(value => value === id).length;
      const held = this.directions.get(id);
      if (count > 0) {
        if (held) held.count = count;
        else {
          this.directions.set(id, { ...direction, count });
          this.directionOrder.push(id);
        }
      } else if (held) {
        this.directions.delete(id);
        this.directionOrder.splice(this.directionOrder.indexOf(id), 1);
      }
    }
    return this.emitIfChanged(before);
  }

  tick(
    elapsedSeconds: number,
    canRepeat = true,
    canEmit = true,
  ): DirectionCommand | null {
    const current = this.current();
    if (!current) {
      this.repeatElapsed = 0;
      return null;
    }
    // The original only advances its move delay while no block is animating,
    // so held input does not burn repeats during a slide.
    if (canRepeat) this.repeatElapsed += Math.max(0, elapsedSeconds);
    // Native delay continues accumulating through a settled win/queue, but
    // only an actual eligible impulse consumes it. Automatic loads retain it.
    if (!canEmit) return null;
    if (this.repeatElapsed <= this.moveDelaySeconds) return null;
    return current;
  }

  current(): DirectionCommand | null {
    const id = this.directionOrder.at(-1);
    const direction = id ? this.directions.get(id) : null;
    return direction
      ? { dx: direction.dx, dy: direction.dy }
      : null;
  }

  /** PlayerMovementLogic makes a changed direction immediately eligible. */
  markDirectionChanged(): void {
    this.repeatElapsed = 1000;
  }

  /** Physical impulses reset the native delay, including deferred inputs. */
  resetRepeatDelay(quickAnim = false): void {
    this.repeatElapsed = quickAnim ? -0.1 : 0;
  }

  private emitIfChanged(
    before: DirectionCommand | null,
  ): DirectionCommand | null {
    const after = this.current();
    if (
      before?.dx === after?.dx &&
      before?.dy === after?.dy
    ) {
      return null;
    }
    this.repeatElapsed = 0;
    return after;
  }
}
