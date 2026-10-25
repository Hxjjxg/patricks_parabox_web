import type {Block,Phantom} from "../core/model";
import {DrawStyle} from "../core/model";
import {quadParabola} from "../core/animation";
import {stackClip} from "./renderContext";
import type {WallRect} from "./wallRendering";

export function shouldDrawPhantom(phantom:Phantom,viewBlock:Block,style:DrawStyle):boolean{
 return style!==DrawStyle.QuickAnim && (phantom.exitedFrom!==viewBlock || style===DrawStyle.Grid);
}

/** Draw.ProcessTicket phantom representation projection and flag10 clamp. */
export function phantomGeometry(phantom:Phantom,cell:WallRect,board:WallRect,viewBlock:Block,
 flipH:boolean,phase:number,inheritedClip:WallRect|null):{rect:WallRect;clip:WallRect|null}{
 let width=cell.width*phantom.xScale,height=cell.height*phantom.yScale;
 const offsetX=phantom.x*cell.width*(flipH?-1:1),offsetY=phantom.y*cell.height;
 let cx=cell.x+cell.width/2+offsetX,cy=cell.y+cell.height/2+offsetY;
 const entered=phantom.faceBlockForJustEnteredArray?.justEnteredArray;
 const simple=phantom.exiting || phantom.face&&!!entered&&entered[0]!==viewBlock;
 if(simple){
  width=cell.width;height=cell.height;
  const t=Math.min(1,Math.max(0,phantom.animT/phantom.animLength)),shape=quadParabola(phase);
  if(phantom.exitingDX!==0){
   cx-=offsetX;cy-=offsetY;cx+=Math.sign(phantom.xTo)*t*cell.width*(flipH?-1:1);
   width*=1+.1*shape;height*=1-.2*shape;
  }
  if(phantom.exitingDY!==0){
   cx-=offsetX;cy-=offsetY;cy+=Math.sign(phantom.yTo)*t*cell.height;
   width*=1-.2*shape;height*=1+.1*shape;
  }
 }
 return {rect:{x:cx-width/2,y:cy-height/2,width,height},clip:simple?stackClip(inheritedClip,board):inheritedClip};
}
