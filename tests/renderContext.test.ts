import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import { Block, DrawStyle, Level } from "../src/core/model";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";
import { updateWorldAnimations } from "../src/core/animation";
import { GameRenderer } from "../src/render/GameRenderer";
import { previewClip, shouldSimpleSlide, simpleSlideRect, stackClip } from "../src/render/renderContext";

function actualRrd() {
  const world=parseLevel(getLevelSource("1by1_playerr_flip2"),"1by1_playerr_flip2");
  const movement=new MovementEngine(world), context={deltaTime:1,quickAnim:false,handleActionFloor:()=>false,random:()=>0.5};
  for (let i=0;i<2;i++) {movement.applyDirectionalInput(1,0);updateWorldAnimations(world,context);updateWorldAnimations(world,context);}
  movement.applyDirectionalInput(0,-1);
  updateWorldAnimations(world,{...context,deltaTime:0.125});
  return world;
}

describe("native render ticket context",()=>{
  it("uses the actual RRD entered representation104 only for its projected occurrence",()=>{
    const world=actualRrd(),player=world.findPlayerBlock(),entered=world.blocks.find(b=>b.id===104)!;
    expect(player.justEnteredArray?.[0]).toBe(entered);
    expect(shouldSimpleSlide({block:entered,parents:[],depth:0},player,DrawStyle.Normal)).toBe(false);
    expect(shouldSimpleSlide({block:player,parents:[],depth:0},player,DrawStyle.Normal)).toBe(true);
    const simple=simpleSlideRect(player,{x:0,y:0,width:100,height:100},false,0.25);
    expect(simple.width).toBe(85);expect(simple.height).toBe(107.5);
    expect(player.drawXScale).not.toBe(1);
  });
  it("does not substitute simple slides inside native infinity zones",()=>{
    const world=actualRrd(),player=world.findPlayerBlock();
    const zone=new Level(90,7,7);zone.infZone=true;const block=new Block(90);block.subLevel=zone;
    expect(shouldSimpleSlide({block,parents:[],depth:0},player,DrawStyle.Normal)).toBe(false);
  });
  it("clips previews outside the ancestor rectangle using initial flip parity",()=>{
    const rect={x:100,y:50,width:400,height:400};
    expect(previewClip({dx:1,dy:0},rect,false,800,600)).toEqual({x:500,y:0,width:300,height:600});
    expect(previewClip({dx:1,dy:0},rect,true,800,600)).toEqual({x:0,y:0,width:100,height:600});
    expect(previewClip({dx:0,dy:1},rect,false,800,600)).toEqual({x:0,y:0,width:800,height:50});
    expect(previewClip({dx:0,dy:-1},rect,false,800,600)).toEqual({x:0,y:450,width:800,height:150});
  });
  it("intersects inherited preview clips when simple-slide tickets require their parent bounds",()=>{
    expect(stackClip({x:0,y:0,width:300,height:600},{x:100,y:50,width:400,height:400})).toEqual({x:100,y:50,width:200,height:400});
  });
  it("draws all recursive backing tickets before player face tickets",()=>{
    const level=new Level(1,1,1),root=new Block(1),player=new Block(2);
    root.subLevel=level;player.init(0,0,level,level);player.isPlayer=true;player.drawIsPlayer=true;level.blockList.push(player);
    const events:string[]=[];
    const g={rect:()=>g,fill:()=>g,stroke:()=>g};
    const receiver=Object.assign(Object.create(GameRenderer.prototype),{
      app:{screen:{width:800,height:600},renderer:{resolution:1}},world:{drawStyle:DrawStyle.Normal},scene:new Container(),
      maskPasses:[],maskPassCount:0,textures:{centerGradient:{}},onScreen:()=>true,
      nextSceneLayer:()=>g,nextWallLayer:()=>g,drawFace:()=>events.push("face"),
      drawInfEffect:()=>{},
    });
    const nativeDrawLevel=receiver.drawLevel;
    receiver.drawLevel=(...args:unknown[])=>{events.push("backing");return nativeDrawLevel.apply(receiver,args);};
    receiver.drawScenePass(root,{x:100,y:100,width:300,height:300},-3,false,null);
    expect(events.filter(event=>event==="backing")).toHaveLength(18);
    expect(events.filter(event=>event==="face")).toHaveLength(17);
    expect(events.lastIndexOf("backing")).toBeLessThan(events.indexOf("face"));
  });
});
