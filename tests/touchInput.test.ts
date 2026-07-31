import { describe, expect, it } from "vitest";
import { DirectionalInput } from "../src/core/directionalInput";
import { TouchSwipeInput } from "../src/core/touchInput";

describe("mobile swipe input", () => {
  it("uses the original min-viewport threshold and keeps short gestures as taps", () => {
    const input = new TouchSwipeInput();
    expect(input.start(7, 10, 20)).toBe(true);
    expect(input.move(7, 10 + 79, 20, 1200, 1200)).toBeNull();
    expect(input.move(7, 10 + 81, 20, 1200, 1200)).toEqual({
      dx: 1,
      dy: 0,
    });
    expect(input.end(7)).toEqual({ accepted: true, moved: true });
    expect(input.active).toBe(false);

    expect(input.start(8, 0, 0)).toBe(true);
    expect(input.end(8)).toEqual({ accepted: true, moved: false });
  });

  it("chooses the dominant axis, maps screen y to game up/down, and re-arms", () => {
    const input = new TouchSwipeInput();
    input.start(1, 100, 100);

    expect(input.move(1, 130, 20, 900, 900)).toEqual({
      dx: 0,
      dy: 1,
    });
    expect(input.move(1, 100, 190, 900, 900)).toEqual({
      dx: 0,
      dy: -1,
    });
    expect(input.move(1, 0, 190, 900, 900)).toEqual({
      dx: -1,
      dy: 0,
    });
  });

  it("ignores other pointers and cancels cleanly", () => {
    const input = new TouchSwipeInput();
    expect(input.start(3, 0, 0)).toBe(true);
    expect(input.start(4, 0, 0)).toBe(false);
    expect(input.move(4, 200, 0, 600, 600)).toBeNull();
    expect(input.cancel(4)).toBe(false);
    expect(input.cancel(3)).toBe(true);
    expect(input.end(3)).toEqual({ accepted: false, moved: false });
  });

  it("can feed the shared repeat stack until the touch is released", () => {
    const touch = new TouchSwipeInput();
    const directions = new DirectionalInput(70);
    touch.start(5, 0, 0);
    const command = touch.move(5, 0, -100, 600, 600);
    expect(command).toEqual({ dx: 0, dy: 1 });
    expect(directions.press("__touch__", command!)).toEqual(command);
    expect(directions.tick(0.071)).toEqual(command);
    touch.end(5);
    expect(directions.release("__touch__")).toBeNull();
  });
});
