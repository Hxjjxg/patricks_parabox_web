import {describe,expect,it} from "vitest";
import {Block,Level} from "../src/core/model";
import {cloneIntensity,cloneTransitionOpacity,flipIntensity} from "../src/render/cloneFocusRendering";
import {faceQuads} from "../src/render/faceRendering";
import {infinityGlyphQuads} from "../src/render/infinityRendering";
function representations(){const level=new Level(1,1,1),canonical=new Block(1),reference=new Block(2);canonical.subLevel=level;reference.subLevel=level;level.blocksWithThisAsTheirSubLevel.push(canonical,reference);return {canonical,reference,level};}
const rect={x:100,y:100,width:100,height:100};
describe("native root cloneFade appearance",()=>{
 it("fades clone tint toward canonical tint using global transition phase",()=>{
  const {canonical,reference}=representations();
  expect(cloneIntensity(canonical)).toBe(0);expect(cloneIntensity(reference)).toBe(1);
  expect(cloneIntensity(reference,true,.25)).toBe(.75);
  expect(cloneIntensity(reference,true,1)).toBe(0);
 });
 it("interpolates flip intensity across the old and canonical representations",()=>{
  const {reference}=representations();reference.flipH=true;
  expect(flipIntensity(reference,.25,false)).toBe(1);
  expect(flipIntensity(reference,.25,true)).toBe(.75);
  reference.fadeFlipH=true;expect(flipIntensity(reference,.25,true)).toBe(.1875);
 });
 it("fades clone infinity glyph alpha without changing geometry",()=>{
  const {reference,level}=representations();reference.isSomeInfExitBlock=true;level.infExitBlocks.push(reference);
  const normal=infinityGlyphQuads(reference,rect,600),fade=infinityGlyphQuads(reference,rect,600,1,true,.5);
  expect(fade[0]!.rect).toEqual(normal[0]!.rect);expect(fade[0]!.alpha).toBeCloseTo(normal[0]!.alpha*.5,6);
 });
 it("interpolates face visibility toward the canonical representation",()=>{
  const {reference}=representations();reference.isPlayer=true;reference.drawIsPlayer=true;reference.faceAnimT=1;
  const normal=faceQuads(reference,rect,600,false),fade=faceQuads(reference,rect,600,false,1,false,true,.5);
  expect(fade[0]!.rect).toEqual(normal[0]!.rect);expect(fade[0]!.alpha).toBeCloseTo(normal[0]!.alpha*.5,6);
 });
 it("uses the exact native midpoint fade boundaries",()=>{
  expect(cloneTransitionOpacity(0)).toBe(0);expect(cloneTransitionOpacity(.225)).toBe(.5);
  expect(cloneTransitionOpacity(.45)).toBe(1);expect(cloneTransitionOpacity(.55)).toBe(1);
  expect(cloneTransitionOpacity(.775)).toBeCloseTo(.5,6);expect(cloneTransitionOpacity(1)).toBe(0);
 });
});
