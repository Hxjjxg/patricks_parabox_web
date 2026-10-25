import {describe,expect,it} from "vitest";
import {Container} from "pixi.js";
import {parseLevel} from "../src/core/levelParser";
import {getLevelSource} from "../src/core/levelRepository";
import {MovementEngine} from "../src/core/movement";
import {updateWorldAnimations} from "../src/core/animation";
import {GameRenderer} from "../src/render/GameRenderer";
function setup(){
 const world=parseLevel(getLevelSource("1by1_playerr_flip2"),"1by1_playerr_flip2"),engine=new MovementEngine(world);
 const ctx={deltaTime:1,quickAnim:false,handleActionFloor:()=>false,random:()=>0.5};
 for(let i=0;i<2;i++){engine.applyDirectionalInput(1,0);updateWorldAnimations(world,ctx);updateWorldAnimations(world,ctx);}
 return {world,engine,ctx};
}
function capture(t:number){
 const {world,engine,ctx}=setup();engine.applyDirectionalInput(0,-1);updateWorldAnimations(world,{...ctx,deltaTime:t});
 world.cameraAnimT=t;world.cameraAnimLength=.5;world.cameraMoving=t<.5;world.newCamT=t/.5;
 const passes:Array<{id:number;flip:boolean;clone:boolean}>=[],fills:unknown[]=[];
 const g={rect:()=>g,fill:(v:unknown)=>{fills.push(v);return g;}};
 const receiver=Object.assign(Object.create(GameRenderer.prototype),{app:{screen:{width:800,height:600},renderer:{resolution:1}},world,scene:new Container(),transitionScene:new Container(),sceneLayers:[],maskPasses:[],maskPassCount:0,shadowTextureCount:0,elapsed:0,inspectionBlock:null,inspectionFlipH:false,uiState:null,
 nextSceneLayer:()=>g,drawVoid:()=>{},drawControls:()=>{},drawModeOverlay:()=>{},winText:{text:"",alpha:0,position:{set:()=>{}}},
 drawScenePass:(b:{id:number},_r:unknown,_d:number,flip:boolean,_clip:unknown,clone=false)=>passes.push({id:b.id,flip,clone}),});
 receiver.draw();return {passes,fills,focus:receiver.inspectionBoard.viewBlock.id};
}
describe("native first-half clone-focus context",()=>{
 it("keeps ref104 focus and unmirrored root before half phase, suppressing previews",()=>{
  const r=capture(.1);expect(r.focus).toBe(104);
  expect(r.passes).toEqual([{id:0,flip:false,clone:false},{id:104,flip:true,clone:true}]);
 });
 it("uses canonical focus after half phase and dims main scene before old clone overlay",()=>{
  const r=capture(.3);expect(r.focus).toBe(51);expect(r.passes.at(-1)).toEqual({id:104,flip:true,clone:true});
  expect(r.fills).toContainEqual({color:0,alpha:expect.closeTo(8/9,6)});
 });
 it("makes the main scene fully black at the source .45to.55 midpoint plateau",()=>{
  expect(capture(.25).fills).toContainEqual({color:0,alpha:1});
 });
});
describe("native CameraMovedThisTurn provenance",()=>{
 it("sets on cross-level player movement and preserves state across preview probing",()=>{
  const {world,engine}=setup();expect(world).toHaveProperty("cameraMovedThisTurn",false);
  engine.applyDirectionalInput(0,-1);expect(world).toHaveProperty("cameraMovedThisTurn",true);
  engine.detectInfExitPreviews();expect(world).toHaveProperty("cameraMovedThisTurn",true);
 });
 it("does not rewrite the source flag during undo redo restart, and clears on next ordinary impulse",()=>{
  const {world,engine}=setup();engine.applyDirectionalInput(0,-1);
  expect(engine.undo()).toBe(true);expect(world).toHaveProperty("cameraMovedThisTurn",true);
  expect(engine.redo()).toBe(true);expect(world).toHaveProperty("cameraMovedThisTurn",true);
  expect(engine.restart()).toBe(true);expect(world).toHaveProperty("cameraMovedThisTurn",true);
  engine.applyDirectionalInput(1,0);expect(world).toHaveProperty("cameraMovedThisTurn",false);
 });
});
