import { AnimType, computeAnyBlockMoving, doSquishInPlace, getEnterLength, makePhantom, stopAllAnimations, updateAnimation } from './animation';
import { DrawStyle, FloorType, type WorldModel } from './model';
import { puzzleMetadata } from './progression';
import type { PortalTransition } from './movement';

/** Movement.HandleMovedOnPortal intercepts before moving the logical block. */
export function startHubEntry(world: WorldModel, transition: PortalTransition): void {
  const { block, floor, toX, toY, dx, dy } = transition;
  const length = getEnterLength({ quickAnim: world.drawStyle === DrawStyle.QuickAnim,
    textStyle: world.drawStyle === DrawStyle.TuiColor, enterSpeedIndex: world.enterSpeedIndex });
  world.transitioning = true;
  world.transitionCounter = 0;
  world.transitionLength = length;
  world.transitionSceneName = floor.sceneName;
  world.transitionXPosOffset = block.x - toX;
  world.transitionYPosOffset = block.y - toY;
  block.moving = true; block.animT = 0; block.animLength = length;
  if (puzzleMetadata.get(floor.sceneName)?.eyesJump) {
    block.anim = AnimType.Still; block.drawIsPlayer = false;
    const phantom = makePhantom(block, floor.outerLevel, block.x, block.y, length);
    phantom.xTo = toX - block.x; phantom.yTo = -(toY - block.y);
    phantom.xScaleTo = phantom.yScaleTo = Math.fround(.15);
    phantom.face = true; phantom.jumpIn = true;
    floor.outerLevel.phantoms.push(phantom);
  } else {
    block.anim = AnimType.JumpIn;
    block.drawXScaleStart = block.drawYScaleStart = Math.fround(1 / 9);
    block.drawXOffsetStart = toX - block.x; block.drawYOffsetStart = -(toY - block.y);
    block.eyeXOffsetTo = dx * Math.fround(.08); block.eyeYOffsetTo = -dy * Math.fround(.08);
    block.lookAnimT = 0;
  }
  world.anyBlockMoving = true;
}

/** World updates this after UndoInput/restart and animation recomputation. */
export function advanceHubEntry(world: WorldModel, elapsed: number): string | null {
  if (!world.transitioning) return null;
  world.transitionCounter += elapsed;
  if (world.transitionCounter < world.transitionLength) return null;
  world.transitioning = false;
  return world.transitionSceneName;
}

/** UndoInput.CancelJumpIn deliberately leaves move count and history intact. */
export function cancelHubEntry(world: WorldModel): boolean {
  if (!world.transitioning) return false;
  stopAllAnimations(world);
  for (const level of world.levels) level.phantoms.length = 0;
  doSquishInPlace(world.findPlayerBlock(), world.transitionXPosOffset !== 0, .125,
    { quickAnim: world.drawStyle === DrawStyle.QuickAnim });
  world.transitioning = false; world.transitionCounter = 0;
  world.anyBlockMoving = computeAnyBlockMoving(world);
  return true;
}

/** Hub.PositionPlayerOnHubStart, after progression has placed the player. */
export function startHubArrival(world: WorldModel, recentPuzzle: string | null): boolean {
  if (world.levelName !== 'hub' || !recentPuzzle) return false;
  const player = world.findPlayerBlock();
  const portal = world.floors.find(floor => floor.type === FloorType.LevelPortal &&
    floor.sceneName === recentPuzzle && floor.outerLevel === player.outerLevel);
  if (!portal || !player.outerLevel) return false;
  const dx = player.x - portal.x;
  const dy = player.y - portal.y;
  const length = getEnterLength({ quickAnim: world.drawStyle === DrawStyle.QuickAnim,
    textStyle: world.drawStyle === DrawStyle.TuiColor, enterSpeedIndex: world.enterSpeedIndex });
  player.moving = true;
  player.animT = 0;
  player.animLength = length;
  if (puzzleMetadata.get(recentPuzzle)?.eyesJump) {
    player.anim = AnimType.Still;
    player.drawIsPlayer = false;
    const phantom = makePhantom(player, player.outerLevel, player.x, player.y, length);
    phantom.x = phantom.xFrom = -dx;
    phantom.y = phantom.yFrom = dy;
    phantom.xScale = phantom.xScaleFrom = Math.fround(.15);
    phantom.yScale = phantom.yScaleFrom = Math.fround(.15);
    phantom.face = true;
    phantom.jumpOut = true;
    player.outerLevel.phantoms.push(phantom);
  } else {
    player.anim = AnimType.JumpOut;
    player.drawXScaleStart = player.drawYScaleStart = 1;
    player.drawXOffsetStart = -dx;
    player.drawYOffsetStart = dy;
  }
  player.eyeXOffsetTo = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * Math.fround(.08) : 0;
  player.eyeYOffsetTo = Math.abs(dx) > Math.abs(dy) ? 0 : -Math.sign(dy) * Math.fround(.08);
  player.eyeXOffset = player.eyeXOffsetTo;
  player.eyeYOffset = player.eyeYOffsetTo;
  player.lookAnimT = 0;
  world.anyBlockMoving = true;
  updateAnimation(player, false, false, { deltaTime: 0, quickAnim: false,
    anyBlockMoving: true, handleActionFloor: () => false, random: () => .5 });
  return true;
}
