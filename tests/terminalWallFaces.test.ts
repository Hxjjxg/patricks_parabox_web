import {expect, it} from 'vitest';
import {updateCameraAnimation, updateWorldAnimations} from '../src/core/animation';
import {parseLevel} from '../src/core/levelParser';
import {getLevelSource} from '../src/core/levelRepository';
import {MovementEngine} from '../src/core/movement';
import {GameRenderer} from '../src/render/GameRenderer';
import {faceQuads} from '../src/render/faceRendering';

const board={x:154,y:54,width:492,height:492};
const context={deltaTime:1,quickAnim:false,handleActionFloor:()=>false,random:()=>.5};
function record(phase:number,flipH=false,clip:typeof board|null=null){
 const world=parseLevel(getLevelSource('infenter_poswall_setup'),'infenter_poswall_setup'),engine=new MovementEngine(world);
 for(const [index,command] of [...'LLLR'].entries()){
  engine.applyDirectionalInput(command==='L'?-1:1,0);
  if(index<3)for(let frame=0;frame<2;frame++){updateWorldAnimations(world,context);updateCameraAnimation(world,1);}
 }
 updateWorldAnimations(world,{...context,deltaTime:phase*.5});updateCameraAnimation(world,phase*.5);
 const events:any[]=[],r:any=Object.create(GameRenderer.prototype);let layer=0;
 const graphics=(kind:string)=>{const o:any={kind,layer:layer++,clip:r.activeSceneContainer?.clip??null};const g:any=new Proxy(o,{get:(obj,key)=>key in obj?obj[key]:()=>g});return g;};
 Object.assign(r,{world,app:{screen:{width:800,height:600},renderer:{resolution:1}},scene:{clip:null},elapsed:0,
  uiState:{preferences:{disableParticles:true}},textures:{centerGradient:{},walls:[],wallsFlip:[],eye:'eye',eyeSmall:'eyeSmall',eyeClosed:'eyeClosed',eyeClosedSmall:'eyeClosedSmall',possessEye:'possessEye',possessEyeSmall:'possessEyeSmall'},
  maskedScene:(c:typeof board|null)=>({clip:c}),nextSceneLayer:()=>graphics('scene'),nextWallLayer:()=>graphics('wall'),drawFloor(){},drawInfEffect(){},drawFlipShine(){},
  drawWall(g:any,level:any,block:any,rect:any){events.push({kind:'wall',g,block,rect,level,owner:r.currentTicket?.block.subLevel});},
 });
 const nativeFace=r.drawFace;r.drawFace=function(g:any,block:any,rect:any,facePhantom=false,eyeFlip=false,cloneFade=false){events.push({kind:'face',g,block,rect,facePhantom,eyeFlip,cloneFade,quads:faceQuads(block,rect,600,eyeFlip,1,facePhantom,cloneFade)});return nativeFace.call(this,g,block,rect,facePhantom,eyeFlip,cloneFade);};
 r.drawScenePass(world.rootBlock!,board,0,flipH,clip);
 // Old-cell phantom shares the player and logical outer level; require the current drawing owner too.
 const targets=events.filter(e=>e.kind==='wall'&&(e.block.isPlayer||e.block.possessable)&&e.level===world.rootBlock!.subLevel&&e.owner===e.level);
 return {world,events,targets};
}

it('submits visible faces for the actual LLLR terminal current bodies',()=>{
 const {world,events,targets}=record(.25);expect(world.findPlayerBlock().id).toBe(16);expect(targets.some(e=>e.block.id===16)).toBe(true);expect(targets.some(e=>e.block.possessable&&!e.block.isPlayer)).toBe(true);
 for(const wall of targets){expect(faceQuads(wall.block,wall.rect,600,false).every(q=>q.alpha>0&&q.rect.width>0&&q.rect.height>0)).toBe(true);expect(events.some(e=>e.kind==='face'&&e.block===wall.block&&e.rect===wall.rect)).toBe(true);}
});



it.each([.25,.5,.75])('retains native terminal face alpha and per-wall ordering at LLLR phase %s',(phase)=>{
 const {events,targets}=record(phase);expect(targets.map(e=>e.block.id).sort()).toEqual([15,16]);
 for(const wall of targets){const index=events.indexOf(wall),face=events[index+1];expect(face).toMatchObject({kind:'face',block:wall.block,rect:wall.rect,facePhantom:false,eyeFlip:false,cloneFade:false});expect(face.quads).toHaveLength(2);expect(face.quads.every((q:any)=>q.alpha>0&&q.rect.width>0&&q.rect.height>0)).toBe(true);expect(face.g.kind).toBe('scene');expect(face.g.layer).toBeGreaterThan(wall.g.layer);for(const later of events.slice(index+2).filter(e=>e.kind==='wall'))expect(later.g.layer).toBeGreaterThan(face.g.layer);}
});

it.each([false,true])('inherits clip and native terminal face argument convention when parent flip=%s',(flip)=>{
 const clip={x:170,y:70,width:430,height:440},{events,targets}=record(.5,flip,clip);expect(targets).toHaveLength(2);
 for(const wall of targets){const face=events[events.indexOf(wall)+1];expect(face).toMatchObject({kind:'face',block:wall.block,rect:wall.rect,facePhantom:flip,eyeFlip:false,cloneFade:false});expect(wall.g.clip).toEqual(clip);expect(face.g.clip).toEqual(clip);expect(face.g.layer).toBeGreaterThan(wall.g.layer);}
});
