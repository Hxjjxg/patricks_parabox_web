import { describe,expect,it } from "vitest";
import { Block,DrawStyle,Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";
function draw(block:Block) {
  const quads:Array<{rect:number[];alpha:number}>=[];let rect:number[]=[];
  const g={rect:(...n:number[])=>{rect=n;return g;},fill:(fill:{alpha:number})=>{quads.push({rect,alpha:fill.alpha});return g;}};
  const receiver=Object.assign(Object.create(GameRenderer.prototype),{app:{screen:{width:800,height:600},renderer:{resolution:1}},world:{drawStyle:DrawStyle.Normal}});
  receiver.drawFlipShine(g,block,{x:100,y:200,width:100,height:100},false,1);return quads;
}
function flipped(){const block=new Block(1);block.subLevel=new Level(1,3,3);block.flipH=true;block.miscAnimT=1;return block;}
describe("actual native flip shine",()=>{
  it("draws the native vertical band instead of a diagonal stroke",()=>{
    expect(draw(flipped())).toEqual([{rect:[129,200,41,100],alpha:expect.closeTo(0.44,6)}]);
  });
  it("suppresses shine on filled boxes and during the native1.0to1.3 pause",()=>{
    const block=flipped();block.subLevel!.filledWithWalls=true;expect(draw(block)).toEqual([]);
    block.subLevel!.filledWithWalls=false;block.miscAnimT=2.4;expect(draw(block)).toEqual([]);
  });
  it("interpolates fadeFlipH intensity with the source flip direction",()=>{
    const block=flipped();block.fadeFlipH=true;block.animT=0.25;block.animLength=1;
    expect(draw(block)[0]!.alpha).toBeCloseTo(0.11,6);
  });
});
