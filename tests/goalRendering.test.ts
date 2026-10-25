import { describe,expect,it } from "vitest";
import { Block,DrawStyle,Floor,FloorType,Level,WorldModel } from "../src/core/model";
import { goalStrips, goalTint } from "../src/render/goalRendering";
import { GameRenderer } from "../src/render/GameRenderer";
function goal(type=FloorType.Button,style=DrawStyle.Normal,width=100,active=false,animationT=0) {
  const level=new Level(1,3,3),root=new Block(1);root.subLevel=level;root.color={h:0.6,s:0.8,v:1};level.blocksWithThisAsTheirSubLevel.push(root);
  const floor=new Floor(1,1,1,level,type);floor.animationT=animationT;
  const calls:Array<{rect:number[];color:number;alpha?:number;texture?:string}>=[];let rect:number[]=[];
  const g={rect:(...n:number[])=>{rect=n;return g;},fill:(fill:{color:number;alpha?:number;texture?:string})=>{calls.push({rect,...fill});return g;}};
  const receiver=Object.assign(Object.create(GameRenderer.prototype),{app:{screen:{width:800,height:600},renderer:{resolution:1}},
    world:{levelName:"shed_first",drawStyle:style,finishesSatisfied:active,buttonsSatisfied:active},
    textures:{button:"oldButton",playerButton:"oldPlayerButton",playerButtonEyes:"eyes",playerButtonEyesSmall:"eyesSmall",quickButton:"quick",quickPlayerButton:"quickPlayer"}});
  receiver.drawFloor(g,type,{x:100,y:200,width,height:100},level,floor);return calls;
}
describe("actual native normal goal strips",()=>{
  it("draws four source-inset float-snapped strips with canonical HSV tint and0.6alpha",()=>{
    const calls=goal();expect(calls).toHaveLength(4);
    expect(calls.map(call=>call.rect)).toEqual([[106,206,87,7],[106,286,87,7],[106,213,7,73],[186,213,7,73]]);
    expect(calls.every(call=>call.texture===undefined && call.color===0x66a4ff)).toBe(true);
    expect(calls[0]!.alpha).toBeCloseTo(0.6,6);
  });
  it("adds the native player-only eyes texture with strict200px size threshold",()=>{
    expect(goal(FloorType.PlayerButton,DrawStyle.Normal,200).at(-1)?.texture).toBe("eyesSmall");
    expect(goal(FloorType.PlayerButton,DrawStyle.Normal,201).at(-1)?.texture).toBe("eyes");
  });
  it.each([[FloorType.Button,"quick"],[FloorType.PlayerButton,"quickPlayer"]] as const)("uses the native QuickAnim texture for%s",(type,texture)=>{
    const calls=goal(type,DrawStyle.QuickAnim);expect(calls).toHaveLength(1);expect(calls[0]!.texture).toBe(texture);
    expect(calls[0]!.rect).toEqual([100,200,100,100]);
  });
  it("uses native active floor glow alpha without forcing opaque white",()=>{
    expect(goal(FloorType.Button,DrawStyle.Normal,100,true,0.5)[0]!.alpha).toBeCloseTo(0.2,6);
  });
});

describe("native goal geometry and lifecycle",()=>{
  it("rounds half-thickness to even and enforces the native tiny-strip threshold",()=>{
    const r={x:0,y:0,width:200,height:200};
    expect(goalStrips(r)[0]!.height).toBe(14);
    expect(goalStrips({...r,width:10,height:10})[0]!.height).toBe(1);
    expect(goalStrips({...r,width:2,height:2})[0]!.height).toBe(0);
  });
  it("computes float geometry in physical pixels at high DPR",()=>{
    const physical=goalStrips({x:100,y:200,width:100,height:100});
    const dpr=goalStrips({x:50,y:100,width:50,height:50},2);
    expect(dpr.map(r=>({x:r.x*2,y:r.y*2,width:r.width*2,height:r.height*2}))).toEqual(physical);
  });
  it("retains canonical tint during glow and honors delay plus inactive hub alpha",()=>{
    const color={h:0.6,s:0.8,v:1};
    expect(goalTint(color,true,0.5).color).toBe(goalTint(color,false,0).color);
    expect(goalTint(color,true,0.5,false,1,true).alpha).toBeCloseTo(0.6,6);
    expect(goalTint(color,false,0,true,0.82)).toEqual({color:0x0a1c34,alpha:1});
  });
  it.each([FloorType.Button,FloorType.PlayerButton])("advances%s phase independently of activation and pause, but honors delay",type=>{
    const world=new WorldModel("goal-clock"),level=new Level(0,3,3);
    const floor=new Floor(0,1,1,level,type);world.floors.push(floor);
    world.updateFloorAnimations(0.25);expect(floor.animationT).toBe(0.25);
    world.updateFloorAnimations(0.25,true);expect(floor.animationT).toBe(0.5);
    world.delayFinishGlow=true;world.updateFloorAnimations(1);expect(floor.animationT).toBe(0.5);
    world.delayFinishGlow=false;world.updateFloorAnimations(-1);expect(floor.animationT).toBe(0.5);
  });
});
