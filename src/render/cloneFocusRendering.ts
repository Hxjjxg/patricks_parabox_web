import type {Block,Level,WorldModel} from "../core/model";
import {DrawStyle} from "../core/model";
const f=Math.fround;

/** Draw.AnimT/AnimLength, distinct from block BUMP_HALT and newCamT. */
export function cameraTransitionPhase(world:WorldModel):number {
  return world.cameraAnimLength>0 ? f(f(world.cameraAnimT)/f(world.cameraAnimLength)) : 1;
}
export function cloneFocusEligible(world:WorldModel,instantZoom=false):boolean {
  return world.anyBlockMoving && world.cameraMovedThisTurn && !instantZoom;
}
export function cloneFocus(world:WorldModel,inspection:Block|null,mode:string,instantZoom=false):{block:Block;clone:Block|null} {
  const block=inspection??world.getDefaultFocusBlock();
  if(inspection||world.playerBlocks.length>1||world.levelName==="static_focus_block"||world.drawStyle===DrawStyle.QuickAnim)return {block,clone:null};
  const player=world.findPlayerBlock(),entered=player.justEnteredArray?.[0];
  if(!cloneFocusEligible(world,instantZoom)||!entered||entered.subLevel!==player.outerLevel||entered===entered.subLevel?.getExitBlock())return {block,clone:null};
  return {block:cameraTransitionPhase(world)<.5&&mode==="playing"?entered:block,clone:entered};
}

/** DrawBlocks2094: choose the representation encountered on the movement path. */
export function cloneAncestor(path:readonly Block[],player:Block,outer:Level,index:number,firstHalf:boolean,playerFallback:boolean):{block:Block;clone:Block}|null {
  let choice:{block:Block;clone:Block}|null=null;
  let firstClone:Block|null=null;
  for(let j=0;j<path.length;j++){
    const entered=path[j]!.justEnteredArray?.[index-j];
    if(entered&&entered.subLevel===outer&&entered!==outer.getExitBlock()){
      firstClone=firstClone??entered;
      choice={block:firstHalf?entered:outer.getExitBlock(),clone:firstClone};
    }
  }
  if(choice)return choice;
  const entered=playerFallback?player.justEnteredArray?.[index+1]:null;
  return entered&&entered.subLevel===outer&&entered!==outer.getExitBlock()?{block:firstHalf?entered:outer.getExitBlock(),clone:entered}:null;
}

/** DrawBlocks2476: source trapezoid, black before the cloneFade overlay pass. */
export function cloneTransitionOpacity(phase:number):number {
  phase=f(phase);
  if(phase<0||phase>=1)return 0;
  if(phase<f(.45))return f(phase/f(.45));
  if(phase<f(.55))return 1;
  return f(1-f(f(phase-f(.55))/f(1-f(.55))));
}
export function cloneIntensity(block:Block,cloneFade=false,phase=1):number {
  return cloneFade?f(1-phase):block.subLevel&&block.subLevel.getExitBlock()!==block?1:0;
}
export function flipIntensity(block:Block,phase:number,cloneFade=false):number {
  const ordinary=(b:Block)=>b.specialEffect===2||b.specialEffect===3?1:b.fadeFlipH?(b.flipH?phase:f(1-phase)):b.flipH?1:0;
  const a=ordinary(block);
  return cloneFade&&block.subLevel?f(a+f(f(ordinary(block.subLevel.getExitBlock())-a)*phase)):a;
}
