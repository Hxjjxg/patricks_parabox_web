import {describe,expect,it} from "vitest";
import {Container} from "pixi.js";
import {parseLevel} from "../src/core/levelParser";
import {getLevelSource} from "../src/core/levelRepository";
import {MovementEngine} from "../src/core/movement";
import {updateWorldAnimations} from "../src/core/animation";
import {Block,DrawStyle} from "../src/core/model";
import {GameRenderer} from "../src/render/GameRenderer";
import {phantomGeometry,shouldDrawPhantom} from "../src/render/phantomRendering";

function possessFixture(){
 const world=parseLevel(getLevelSource("possess_first"),"possess_first"),engine=new MovementEngine(world);
 const context={deltaTime:1,quickAnim:false,handleActionFloor:()=>false,random:()=>.5};
 for(const [x,y]of[[-1,0],[0,-1],[0,-1],[-1,0]]){
  engine.applyDirectionalInput(x!,y!);updateWorldAnimations(world,context);updateWorldAnimations(world,context);
 }
 const donor=world.findPlayerBlock();engine.applyDirectionalInput(-1,0);
 return {world,engine,context,donor,receiver:world.findPlayerBlock()};
}

describe("native possession face transfer",()=>{
 it("changes donor draw ownership immediately while receiver stays hollow until landing",()=>{
  const {world,context,donor,receiver}=possessFixture();
  expect([donor.id,receiver.id]).toEqual([41,34]);
  expect([donor.drawIsPlayer,receiver.drawIsPlayer]).toEqual([false,false]);
  updateWorldAnimations(world,{...context,deltaTime:.25});
  expect([donor.drawIsPlayer,receiver.drawIsPlayer]).toEqual([false,false]);
  const phantom=receiver.outerLevel!.phantoms[0]!;
  expect([phantom.block,phantom.face,phantom.x,phantom.y]).toEqual([receiver,true,.5,0]);
  updateWorldAnimations(world,{...context,deltaTime:.251});
  expect([donor.drawIsPlayer,receiver.drawIsPlayer]).toEqual([false,true]);
 });
 it("uses native immediate draw ownership for undo and redo",()=>{
  const {engine,donor,receiver}=possessFixture();
  expect(engine.undo()).toBe(true);
  expect([donor.isPlayer,donor.drawIsPlayer,receiver.isPlayer,receiver.drawIsPlayer]).toEqual([true,true,false,false]);
  expect(engine.redo()).toBe(true);
  expect([donor.isPlayer,donor.drawIsPlayer,receiver.isPlayer,receiver.drawIsPlayer]).toEqual([false,false,true,true]);
 });
 it("submits moving solid eyes after every backing and the stationary hollow faces",()=>{
  const {world,context,receiver}=possessFixture();updateWorldAnimations(world,{...context,deltaTime:.25});
  const events:Array<{kind:string;id?:number;phantom?:boolean;x?:number}>=[];
  const g:object=new Proxy({},{get:()=>()=>g});
  const renderer=Object.assign(Object.create(GameRenderer.prototype),{
   app:{screen:{width:800,height:600},renderer:{resolution:1}},world,scene:new Container(),
   maskPasses:[],maskPassCount:0,textures:{centerGradient:{},walls:[],wallsFlip:[]},onScreen:()=>true,
   nextSceneLayer:()=>g,nextWallLayer:()=>g,drawFloor:()=>{},drawInfEffect:()=>{},
   drawFace:(_g:unknown,b:Block,r:{x:number},phantom=false)=>events.push({kind:"face",id:b.id,phantom,x:r.x}),
  });
  const native=renderer.drawLevel;renderer.drawLevel=(...args:unknown[])=>{events.push({kind:"backing"});return native.apply(renderer,args);};
  renderer.drawScenePass(world.rootBlock!,{x:50,y:0,width:700,height:700},0,false,null);
  const phantomIndex=events.findIndex(e=>e.phantom),lastBacking=events.map(e=>e.kind).lastIndexOf("backing");
  expect(phantomIndex).toBeGreaterThan(lastBacking);
  expect(events[phantomIndex]).toMatchObject({id:receiver.id,x:200});
  expect(events.slice(phantomIndex+1).some(e=>e.kind==="face"&&!e.phantom)).toBe(false);
 });
 it("clips alternate face representations while retaining exact entered representation scaling",()=>{
  const {world,donor,receiver}=possessFixture(),phantom=receiver.outerLevel!.phantoms[0]!;
  donor.justEnteredArray=[world.rootBlock!];
  Object.assign(phantom,{x:.5,y:.25,xScale:.4,yScale:.6});
  const cell={x:100,y:200,width:100,height:100},board={x:100,y:100,width:200,height:200},clip={x:0,y:0,width:250,height:250};
  expect(phantomGeometry(phantom,cell,board,world.rootBlock!,false,.5,clip)).toEqual({
   rect:{x:180,y:245,width:40,height:60},clip});
  expect(phantomGeometry(phantom,cell,board,new Block(99),false,.5,clip)).toEqual({
   rect:{x:150,y:225,width:100,height:100},clip:{x:100,y:100,width:150,height:150}});
 });
 it("projects outgoing face slides and squish with global phase before clipping",()=>{
  const {world,receiver}=possessFixture(),phantom=receiver.outerLevel!.phantoms[0]!;
  Object.assign(phantom,{x:.5,y:.25,xScale:.4,yScale:.6,exiting:true,exitingDX:1,xTo:1,animT:.25});
  const cell={x:100,y:200,width:100,height:100},board={x:100,y:100,width:200,height:200};
  const normal=phantomGeometry(phantom,cell,board,world.rootBlock!,false,.5,null);
  expect(normal.rect).toMatchObject({x:expect.closeTo(145),y:210,width:expect.closeTo(110),height:80});
  expect(normal.clip).toEqual(board);
  expect(phantomGeometry(phantom,cell,board,world.rootBlock!,true,.5,null).rect.x).toBeCloseTo(45);
 });
 it("uses the current entered representation for phantom exclusion and keeps GRID exception",()=>{
  const {world,receiver}=possessFixture(),phantom=receiver.outerLevel!.phantoms[0]!,clone=new Block(99);
  phantom.exitedFrom=world.rootBlock!;
  expect(shouldDrawPhantom(phantom,world.rootBlock!,DrawStyle.Normal)).toBe(false);
  expect(shouldDrawPhantom(phantom,clone,DrawStyle.Normal)).toBe(true);
  expect(shouldDrawPhantom(phantom,world.rootBlock!,DrawStyle.Grid)).toBe(true);
  expect(shouldDrawPhantom(phantom,clone,DrawStyle.QuickAnim)).toBe(false);
 });
});
