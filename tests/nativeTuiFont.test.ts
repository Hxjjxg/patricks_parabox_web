import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {Container,Sprite,Texture,TextureSource} from "pixi.js";
import {parseLevel} from "../src/core/levelParser";
import {getLevelSource} from "../src/core/levelRepository";
import {alternateLevels,tuiGlyphs,tuiLayout} from "../src/render/alternateStyles";
import {nativeTuiGlyphQuad} from "../src/render/nativeTuiFont";
import font from "../src/assets/data/native-tui-font-metrics.json";
import {readRgbaPng} from "./helpers/readRgbaPng";
import {GameRenderer} from "../src/render/GameRenderer";

describe("original TUI Inconsolata atlas placement",()=>{
 it("uses native cursor plus hinted ascent for every one of100 captured labels",()=>{
  const original=JSON.parse(readFileSync("docs/parity/evidence/original/native-tui-fixed-font-v2-20261025/tui-font-metrics.json","utf8").replace(/^\uFEFF/,""));
  const world=parseLevel(getLevelSource("text_1"),"text_1"),levels=alternateLevels(world);
  const glyphs=tuiGlyphs(world,levels,tuiLayout(levels,800,600),0);
  for(let i=0;i<glyphs.length;i++){
   const glyph=glyphs[i]!,captured=original.actualLabels[i],quad=nativeTuiGlyphQuad(glyph)!;
   const source=original.metrics[0].glyphs.find((g:{character:string})=>g.character===glyph.text);
   expect(quad.x).toBe(Math.ceil(captured.cursor0[0]-.5)+source.bounds[0]);
   expect(quad.y).toBe(captured.cursor0[1]+48-source.bounds[3]);
   expect([quad.width,quad.height]).toEqual([source.bounds[2]-source.bounds[0],source.bounds[3]-source.bounds[1]]);
  }
 });
 it("preserves original95ASCII advances and all glyph bounds without browser shaping",()=>{
  expect(Object.keys(font.glyphs)).toHaveLength(95);expect(font.hintedAscent).toBe(48);
  expect(font.glyphs["#"].advance).toBe(28);expect(font.glyphs["#"].bounds).toEqual([0,-1,29,37]);
 });
 it("preserves every original alpha sample including rotated atlas slots",()=>{
  const root=font.source+"/",source=JSON.parse(readFileSync(root+"tui-font-metrics.json","utf8").replace(/^\uFEFF/,""));
  const native=readRgbaPng(root+"font-atlas.png"),packed=readRgbaPng("src/assets/fonts/native-inconsolata-atlas.png");
  const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
  expect(hash(root+"font-atlas.png")).toBe(font.sourceAtlasSha256);
  expect(hash(root+"tui-font-metrics.json")).toBe(font.sourceMetricsSha256);
  expect(hash("src/assets/fonts/native-inconsolata-atlas.png")).toBe(font.atlasSha256);
  let mismatches=0,samples=0;
  for(const glyph of source.metrics[0].glyphs){
   const target=(font.glyphs as Record<string,{advance:number;bounds:number[];frame:number[]}>)[glyph.character]!;
   expect(target.advance).toBe(glyph.advance);expect(target.bounds).toEqual(glyph.bounds);
   const [x,y,w,h]=target.frame as [number,number,number,number],tl=glyph.uvTopLeft,tr=glyph.uvTopRight,bl=glyph.uvBottomLeft;
   for(let gy=0;gy<h;gy++)for(let gx=0;gx<w;gx++){
    const u=tl[0]+(tr[0]-tl[0])*(gx+.5)/w+(bl[0]-tl[0])*(gy+.5)/h;
    const v=tl[1]+(tr[1]-tl[1])*(gx+.5)/w+(bl[1]-tl[1])*(gy+.5)/h;
    const a=native.pixels[(Math.floor((1-v)*native.height)*native.width+Math.floor(u*native.width))*4+3];
    const offset=((y+gy)*packed.width+x+gx)*4;
    if(packed.pixels[offset]!==255||packed.pixels[offset+1]!==255||packed.pixels[offset+2]!==255||packed.pixels[offset+3]!==a)mismatches++;
    samples++;
   }
  }
  expect(samples).toBeGreaterThan(50000);expect(mismatches).toBe(0);
 });
 it("draws framed native glyphs as pooled sprites rather than whole-atlas Graphics fills",()=>{
  const world=parseLevel(getLevelSource("text_1"),"text_1"),levels=alternateLevels(world);
  const glyph=tuiGlyphs(world,levels,tuiLayout(levels,800,600),0)[0]!;
  const scene=new Container(),renderer=Object.assign(Object.create(GameRenderer.prototype),{
   app:{renderer:{resolution:1}},scene,tuiNativeSprites:[],tuiNativeSpriteCount:0,tuiGlyphTextures:new Map(),
   textures:{nativeTuiAtlas:new Texture({source:new TextureSource({width:512,height:512})})},
   nextSceneLayer:()=>{throw new Error("Native glyph must use framed Sprite");},
  });
  renderer.drawTuiGlyph(glyph);expect(scene.children).toHaveLength(1);
  const sprite=scene.children[0] as Sprite,quad=nativeTuiGlyphQuad(glyph)!;
  expect(sprite).toBeInstanceOf(Sprite);expect([sprite.texture.frame.x,sprite.texture.frame.y,sprite.texture.frame.width,sprite.texture.frame.height]).toEqual(quad.frame);
  expect([sprite.x,sprite.y,sprite.width,sprite.height]).toEqual([quad.x,quad.y,quad.width,quad.height]);
  renderer.tuiNativeSpriteCount=0;renderer.drawTuiGlyph(glyph);expect(scene.children).toHaveLength(1);
 });
});
