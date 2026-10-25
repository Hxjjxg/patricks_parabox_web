import { nativeCaptionQuads, nativeFontSizes, nativeTextWidth, type NativeGlyphQuad } from "./nativeFontRendering";

export interface NativeCaptionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Bounded plain ASCII space wrapping using captured CharacterInfo.advance.
 * The three native Intro Note views corroborate this greedy space policy.
 * Universal Unity whitespace/overlong-token break rules are not recovered;
 * unsupported inputs return null so the caller can retain its text fallback.
 */
export function nativeAsciiWordWrap(text: string, fontSize: number, availableWidth: number): string | null {
  if (!nativeFontSizes[fontSize] || !Number.isFinite(availableWidth) || availableWidth <= 0 ||
    !Number.isInteger(availableWidth) || /[^\x20-\x7e\n]|[<>]/.test(text)) return null;
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    // Do not invent Unity's trimming, consecutive-space or CR/tab behavior.
    if (paragraph.startsWith(" ") || paragraph.endsWith(" ") || paragraph.includes("  ")) return null;
    if (paragraph === "") { result.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(" ")) {
      const wordWidth = nativeTextWidth(word, fontSize);
      if (wordWidth === null || wordWidth > availableWidth) return null;
      const candidate = line ? line + " " + word : word;
      const width = nativeTextWidth(candidate, fontSize);
      if (width === null) return null;
      if (line && width > availableWidth) { result.push(line); line = word; }
      else line = candidate;
    }
    result.push(line);
  }
  return result.join("\n");
}

/**
 * Physical-pixel GUI rect for DrawControl's empty-action Note. Arguments are
 * the actual native-equivalent row center and integer screen dimensions.
 * Draw.cs:5270-5284 uses float operands before SetDrawRect truncates double
 * endpoints (1308-1310). Do not round the width or height independently.
 */
export function nativeNoteCaptionRect(
  xCenter: number, yCenter: number, screenWidth: number, screenHeight: number,
): NativeCaptionRect {
  const f = Math.fround;
  const minimum = f(Math.min(screenWidth, screenHeight));
  const screenSpace = f(f(screenWidth) / f(screenHeight)) < f(1.51);
  const width = f(minimum * f(screenSpace ? 0.15 : 0.22));
  const x = f(f(xCenter) - f(width / 2));
  const y = f(f(yCenter) - width);
  const height = f(width * 2);
  return { x: Math.trunc(x), y: Math.trunc(y),
    width: Math.trunc(x + width) - Math.trunc(x),
    height: Math.trunc(y + height) - Math.trunc(y) };
}

/** Existing measured native baseline/anchor/atlas path, after bounded wrapping. */
export function nativeWrappedCaptionQuads(
  text: string, fontSize: number, rect: NativeCaptionRect,
): NativeGlyphQuad[] | null {
  // Source Note rectangles are snapped physical pixels. Transformed or scaled
  // GUI widths need separately measured native wrapping/cursor semantics.
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger)) return null;
  const wrapped = nativeAsciiWordWrap(text, fontSize, rect.width);
  return wrapped === null ? null : nativeCaptionQuads(wrapped, fontSize, rect);
}
