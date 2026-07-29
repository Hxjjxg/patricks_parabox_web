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
  private readonly moveDelaySeconds: number;
  private readonly physicalKeys = new Map<string, string>();
  private readonly directions = new Map<string, HeldDirection>();
  private readonly directionOrder: string[] = [];
  private repeatElapsed = 0;

  constructor(moveDelayMilliseconds = 70) {
    this.moveDelaySeconds =
      Math.max(0, moveDelayMilliseconds) / 1000;
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

  tick(elapsedSeconds: number): DirectionCommand | null {
    const current = this.current();
    if (!current) {
      this.repeatElapsed = 0;
      return null;
    }
    this.repeatElapsed += Math.max(0, elapsedSeconds);
    if (this.repeatElapsed <= this.moveDelaySeconds) return null;
    this.repeatElapsed = 0;
    return current;
  }

  current(): DirectionCommand | null {
    const id = this.directionOrder.at(-1);
    const direction = id ? this.directions.get(id) : null;
    return direction
      ? { dx: direction.dx, dy: direction.dy }
      : null;
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
