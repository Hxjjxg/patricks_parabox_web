import { makePhantom } from "./animation";
import type { Block, Phantom } from "./model";

export interface ExitPhantomMove {
  readonly block: Block;
  readonly moveType: string;
  readonly dx: number;
  readonly dy: number;
  readonly infExitNum: number;
}

/** Movement.ResolveMove: old-cell representation, before history moves the block. */
export function createExitPhantom(
  block: Block,
  moves: readonly ExitPhantomMove[],
  dx: number,
  dy: number,
  animLength: number,
): Phantom | null {
  const outer = block.outerLevel;
  if (!outer || outer.blocksWithThisAsTheirSubLevel.length === 0) return null;
  let first: ExitPhantomMove | undefined;
  let exited = false;
  let infExitNum = -1;
  for (const move of moves) {
    if (move.block !== block) continue;
    first ??= move;
    if (move.moveType !== "exit") continue;
    exited = true;
    if (move.infExitNum !== -1) infExitNum = move.infExitNum;
  }
  if (!exited || !first) return null;
  const phantom = makePhantom(block, outer, block.x, block.y, animLength);
  phantom.exitedFrom = infExitNum === -1 ? outer.getExitBlock() : outer.getInfExitBlock(infExitNum);
  phantom.exiting = true;
  phantom.exitingDX = dx;
  phantom.exitingDY = dy;
  if (dx !== 0) phantom.xTo = first.dx;
  if (dy !== 0) phantom.yTo = -first.dy;
  return phantom;
}
