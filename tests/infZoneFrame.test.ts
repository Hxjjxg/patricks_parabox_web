import {describe,expect,it} from "vitest";
import {Block,DrawStyle,Level} from "../src/core/model";
import {GameRenderer} from "../src/render/GameRenderer";
function frame(solidLeft=false){
 const level=new Level(14,7,7);level.infZone=true;
 const root=new Block(72);root.subLevel=level;level.blocksWithThisAsTheirSubLevel.push(root);
 if(solidLeft)for(let y=0;y<7;y++){const wall=new Block(y);wall.init(0,y,level,null);}
 const calls:Array<{rect:number[];fill:unknown}>=[];let rect:number[]=[];
 const g={rect:(...r:number[])=>{rect=r;return g;},fill:(fill:unknown)=>{calls.push({rect,fill});return g;},stroke:()=>g};
 const r=Object.assign(Object.create(GameRenderer.prototype),{app:{screen:{width:800,height:600},renderer:{resolution:1}},world:{drawStyle:DrawStyle.Normal},uiState:{preferences:{disableParticles:true}},textures:{centerGradient:"gradient"},onScreen:()=>true,nextSceneLayer:()=>g,nextWallLayer:()=>g});
 r.drawLevel(g,level,root,{x:100,y:100,width:400,height:400},0,new Set(),false);
 return calls.filter(c=>typeof c.fill==="object"&&(c.fill as {color?:number}).color===0xffffff&&(c.fill as {alpha?:number}).alpha===0.4);
}
describe("native infinite-zone enclosing frame",()=>{
 it("draws the source early white GUI alpha.2 frame around four open sides",()=>{
  expect(frame()).toEqual([
   {rect:[100,100,3,400],fill:{color:0xffffff,alpha:0.4}},
   {rect:[497,100,3,400],fill:{color:0xffffff,alpha:0.4}},
   {rect:[103,100,394,3],fill:{color:0xffffff,alpha:0.4}},
   {rect:[103,497,394,3],fill:{color:0xffffff,alpha:0.4}},
  ]);
 });
 it("omits an open-edge strip when its side is fully walled",()=>{expect(frame(true).map(c=>c.rect)).toEqual([[497,100,3,400],[103,100,394,3],[103,497,394,3]]);});
});
