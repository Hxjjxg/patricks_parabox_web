import { describe, expect, it } from "vitest";
import { nativeFocusRect } from "../src/render/focusGeometry";
import { originalDrawRect } from "../src/render/wallRendering";

function center(rect: ReturnType<typeof nativeFocusRect>): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

describe("native physical framebuffer focus precision", () => {
  it("matches actual native2002x1398 focus and raw draw bounds for both odd CSS axes", () => {
    // native-framebuffer-2002x1398-first-puzzle-v15-20261025/colors.json:
    // focusGeometry=[1001,699,1146.3599900007248,1146.3599900007248].
    // Three native PNGs and two frozen Web PNGs confirmed the old Web
    // border endpoints were exactly one physical pixel left/up.
    const web = nativeFocusRect(1001, 699, 1, 1, 0, 0, 0.82, 2);
    expect(center(web).map((value) => value * 2)).toEqual([1001, 699]);
    expect(web.width * 2).toBe(1146.3599900007248);
    expect(web.height * 2).toBe(1146.3599900007248);
    const draw = originalDrawRect(web, 2);
    expect([draw.x, draw.y, draw.width, draw.height].map((value) => value * 2))
      .toEqual([427, 125, 1147, 1147]);
  });

  it("predicts matching centers for the verified even CSS control", () => {
    const currentWeb = nativeFocusRect(800, 600, 1, 1, 0, 0, 0.82, 2);
    const nativePhysicalPrediction = nativeFocusRect(1600, 1200, 1, 1, 0, 0);
    expect(center(currentWeb).map((value) => value * 2)).toEqual([800, 600]);
    expect(center(nativePhysicalPrediction)).toEqual([800, 600]);
  });

  it("preserves native1x center truncation for odd CSS axes", () => {
    expect(center(nativeFocusRect(1001, 699, 1, 1, 0, 0))).toEqual([500, 349]);
  });
});
