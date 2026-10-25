import {describe,expect,it} from "vitest";
import {Container} from "pixi.js";
import {readFileSync} from "node:fs";
import {parseLevel} from "../src/core/levelParser";
import {getLevelSource} from "../src/core/levelRepository";
import {DrawStyle,WorldModel,type Block} from "../src/core/model";
import {GameRenderer} from "../src/render/GameRenderer";
import {alternateLevels,gridBoards,tuiLayout,tuiGlyphs,useAlternateDrawStyle} from "../src/render/alternateStyles";

function capture(name:string){
 const world=parseLevel(getLevelSource(name),name),passes:Array<{level:number;rect:object;depth:number;flip:boolean;clip:object|null}>=[],glyphs:Array<{text:string}>=[];
 const g:object=new Proxy({},{get:()=>()=>g});let voidCalls=0,controlCalls=0;
 const renderer=Object.assign(Object.create(GameRenderer.prototype),{
  app:{screen:{width:800,height:600},renderer:{resolution:1}},world,scene:new Container(),transitionScene:new Container(),
  sceneLayers:[],maskPasses:[],tuiLabels:[],maskPassCount:0,elapsed:0,inspectionBlock:null,inspectionFlipH:false,uiState:null,
  nextSceneLayer:()=>g,drawVoid:()=>voidCalls++,drawControls:()=>controlCalls++,drawModeOverlay:()=>{},controls:{visible:true},
  winText:{text:"",alpha:0,position:{set:()=>{}}},
  drawScenePass:(b:Block,rect:object,depth:number,flip:boolean,clip:object|null)=>passes.push({level:b.subLevel!.id,rect,depth,flip,clip}),
  drawTuiGlyph:(glyph:{text:string})=>glyphs.push(glyph),
 });renderer.draw();return {world,passes,glyphs,voidCalls,controlCalls,renderer};
}
describe("actual native alternate draw roots",()=>{
 it("draws grid_clone as four canonical unflipped self-clipped worlds on black",()=>{
  const result=capture("grid_clone");expect(result.passes).toHaveLength(4);
  expect(result.passes.map(p=>p.level)).toEqual([1,0,2,4]);
  expect(result.passes.every(p=>p.depth===0&&!p.flip&&JSON.stringify(p.rect)===JSON.stringify(p.clip))).toBe(true);
  expect(result.voidCalls).toBe(0);expect(result.controlCalls).toBe(0);
 });
 it("draws text_1 as two logical character grids without normal box rendering",()=>{
  const result=capture("text_1");expect(result.passes).toHaveLength(0);
  expect(result.glyphs).toHaveLength(100);
  expect(new Set(result.glyphs.map(g=>g.text))).toEqual(new Set(["#",".","p","b","1","2","_","="]));
  expect(result.voidCalls).toBe(0);expect(result.controlCalls).toBe(0);
 });
 it("uses the native .105 small player focus for QUICK instead of ordinary .82 zoom",()=>{
  const result=capture("oldstyle_lock_two_doors");
  expect(result.renderer.inspectionBoard.viewBlock).toBe(result.world.findPlayerBlock());
  expect(result.renderer.inspectionBoard.rect.width).toBeCloseTo(600*Math.fround(.105),6);
 });
 it("uses new QUICK transforms directly and rebases used values before player squish",()=>{
  const {world,renderer}=capture("oldstyle_lock_two_doors"),player=world.findPlayerBlock();
  Object.assign(world,{newX:.25,newY:-.2,newXS:2,newYS:3,newCamT:.8});
  Object.assign(player,{drawXScale:.8,drawYScale:1.1,flipH:true});renderer.draw();
  const rect=renderer.inspectionBoard.rect,base=600*Math.fround(.105),zoom=player.subLevel!.camZoomFactor;
  expect(rect.width).toBeCloseTo(base*2*.8,6);expect(rect.height).toBeCloseTo(base*3*1.1,6);
  expect(rect.x+rect.width/2).toBeCloseTo(400-.25*base*2,6);
  expect(rect.y+rect.height/2).toBeCloseTo(300-.2*base*3,6);
  expect([world.usedX,world.usedY,world.usedXS,world.usedYS]).toEqual([-.25*zoom,-.2*zoom,2/zoom,3/zoom]);
 });
});

