import type { Block, WorldModel } from "./model";

export interface InspectionSnapshot {
  readonly inspectedBlockId: number | null;
  readonly viewBlockId: number;
  readonly viewLevelId: number;
  readonly flipH: boolean;
}

/**
 * Logical state for the original game's box-inspection camera.
 *
 * A click or scroll-up enters one direct child box. Right click, scroll-down,
 * or a click outside the viewed block exits one level. Camera interpolation is
 * a renderer concern; the selected recursive world and flip parity live here.
 */
export class InspectionModel {
  private inspectedBlock: Block | null = null;
  private inspectFlipH = false;

  constructor(private readonly world: WorldModel) {}

  get currentBlock(): Block | null {
    return this.inspectedBlock;
  }

  get flipH(): boolean {
    return this.inspectFlipH;
  }

  get viewBlock(): Block {
    return this.inspectedBlock ?? this.world.getDefaultFocusBlock();
  }

  canPush(block: Block): boolean {
    return Boolean(
      block.subLevel &&
        !block.subLevel.filledWithWalls &&
        block.outerLevel === this.viewBlock.subLevel,
    );
  }

  push(block: Block): boolean {
    if (!this.canPush(block)) return false;
    this.inspectedBlock = block;
    if (block.flipH) this.inspectFlipH = !this.inspectFlipH;
    return true;
  }

  pop(): boolean {
    const previous = this.inspectedBlock;
    const from = this.viewBlock;
    this.inspectedBlock = from;
    if (!from.outerLevel) return previous !== from;

    if (from.flipH) this.inspectFlipH = !this.inspectFlipH;
    this.inspectedBlock = from.outerLevel.getExitBlock();
    return true;
  }

  reset(): boolean {
    const changed = this.inspectedBlock !== null || this.inspectFlipH;
    this.inspectedBlock = null;
    this.inspectFlipH = false;
    return changed;
  }

  snapshot(): InspectionSnapshot {
    const viewBlock = this.viewBlock;
    const viewLevel = viewBlock.subLevel;
    if (!viewLevel) {
      throw new Error(`Inspection focus block ${viewBlock.id} has no sublevel`);
    }
    return {
      inspectedBlockId: this.inspectedBlock?.id ?? null,
      viewBlockId: viewBlock.id,
      viewLevelId: viewLevel.id,
      flipH: this.inspectFlipH,
    };
  }
}
