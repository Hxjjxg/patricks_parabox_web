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
export function flipShineQuad(block:Block,rect:WallRect,screenHeight:number,flipH:boolean,depth:number,style:DrawStyle,resolution=1,cloneFade=false,transitionPhase=block.animLength?f(block.animT/block.animLength):1,inheritedClip:WallRect|null=null):
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
  // ProcessTicket6188 always stacks self bounds on the queued shine ticket.
  // EnableTicketClamp floors that double-precision intersection, then
  // DrawFlipShine stacks the local bounds again as floats. A parent Pixi mask
  // alone cannot express the resulting fractional local board edge.
  const local=(v:number)=>f(v*resolution)/resolution;
  const extent=(start:number,size:number)=>f(f(start*resolution)+f(size*resolution))/resolution;
  const ticketLeft=inheritedClip?Math.max(inheritedClip.x,rect.x):rect.x;
  const ticketTop=inheritedClip?Math.max(inheritedClip.y,rect.y):rect.y;
  const ticketRight=inheritedClip?Math.min(inheritedClip.x+inheritedClip.width,rect.x+rect.width):rect.x+rect.width;
  const ticketBottom=inheritedClip?Math.min(inheritedClip.y+inheritedClip.height,rect.y+rect.height):rect.y+rect.height;
  const left=Math.max(floor(ticketLeft),local(rect.x));
  const top=Math.max(floor(ticketTop),local(rect.y));
  const clipRight=Math.min(floor(ticketRight),extent(rect.x,rect.width));
  const clipBottom=Math.min(floor(ticketBottom),extent(rect.y,rect.height));
  const x=Math.max(band.x,left),y=Math.max(band.y,top);
  const right=Math.min(band.x+band.width,clipRight);
  const bottom=Math.min(band.y+band.height,clipBottom);
  if (right<=x || bottom<=y) return null;
  return {rect:{x,y,width:local(right-x),height:local(bottom-y)},alpha:Math.min(1,alpha)};
}
