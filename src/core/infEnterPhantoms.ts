import { makePhantom, type ProjectionResult } from "./animation";
import type { Block, Phantom } from "./model";

export interface InfEnterPhantomMove {
  readonly block: Block;
  readonly moveType: string;
  readonly infEnterNum: number;
  readonly infEaten: boolean;
}

/** Movement.ResolveMove: shrink the old-cell copy on a strict infinite Enter. */
export function createInfEnterPhantom(
  block: Block,
  moves: readonly InfEnterPhantomMove[],
  dx: number,
  dy: number,
  projection: Pick<ProjectionResult, "xOffset" | "yOffset">,
  animLength: number,
): Phantom | null {
  if (!block.outerLevel) return null;
  let entered = false;
  let eaten = false;
  for (const move of moves) {
    if (move.block !== block || move.moveType !== "enter") continue;
    if (move.infEnterNum !== -1) entered = true;
    if (move.infEaten) eaten = true;
  }
  if (!entered) return null;
  const phantom = makePhantom(block, block.outerLevel, block.x, block.y, animLength);
  const direction = eaten ? 1 : -1;
  // Mathf.Sign(0), including negative zero, is positive.
  if (dx !== 0) phantom.xTo = direction * (projection.xOffset < 0 ? -1 : 1) / 2;
  if (dy !== 0) phantom.yTo = direction * (projection.yOffset < 0 ? -1 : 1) / 2;
  phantom.xScaleTo = 0;
  phantom.yScaleTo = 0;
  return phantom;
}
