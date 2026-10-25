import type { Block } from "../core/model";
import { AnimType } from "../core/animation";
import { originalDrawRect, type WallRect } from "./wallRendering";

export type EyeTexture = "eye" | "eyeSmall" | "eyeClosed" | "eyeClosedSmall" | "possessEye" | "possessEyeSmall";
const f = Math.fround;

/** Draw.DrawFace float arithmetic, then SetDrawRect's integer endpoints. */
export function faceQuads(block: Block, rect: WallRect, screenHeight: number, flipH: boolean,
  resolution = 1, facePhantom = false, cloneFade=false,phase=1): Array<{ rect: WallRect; texture: EyeTexture; alpha: number }> {
  const player = block.drawIsPlayer || facePhantom;
  const width = f(rect.width), height = f(rect.height);
  const cx = f(rect.x + rect.width / 2), cy = f(rect.y + rect.height / 2);
  const fraction = f(f(f(width + height) / 2) / f(screenHeight));
  let alpha = f(f(-f(Math.log10(f(fraction + 15)))) + 1.5);
  if (block.subLevel && !block.subLevel.filledWithWalls) alpha = f(f(-f(Math.log10(f(fraction + f(1.5))))) + f(0.5));
  if (!player && block.moving && block.anim === AnimType.Still) {
    const t = f(block.animT / block.animLength);
    alpha = f(alpha * (block.isPlayer ? f(1 - t) : t));
  }
  if(cloneFade&&block.subLevel){
    const canonical=block.subLevel.getExitBlock();
    const a=block.possessable||block.isPlayer?1:0,b=canonical.possessable||canonical.isPlayer?1:0;
    alpha=f(alpha*f(a+f((b-a)*phase)));
  }
  if (alpha < 0) return [];
  let eyeWidth = f(width * f(0.2)), eyeHeight = f(height * f(0.2));
  const blink = Math.floor(f(f(block.faceAnimT) * f(7.12))) % 26 === 0 && player;
  if (blink) { eyeWidth = f(eyeWidth * f(1.05)); eyeHeight = f(eyeHeight * f(0.95)); }
  const texture: EyeTexture = !player ? (eyeWidth < 50 ? "possessEyeSmall" : "possessEye")
    : blink ? (eyeWidth < 50 ? "eyeClosedSmall" : "eyeClosed") : (eyeWidth < 50 ? "eyeSmall" : "eye");
  let leftX = f(-0.25), rightX = f(0.25), eyeY = f(-0.05);
  if (!block.isPlayer || block.drawIsPlayer || facePhantom) {
    const offsetX = f(block.eyeXOffset), offsetY = f(block.eyeYOffset);
    leftX = f(leftX + (offsetX > 0 ? f(offsetX * f(1.5)) : offsetX));
    rightX = f(rightX + (offsetX < 0 ? f(offsetX * f(1.5)) : offsetX));
    eyeY = f(eyeY + f(offsetY * f(1.5)));
  }
  if (flipH) { leftX *= -1; rightX *= -1; }
  return [leftX, rightX].map((eyeX) => ({ texture, alpha: Math.min(1, alpha * 2), rect: originalDrawRect({
    x: f(f(cx + f(width * eyeX)) - f(eyeWidth / 2)),
    y: f(f(cy + f(height * eyeY)) - f(eyeHeight / 2)), width: eyeWidth, height: eyeHeight,
  }, resolution) }));
}
