import { AnimType, getEnterLength, makePhantom, updateAnimation } from './animation';
import { DrawStyle, FloorType, type WorldModel } from './model';
import { puzzleMetadata } from './progression';

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
