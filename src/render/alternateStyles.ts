import {DrawStyle,FloorType,type Level,type WorldModel,type Block} from "../core/model";
import {originalDrawRect,type WallRect} from "./wallRendering";

const f=Math.fround;
export interface AlternateStyleContext {
 readonly endZoom?:boolean;readonly screenshottingBlocks?:boolean;
 readonly nexusUnlocked?:boolean;readonly unlockPuzzles?:boolean;readonly winPhase?:number;
}
export function useAlternateDrawStyle(style:DrawStyle,mode:string,context:AlternateStyleContext={}):boolean{
 return (style===DrawStyle.Grid||style===DrawStyle.TuiColor)&&(mode==="playing"||mode==="paused")
  &&!context.endZoom&&!context.screenshottingBlocks;
}

/** Draw.ComputeTUILevels: stable native world order breaks equal-width ties. */
export function alternateLevels(world:WorldModel,context:AlternateStyleContext={}):Level[]{
 const inHub=world.levelName==="hub";
 const levels=world.levels.filter(level=>!level.filledWithWalls
  &&(!world.levelIsInfZone(level)||world.wentToInfZone&&level.blockList.length>1)
  &&level.getExitBlock()?.specialEffect!==11
  &&(!inHub||context.nexusUnlocked||context.unlockPuzzles||level.hubShowInTravel));
 return inHub?levels:levels.sort((a,b)=>b.width-a.width);
}
export interface GridBoard {level:Level;rect:WallRect}
/** Draw.DrawBlocks1601: square cells maximize size inside95% viewport. */
export function gridBoards(levels:readonly Level[],width:number,height:number,resolution=1):GridBoard[]{
 if(!levels.length)return [];
 const sw=f(width*resolution),sh=f(height*resolution),w=f(sw*f(.95)),h=f(sh*f(.95));
 let size=-1,columns=0,rows=0;
 for(let i=1;i<=levels.length;i++){
  const r=Math.ceil(f(levels.length/i)),s=Math.min(f(w/i),f(h/r));
  if(s>size){size=s;columns=i;rows=r;}
 }
 const cx=f(f(sw*f(.5))+f(f(w-f(size*columns))/2));
 const cy=f(f(sh*f(.5))+f(f(h-f(size*rows))/2));
 const side=f(size*f(.8));
 return levels.map((level,index)=>{
  const x=f(f(f(cx-f(w/2))+f(index%columns*size))+f(size/2));
  const y=f(f(f(cy-f(h/2))+f(Math.floor(index/columns)*size))+f(size/2));
  return {level,rect:{x:(x-side/2)/resolution,y:(y-side/2)/resolution,width:side/resolution,height:side/resolution}};
 });
}
export interface TuiBoard {level:Level;left:number;top:number}
export interface TuiLayout {boards:TuiBoard[];fontSize:number;cellWidth:number;cellHeight:number;resolution:number}
/** Draw.DrawTUI2636: try every wrapping threshold; retain last equal optimum. */
export function tuiLayout(levels:readonly Level[],width:number,height:number,inHub=false,resolution=1):TuiLayout{
 const sw=f(width*resolution),sh=f(height*resolution),w=inHub?sw:f(sw*f(.75)),h=inHub?sh:f(sh*f(.75));
 let limit=levels.reduce((n,l)=>n+l.width+3,0),font=0,bestLimit=0,bestColumns=0,bestRows=0;
 while(limit>0){
  let x=0,y=0,row=0,columns=0,rows=0;
  for(const level of levels){
   x+=level.width+3;row=Math.max(row,level.height+1);
   columns=Math.max(columns,x-1);rows=Math.max(rows,y+row-1);
   if(x>=limit){x=0;y+=row;row=0;}
  }
  let candidate=Math.trunc(f(Math.floor(f(w/columns))/f(.55)));
  if(candidate*rows<=h&&candidate>=font){font=candidate;bestLimit=limit;bestColumns=columns;bestRows=rows;}
  candidate=Math.floor(f(h/rows));
  if(f(candidate*columns*f(.55))<=w&&candidate>=font){font=candidate;bestLimit=limit;bestColumns=columns;bestRows=rows;}
  limit--;
 }
 // Native v3: cell width is float32; packing products retain double precision
 // until TUIDrawLevel receives its narrowed float leftX/topY parameters.
 const cellWidth=f(font*f(.55)),cellHeight=font;
 const left=(sw-cellWidth*bestColumns)/2,top=(sh-cellHeight*bestRows)/2;
 let x=left,y=top,count=0,row=0;const boards:TuiBoard[]=[];
 for(const level of levels){
  boards.push({level,left:f(x),top:f(y)});count+=level.width+3;x+=cellWidth*(level.width+3);row=Math.max(row,level.height+1);
  if(count>=bestLimit){count=0;x=left;y=f(y+f(row*cellHeight));row=0;}
 }
 return {boards,fontSize:font,cellWidth,cellHeight,resolution};
}
type Rgb=readonly [number,number,number];
const white:Rgb=[.95,.95,.95];
function rgbColor(rgb:Rgb,guiBackground=false):number{
 const byte=(v:number)=>Math.min(255,Math.max(0,guiBackground?Math.round(f(v/2)*255)*2:Math.round(v*255)));
 return byte(rgb[0])*65536+byte(rgb[1])*256+byte(rgb[2]);
}
function levelColor(level:Level,world:WorldModel,context:AlternateStyleContext):Rgb{
 const {h,s,v}=level.getExitBlock().color;
 const value=f(world.winning?f(v+f(f(f(v*1.5)-v)*Math.min(1,context.winPhase??0))):v);
 const sector=f(h*6),i=Math.floor(sector),t=f(sector-i),p=f(value*f(1-s)),q=f(value*f(1-f(s*t))),r=f(value*f(1-f(s*f(1-t))));
 const rgb:Rgb=([ [value,r,p],[q,value,p],[p,value,r],[p,q,value],[r,p,value],[value,p,q] ] as const)[((i%6)+6)%6]!;
 return rgb.map(v=>Math.min(1,Math.max(0,v))) as unknown as Rgb;
}
export function tuiLevelCharacter(level:Level,levels:readonly Level[]):string{
 if(level.infZone)return "i";const index=levels.indexOf(level);
 return index<0?"b":"123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index]??"z";
}
function coveringGoal(block:Block):boolean{
 const floor=block.outerLevel?.getFloor(block.x,block.y);
 return !!block.subLevel&&!!floor&&(block.isPlayer?floor.type===FloorType.PlayerButton:floor.type===FloorType.Button);
}
function quadOscillate(t:number):number{
 t=f(t-Math.floor(t));const triangle=t<.5?f(t*2):f(1-f(f(t-.5)*2)),k=f(triangle*2);
 return k<1?f(f(.5*k)*k):f(-.5*f(f(f(k-1)*f(k-3))-1));
}
export interface TuiGlyph {
 text:string;color:number;background:number|null;cell:WallRect;nativeCell:WallRect;labelRect:WallRect;fontSize:number;physicalFontSize:number;level:Level;
}
/** TUIDrawLevel uses logical cells immediately, never normal animation offsets. */
export function tuiGlyphs(world:WorldModel,levels:readonly Level[],layout:TuiLayout,clock:number,context:AlternateStyleContext={}):TuiGlyph[]{
 const result:TuiGlyph[]=[],phase=Math.floor(f(f(clock)*2))%4,res=layout.resolution;
 const flash=f(f(.3)+f(f(f(.95)-f(.3))*quadOscillate(f(f(clock)*f(.5)))));
 const add=(level:Level,text:string,color:Rgb,background:Rgb|null,x:number,y:number)=>{
  const cell=originalDrawRect({x,y,width:layout.cellWidth,height:layout.cellHeight},1);
  const labelRect={x:cell.x,y:f(cell.y-layout.cellHeight),width:cell.width,height:f(layout.cellHeight*2)};
  const css=(r:WallRect):WallRect=>({x:r.x/res,y:r.y/res,width:r.width/res,height:r.height/res});
  result.push({level,text,color:rgbColor(color),background:background?rgbColor(background,true):null,cell:css(cell),
   nativeCell:{x,y,width:layout.cellWidth,height:layout.cellHeight},labelRect:css(labelRect),fontSize:layout.fontSize/res,physicalFontSize:layout.fontSize});
 };
 for(const board of layout.boards){
  const level=board.level,color=levelColor(level,world,context);
  for(let x=0;x<level.width;x++)for(let y=0;y<level.height;y++){
   let text=".",foreground=color,background:Rgb|null=null,clone=false;
   const block=level.getBlock(x,y),floor=level.getFloor(x,y);
   if(block){
    if(!block.subLevel)text="#";
    else{
     const included=levels.includes(block.subLevel);text=included?tuiLevelCharacter(block.subLevel,levels):block.isPlayer?"p":"b";
     clone=block.subLevel.getExitBlock()!==block;foreground=coveringGoal(block)?white:levelColor(block.subLevel,world,context);
     if(block.flipH&&included&&phase===3)text="/";
     if((block.isSomeInfEnterBlock||block.subLevel.infExitBlocks.includes(block))&&included&&phase===2)text="i";
    }
    if(block.possessable&&!block.isPlayer&&phase===1)text=":";
   }else if(floor){
    if(floor.type===FloorType.Button){text="_";foreground=white;}
    else if(floor.type===FloorType.PlayerButton){text="=";foreground=white;}
    else if(floor.type===FloorType.LevelPortal){text="O";foreground=!floor.unlocked?[.3,.3,.3]:!floor.won?[flash,flash,flash]:white;}
    else if(floor.type===FloorType.BreakFloor){text="[";foreground=white;}
    else if(floor.type===FloorType.Info){text="i";foreground=white;}
    else if(floor.type===FloorType.FastTravel){text="v";foreground=white;}
   }
   if(clone){background=foreground;foreground=[0,0,0];}
   add(level,text,foreground,background,board.left+(x+2)*layout.cellWidth,board.top+(level.height-y-1)*layout.cellHeight);
  }
  add(level,tuiLevelCharacter(level,levels),color,null,board.left,f(board.top+f(Math.floor(level.height/2)*layout.cellHeight)));
 }
 return result;
}