describe("native alternate layout source rules",()=>{
 it("gates layouts to Playing or Paused without EndZoom or screenshot mode",()=>{
  for(const style of [DrawStyle.Grid,DrawStyle.TuiColor]){
   expect(useAlternateDrawStyle(style,"playing")).toBe(true);expect(useAlternateDrawStyle(style,"paused")).toBe(true);
   for(const mode of ["title","credits","fast-travel","gallery"])expect(useAlternateDrawStyle(style,mode)).toBe(false);
   expect(useAlternateDrawStyle(style,"playing",{endZoom:true})).toBe(false);
   expect(useAlternateDrawStyle(style,"playing",{screenshottingBlocks:true})).toBe(false);
  }
  expect(useAlternateDrawStyle(DrawStyle.Normal,"playing")).toBe(false);
 });
 it("packs four GRID cells using95percent viewport and80percent board side",()=>{
  const {world}=capture("grid_clone"),boards=gridBoards(alternateLevels(world),800,600);
  expect(boards.map(b=>b.rect)).toEqual([
   {x:143.5,y:43.5,width:228,height:228},{x:428.5,y:43.5,width:228,height:228},
   {x:143.5,y:328.5,width:228,height:228},{x:428.5,y:328.5,width:228,height:228},
  ]);
 });
 it("selects exactly two text worlds and native floor-before-division font56 at800x600",()=>{
  const {world}=capture("text_1"),levels=alternateLevels(world),layout=tuiLayout(levels,800,600);
  expect(levels.map(l=>l.id)).toEqual([0,2]);expect(layout.fontSize).toBe(Math.trunc(Math.floor(600/19)/Math.fround(.55)));
  expect(layout.fontSize).toBe(56);expect(layout.cellWidth).toBe(Math.fround(56*Math.fround(.55)));
  expect(layout.boards[0]!.left).toBe(107.39998626708984);expect(layout.boards[0]!.top).toBe(104);
  const glyph=tuiGlyphs(world,levels,layout,0)[0]!;
  expect(glyph.cell).toEqual({x:168,y:440,width:31,height:56});
  expect(glyph.labelRect).toEqual({x:168,y:384,width:31,height:112});
 });
 it("renders clones with black characters on their level color background",()=>{
  const {world}=capture("grid_clone");world.drawStyle=DrawStyle.TuiColor;
  const levels=alternateLevels(world),glyphs=tuiGlyphs(world,levels,tuiLayout(levels,800,600),0);
  const clones=glyphs.filter(g=>g.background!==null);
  expect(clones).toHaveLength(3);expect(clones.every(g=>g.color===0&&g.text==="3")).toBe(true);
 });
 it("does not include filled hidden or unvisited infinity worlds; hub keeps original order",()=>{
  const world=new WorldModel("hub"),levels=[3,9,5].map(w=>world.createLevel(w,w));
  for(const level of levels)world.createBlock(0,0,null,level);
  levels[0]!.hubShowInTravel=true;
  expect(alternateLevels(world)).toEqual([levels[0]]);
  expect(alternateLevels(world,{nexusUnlocked:true})).toEqual(levels);
  levels[1]!.getExitBlock().specialEffect=11;levels[2]!.filledWithWalls=true;
  expect(alternateLevels(world,{unlockPuzzles:true})).toEqual([levels[0]]);
 });
 it("matches all100 actual native TUI text values colors and label rectangles",()=>{
  const source=JSON.parse(readFileSync("docs/parity/evidence/original/native-tui-fixed-font-v2-20261025/tui-font-metrics.json","utf8").replace(/^\uFEFF/,""));
  const {world}=capture("text_1"),levels=alternateLevels(world),glyphs=tuiGlyphs(world,levels,tuiLayout(levels,800,600),0);
  const actual=glyphs.map(g=>({text:g.text,color:g.color,rect:[g.labelRect.x,g.labelRect.y,g.labelRect.width,g.labelRect.height]}));
  const expected=source.actualLabels.map((r:{text:string;color:number[];rect:number[]})=>({text:r.text,rect:r.rect,color:Math.round(r.color[0]!*255)*65536+Math.round(r.color[1]!*255)*256+Math.round(r.color[2]!*255)}));
  expect(actual).toEqual(expected);
 });
 it("matches all100 pre-truncation native SetDrawRect double arguments",()=>{
  const source=JSON.parse(readFileSync("docs/parity/evidence/original/native-tui-fixed-font-geometry-v3-20261025/tui-font-metrics.json","utf8").replace(/^\uFEFF/,""));
  const {world}=capture("text_1"),levels=alternateLevels(world),glyphs=tuiGlyphs(world,levels,tuiLayout(levels,800,600),0);
  expect(glyphs.map(g=>[g.nativeCell.x,g.nativeCell.y,g.nativeCell.width,g.nativeCell.height]))
   .toEqual(source.actualLabels.map((label:{setDrawRectArguments:number[]})=>label.setDrawRectArguments));
 });
});
