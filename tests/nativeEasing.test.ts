import { describe, expect, it } from "vitest";
import { quadInOut } from "../src/core/animation";

describe("native Util.QuadInOut", () => {
  // Util.cs16–23: k*=2; first branch .5*k*k; second branch
  // -.5*((k-=1)*(k-2)-1). Assignment precedes the next multiplicand.
  it.each([[0, 0], [0.25, 0.125], [0.5, 0.5], [0.75, 0.875], [1, 1]])(
    "matches native input%f →%f", (input, expected) => {
      expect(quadInOut(input!)).toBe(expected);
    },
  );
  it("retains the native reflection symmetry about the midpoint", () => {
    for (const input of [0.1, 0.2, 0.3, 0.4]) {
      expect(quadInOut(input) + quadInOut(1 - input)).toBeCloseTo(1, 14);
    }
  });
});
