import type { Block, WorldModel } from "./model";
import { getEnterLength, resetCameraOffset, setCameraOffset } from "./animation";

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
 * or a click outside the viewed block exits one level. Native camera offsets
 * are composed here; the renderer presents the shared camera animation state.
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
        !block.moving &&
        block.outerLevel === this.viewBlock.subLevel,
    );
  }

  push(block: Block): boolean {
    if (!this.canPush(block)) return false;
    this.inspectedBlock = block;
    if (block.flipH) this.inspectFlipH = !this.inspectFlipH;
    // World.DoInspectZoomIn uses the post-push parity, then the child's flip.
    const outer = block.outerLevel!;
    const sign = (this.inspectFlipH ? -1 : 1) * (block.flipH ? -1 : 1);
    const f = Math.fround;
    setCameraOffset(this.world,
      f((block.x - (outer.width - 1) / 2) * sign),
      f(-(block.y - (outer.height - 1) / 2)),
      f(f(1 / outer.width) * f(outer.camZoomFactor)),
      f(f(1 / outer.height) * f(outer.camZoomFactor)),
      this.zoomLength(), false);
    return true;
  }

  pop(): boolean {
    const previous = this.inspectedBlock;
    const from = this.viewBlock;
    this.inspectedBlock = from;
    if (!from.outerLevel) return previous !== from;

    if (from.flipH) this.inspectFlipH = !this.inspectFlipH;
    this.inspectedBlock = from.outerLevel.getExitBlock();
    // A missing wrapper falls back to the ordinary focus, as native multi/single paths do.
    const to = this.inspectedBlock ?? this.world.getDefaultFocusBlock();
    const level = to.subLevel!;
    const sign = this.inspectFlipH ? -1 : 1;
    const f = Math.fround;
    setCameraOffset(this.world,
      f(f(-(from.x - (level.width - 1) / 2) / level.width) * sign),
      f((from.y - (level.height - 1) / 2) / level.height),
      f(level.width * f(from.subLevel!.camZoomFactor)),
      f(level.height * f(from.subLevel!.camZoomFactor)),
      this.zoomLength(), false);
    return true;
  }

  reset(): boolean {
    const changed = this.inspectedBlock !== null || this.inspectFlipH;
    if (this.inspectedBlock !== null) resetCameraOffset(this.world);
    this.inspectedBlock = null;
    this.inspectFlipH = false;
    return changed;
  }

  private zoomLength(): number {
    return getEnterLength({ quickAnim: false, enterSpeedIndex: this.world.enterSpeedIndex });
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
