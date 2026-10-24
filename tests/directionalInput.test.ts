import { describe, expect, it } from "vitest";
import { DirectionalInput } from "../src/core/directionalInput";

describe("single-player directional input stack", () => {
  it("emits once immediately and then repeats at the original delay", () => {
    const input = new DirectionalInput(70);
    expect(input.press("w", { dx: 0, dy: 1 })).toEqual({
      dx: 0,
      dy: 1,
    });
    expect(input.press("w", { dx: 0, dy: 1 })).toBeNull();
    expect(input.tick(0.07)).toBeNull();
    expect(input.tick(0.001)).toEqual({ dx: 0, dy: 1 });
    expect(input.tick(0.03)).toBeNull();
  });

  it("uses the most recently activated logical direction", () => {
    const input = new DirectionalInput();
    input.press("w", { dx: 0, dy: 1 });
    expect(input.press("d", { dx: 1, dy: 0 })).toEqual({
      dx: 1,
      dy: 0,
    });
    expect(input.current()).toEqual({ dx: 1, dy: 0 });

    expect(input.release("d")).toEqual({ dx: 0, dy: 1 });
    expect(input.release("w")).toBeNull();
    expect(input.current()).toBeNull();
  });

  it("coalesces multiple physical bindings for one direction", () => {
    const input = new DirectionalInput();
    expect(input.press("w", { dx: 0, dy: 1 })).not.toBeNull();
    expect(
      input.press("arrowup", { dx: 0, dy: 1 }),
    ).toBeNull();
    expect(input.release("w")).toBeNull();
    expect(input.current()).toEqual({ dx: 0, dy: 1 });
    expect(input.release("arrowup")).toBeNull();
    expect(input.current()).toBeNull();
  });

  it("clears held state across level and mode changes", () => {
    const input = new DirectionalInput();
    input.press("a", { dx: -1, dy: 0 });
    input.reset();
    expect(input.current()).toBeNull();
    expect(input.tick(1)).toBeNull();
  });

  it("updates repeat delay at runtime and treats 501 as disabled", () => {
    const input = new DirectionalInput(70);
    input.press("d", { dx: 1, dy: 0 });
    input.setMoveDelayMilliseconds(501);
    expect(input.tick(60)).toBeNull();

    input.setMoveDelayMilliseconds(20);
    expect(input.tick(0.02)).toBeNull();
    expect(input.tick(0.001)).toEqual({ dx: 1, dy: 0 });
  });
});

describe("directional repeat timing", () => {
  it("does not accumulate repeat time while repeats are blocked", () => {
    const input = new DirectionalInput(70);
    expect(input.press("d", { dx: 1, dy: 0 })).toEqual({ dx: 1, dy: 0 });
    expect(input.tick(0.2, false)).toBeNull();
    // Only the time where repeats were allowed counts.
    expect(input.tick(0.05, true)).toBeNull();
    expect(input.tick(0.03, true)).toEqual({ dx: 1, dy: 0 });
  });

  it("restarts the repeat delay on a new direction", () => {
    const input = new DirectionalInput(70);
    input.press("d", { dx: 1, dy: 0 });
    expect(input.tick(0.06)).toBeNull();
    expect(input.press("w", { dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 1 });
    expect(input.tick(0.06)).toBeNull();
    expect(input.tick(0.02)).toEqual({ dx: 0, dy: 1 });
  });
});
