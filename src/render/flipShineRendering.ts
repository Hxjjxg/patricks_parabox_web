import type { Block } from "../core/model";
import { DrawStyle } from "../core/model";
import { originalDrawRect, type WallRect } from "./wallRendering";
import { flipIntensity } from "./cloneFocusRendering";
const f=Math.fround;
function quadInOut(k:number):number {
  k=f(k*2);
  if (k<1) return f(f(f(0.5)*k)*k);
  k=f(k-1);
  return f(f(-0.5)*f(f(k*f(k-2))-1));
}

/** DrawFlipShine3916: clipped vertical band; never a diagonal marker. */
export function flipShineQuad(block:Block,rect:WallRect,screenHeight:number,flipH:boolean,depth:number,style:DrawStyle,resolution=1,cloneFade=false,transitionPhase=block.animLength?f(block.animT/block.animLength):1):
  {rect:WallRect;alpha:number}|null {
  if (!block.subLevel || block.subLevel.filledWithWalls || style===DrawStyle.Grid && depth===0) return null;
  const intensity=flipIntensity(block,transitionPhase,cloneFade);
  const fraction=f(f(f(f(rect.width)+f(rect.height))/2)/f(screenHeight));
  const alpha=f(Math.min(f(f(-f(Math.log10(f(fraction+f(0.5)))))+f(0.18)),f(0.22))*intensity)*2;
  if (alpha<=0) return null;
  let phase=f(f(f(block.miscAnimT)*f(0.5))%f(1.3));
  if (phase>=1) return null;
  if (flipH || block.specialEffect===3) phase=f(1-phase);
  const triangle=phase<0.5?f(phase*2):f(1-f(f(phase-f(0.5))*2));
  const width=f(0.4)*rect.width*f(triangle*triangle);
  phase=quadInOut(quadInOut(phase));
  const center=f(f(rect.x)+f(f(f(rect.x+rect.width)-f(rect.x))*phase));
  const band=originalDrawRect({x:center-width/2,y:rect.y,width,height:rect.height},resolution);
  const floor=(v:number)=>Math.floor(f(v*resolution))/resolution;
  const x=Math.max(band.x,floor(rect.x)),y=Math.max(band.y,floor(rect.y));
  const right=Math.min(band.x+band.width,floor(rect.x+rect.width));
  const bottom=Math.min(band.y+band.height,floor(rect.y+rect.height));
  if (right<=x || bottom<=y) return null;
  return {rect:{x,y,width:right-x,height:bottom-y},alpha:Math.min(1,alpha)};
}
