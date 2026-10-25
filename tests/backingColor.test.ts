import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";

describe("actual native board backing color submission",()=>{
  it("uses original QUICK block texture without a center gradient",()=>{
    const root=new Block(0),level=new Level(0,9,9);root.subLevel=level;level.blocksWithThisAsTheirSubLevel.push(root);
    const calls:unknown[]=[],g={rect:()=>g,fill:(v:unknown)=>{calls.push(v);return g;}};
    const stop=new Error("stop after backing"),receiver=Object.assign(Object.create(GameRenderer.prototype),{
      app:{screen:{width:800,height:600},renderer:{resolution:1}},world:{drawStyle:DrawStyle.QuickAnim},
      uiState:{preferences:{disableParticles:true}},textures:{centerGradient:"gradient",quickBlock:"quick"},
      onScreen:()=>true,nextWallLayer:()=>{throw stop;},
    });
    expect(()=>receiver.drawLevel(g,level,root,{x:0,y:0,width:100,height:100},0,new Set(),false)).toThrow(stop);
    expect(calls).toEqual([{texture:"quick",textureSpace:"local",color:expect.any(Number)}]);
  });
  it("uses the native GUI half-color byte transfer before the center gradient",()=>{
    // third-ticket-800x600 native rawGUI=.185779378, center pixel=94.
    const root=new Block(0),level=new Level(0,9,9);
    root.color={h:0,s:0,v:0.8};root.subLevel=level;level.blocksWithThisAsTheirSubLevel.push(root);
    const calls:Array<number|object>=[];
    const g={rect:()=>g,fill:(color:number|object)=>{calls.push(color);return g;}};
    const stop=new Error("stop after native backing submission");
    const receiver=Object.assign(Object.create(GameRenderer.prototype),{
      app:{screen:{width:800,height:600},renderer:{resolution:1}},
      world:{drawStyle:DrawStyle.Normal},uiState:{preferences:{disableParticles:true}},
      textures:{centerGradient:"gradient"},onScreen:()=>true,nextWallLayer:()=>{throw stop;},
    });
    const width=491.9999957084656;
    expect(()=>receiver.drawLevel(g,level,root,{x:400-width/2,y:300-width/2,width,height:width},0,new Set(),false)).toThrow(stop);
    expect(calls[0]).toBe(0x5e5e5e);
  });
});
