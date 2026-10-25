import {expect,it} from 'vitest';
import {Container,Texture} from 'pixi.js';
import {parseLevel} from '../src/core/levelParser';
import {getLevelSource} from '../src/core/levelRepository';
import {MovementEngine} from '../src/core/movement';
import {updateCameraAnimation,updateWorldAnimations} from '../src/core/animation';
import {GameRenderer} from '../src/render/GameRenderer';

it('uses the native minimum size before queueing settled infenter DD recursion',()=>{
 const world=parseLevel(getLevelSource('infenter_zone_v2'),'infenter_zone_v2'),movement=new MovementEngine(world);
 const context={deltaTime:.05,quickAnim:false,handleActionFloor:()=>false,random:()=>.5};
 for(let turn=0;turn<2;turn++){movement.applyDirectionalInput(0,-1);for(let frame=0;frame<100;frame++){updateWorldAnimations(world,context);updateCameraAnimation(world,context.deltaTime);}}
 const g:any=new Proxy({}, {get:()=>()=>g}),scene=new Container(),white=Texture.WHITE;
 const textures=new Proxy({walls:Array(16).fill(white),wallsFlip:Array(16).fill(white),wallsBig:Array(16).fill(white),wallsBigFlip:Array(16).fill(white)},{get:(o,k)=>o[k as keyof typeof o]??white});
 const r=Object.assign(Object.create(GameRenderer.prototype),{
  app:{screen:{width:800,height:600},renderer:{resolution:1}},world,scene,transitionScene:new Container(),textures,
  sceneLayers:[],maskPasses:[],maskPassCount:0,sceneLayerCount:0,elapsed:10,inspectionBlock:null,inspectionFlipH:false,uiState:null,
  nextSceneLayer(){this.sceneLayerCount++;return g;},nextWallLayer(){return this.nextSceneLayer();},
  maskedScene(clip:any){if(clip)this.maskPassCount++;return scene;},shadowTexture:(t:Texture)=>t,
  drawVoid:()=>{},drawControls:()=>{},drawModeOverlay:()=>{},controls:{visible:true},
  winText:{text:'',alpha:0,position:{set:()=>{}}},
 });
 const original=r.drawLevel,counts:{levels:number;maxDepth:number;regions:Record<string,number>}={levels:0,maxDepth:0,regions:{}};
 r.drawLevel=function(...args:any[]){
  counts.levels++;counts.maxDepth=Math.max(counts.maxDepth,args[4]);counts.regions[args[1].id]=(counts.regions[args[1].id]??0)+1;
  return original.apply(this,args);
 };
 r.draw();
 expect({id:world.findPlayerBlock().id,x:world.findPlayerBlock().x,y:world.findPlayerBlock().y,outer:world.findPlayerBlock().outerLevel?.id}).toEqual({id:57,x:4,y:2,outer:0});
 expect(world.anyBlockMoving).toBe(false);expect(world.cameraMoving).toBe(false);
 // Native final level4 width6.074px is accepted, but its2.024px children are not.
 // Source5.4px policy therefore gives3*(1+4+16)=63 copies, not4095.
 expect(counts.regions[4]).toBe(63);expect(counts.maxDepth).toBe(3);
 expect(counts.levels).toBe(72);expect(r.sceneLayerCount).toBe(218);
});
