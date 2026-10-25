import font from "../assets/data/native-tui-font-metrics.json";
import type {TuiGlyph} from "./alternateStyles";

interface Glyph {advance:number;bounds:number[];frame:number[]}
const glyphs:Record<string,Glyph>=font.glyphs;
/** Original GUI LowerCenter cursor, plus independently measured ascent48. */
export function nativeTuiGlyphQuad(glyph:TuiGlyph):{frame:number[];x:number;y:number;width:number;height:number}|null{
 if(glyph.physicalFontSize!==font.fontSize)return null;
 const source=glyphs[glyph.text];if(!source)return null;
 const resolution=glyph.physicalFontSize/glyph.fontSize,rect=glyph.labelRect;
 const cursorX=rect.x+(rect.width-source.advance/resolution)/2;
 const pen=Math.ceil(cursorX*resolution-.5)/resolution;
 const cursor=rect.y+rect.height-(font.singleLineHeight-font.padding[2]!)/resolution;
 const baseline=cursor+font.hintedAscent/resolution;
 return {frame:source.frame,x:pen+source.bounds[0]!/resolution,y:baseline-source.bounds[3]!/resolution,
  width:source.frame[2]!/resolution,height:source.frame[3]!/resolution};
}
