import fontData from "../assets/data/native-font-metrics.json";

export interface NativeGlyph {
  readonly advance: number;
  readonly bounds: readonly number[];
  readonly frame: readonly number[];
}
export interface NativeFontSize {
  readonly lineHeight: number;
  readonly singleLineHeight: number;
  readonly glyphs: Readonly<Record<string, NativeGlyph>>;
}
export interface NativeGlyphQuad {
  readonly character: string;
  readonly frame: readonly number[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const nativeFontSizes: Readonly<Record<string, NativeFontSize>> = fontData.sizes;

/** Native CharacterInfo.advance, with no Canvas shaping or letter spacing. */
export function nativeTextWidth(text: string, fontSize: number): number | null {
  const font = nativeFontSizes[fontSize];
  if (!font) return null;
  let width = 0;
  for (const character of text) {
    const glyph = font.glyphs[character];
    if (!glyph) return null;
    width += glyph.advance;
  }
  return width;
}

/**
 * One baseline-aligned line of original glyphs. GUIStyle placement is supplied
 * separately; do not infer a baseline from Canvas metrics or atlas dimensions.
 */
export function nativeGlyphQuads(
  text: string, fontSize: number, penX: number, baseline: number,
): NativeGlyphQuad[] | null {
  const font = nativeFontSizes[fontSize];
  if (!font || nativeTextWidth(text, fontSize) === null) return null;
  const result: NativeGlyphQuad[] = [];
  for (const character of text) {
    const glyph = font.glyphs[character]!;
    const [left, , , top] = glyph.bounds;
    const [, , width, height] = glyph.frame;
    result.push({ character, frame: glyph.frame, x: penX + left!, y: baseline - top!,
      width: width!, height: height! });
    penX += glyph.advance;
  }
  return result;
}
