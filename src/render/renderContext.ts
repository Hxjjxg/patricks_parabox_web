import type { Block } from "../core/model";
import { DrawStyle } from "../core/model";
import { AnimType, quadParabola } from "../core/animation";
import type { WallRect } from "./wallRendering";

export interface InfExitPreview { dx: number; dy: number; exitBlocks: Block[] }
export interface SceneTicket {
  block: Block; rect: WallRect; staticRect: WallRect; depth: number; flipH: boolean;
  parents: Block[]; clip: WallRect | null; priority: number; cloneFade?: boolean;
  floor?: import("../core/model").Floor;
}

/** Native ShouldSimpleSlide compares ordered block representations, not levels. */
export function shouldSimpleSlide(ticket: Pick<SceneTicket,"block"|"parents"|"depth">, child: Block, style: DrawStyle): boolean {
  const entered = child.justEnteredArray;
  if (!entered || !child.moving || child.anim !== AnimType.EnterExit && child.anim !== AnimType.Normal) return false;
  if (ticket.block.subLevel?.infZone) return false;
  if (entered[0] !== ticket.block) return true;
  if (style === DrawStyle.Grid && ticket.parents.length === 0) return true;
  if (ticket.parents.length === 0) return false;
  for (let i=1;i<entered.length;i++) {
    if (i > ticket.parents.length-1 || entered[i] !== ticket.parents[i-1]) return true;
  }
  return style === DrawStyle.Grid && ticket.depth < entered.length;
}

export function simpleSlideRect(child: Block, cell: WallRect, flipH: boolean, phase: number): WallRect {
  const level = child.outerLevel!;
  let x=cell.x+cell.width/2, y=cell.y+cell.height/2;
  let xs=1,ys=1;
  let horizontal=child.x===0 || child.x===level.width-1;
  let vertical=child.y===0 || child.y===level.height-1;
  if (horizontal && vertical) {
    if (Math.abs(child.drawXOffset)>Math.abs(child.drawYOffset)) vertical=false;
    else horizontal=false;
  }
  const localPhase=child.animT/child.animLength;
  const shape=quadParabola(phase);
  if (horizontal && child.drawXOffset!==0) {
    x+=Math.sign(child.drawXOffsetStart)*(1-localPhase)*cell.width*(flipH?-1:1);
    xs=1+0.1*shape;ys=1-0.2*shape;
  } else if (vertical && child.drawYOffset!==0) {
    y+=Math.sign(child.drawYOffsetStart)*(1-localPhase)*cell.height;
    xs=1-0.2*shape;ys=1+0.1*shape;
  } else {
    x+=child.drawXOffset*cell.width*(flipH?-1:1);
    y+=child.drawYOffset*cell.height;
  }
  return {x:x-cell.width*xs/2,y:y-cell.height*ys/2,width:cell.width*xs,height:cell.height*ys};
}

export function stackClip(clip: WallRect | null, rect: WallRect): WallRect {
  if (!clip) return {...rect};
  const x=Math.max(clip.x,rect.x),y=Math.max(clip.y,rect.y);
  return {x,y,width:Math.max(0,Math.min(clip.x+clip.width,rect.x+rect.width)-x),
    height:Math.max(0,Math.min(clip.y+clip.height,rect.y+rect.height)-y)};
}

/** EnableClamp floors native float endpoints; direction uses pre-ancestor flip. */
export function previewClip(preview: Pick<InfExitPreview,"dx"|"dy">, ancestor: WallRect, flipH: boolean,
  width: number,height: number,resolution=1): WallRect {
  let x=0,y=0,right=width,bottom=height;
  if (preview.dy===1) bottom=ancestor.y;
  else if (preview.dy===-1) y=ancestor.y+ancestor.height;
  else if (preview.dx*(flipH?-1:1)===-1) right=ancestor.x;
  else x=ancestor.x+ancestor.width;
  const floor=(value:number)=>Math.floor(Math.fround(value*resolution))/resolution;
  x=floor(x);y=floor(y);right=floor(right);bottom=floor(bottom);
  return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}
