import { describe, expect, it } from "vitest";
import { nativeFocusRect, pixelResolution } from "../src/render/focusGeometry";
import { originalDrawRect } from "../src/render/wallRendering";

describe("native focus rectangle precision", () => {
  it.each([
    [800, 600, 400, 300, 491.9999957084656, [154, 54, 491, 491]],
    [1001, 733, 500, 366, 601.0599947571754, [199, 65, 601, 601]],
    [1280, 720, 640, 360, 590.3999948501587, [344, 64, 591, 591]],
  ] as const)("matches actual native ticket and drawRect at%ix%i", (width, height, x, y, size, snapped) => {
    const rect = nativeFocusRect(width, height, 1, 1, 0, 0);
    expect(rect.width).toBe(size);
    expect(rect.x + rect.width / 2).toBe(x);
    expect(rect.y + rect.height / 2).toBe(y);
    const result = originalDrawRect(rect, 1);
    expect([result.x, result.y, result.width, result.height]).toEqual(snapped);
  });
  it("eliminates emulated integer device-scale noise without rounding fractional displays", () => {
    expect(pixelResolution(1.0000000298023224)).toBe(1);
    expect(pixelResolution(2.0000000596046448)).toBe(2);
    expect(pixelResolution(1.25)).toBe(1.25);
  });
});
