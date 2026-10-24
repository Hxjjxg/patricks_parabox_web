import { describe, expect, it } from "vitest";
import { decideDirectionRequest } from "../src/core/inputQueue";

const base = {
  repeated: false,
  animating: false,
  alreadyQueued: false,
  waitingForDirectionChange: false,
  allowSkippingAnimation: false,
};

describe("directional request decision", () => {
  it("applies presses and repeats immediately when nothing is moving", () => {
    expect(decideDirectionRequest(base)).toBe("apply");
    expect(decideDirectionRequest({ ...base, repeated: true })).toBe("apply");
  });

  it("queues a fresh press that interrupts a slide", () => {
    expect(decideDirectionRequest({ ...base, animating: true })).toBe("queue");
  });

  it("never applies two moves at once: only one request can be queued", () => {
    expect(
      decideDirectionRequest({ ...base, animating: true, alreadyQueued: true }),
    ).toBe("ignore");
    expect(
      decideDirectionRequest({
        ...base,
        repeated: true,
        animating: true,
        alreadyQueued: true,
      }),
    ).toBe("ignore");
  });

  it("drops held repeats that fire during an animation", () => {
    expect(decideDirectionRequest({ ...base, repeated: true, animating: true })).toBe(
      "ignore",
    );
  });

  it("does not retry a blocked direction until it changes", () => {
    expect(
      decideDirectionRequest({ ...base, repeated: true, waitingForDirectionChange: true }),
    ).toBe("ignore");
    // A fresh press is a direction change; the controller clears the flag
    // before deciding, and a press is never suppressed by the wait flag.
    expect(
      decideDirectionRequest({ ...base, waitingForDirectionChange: true }),
    ).toBe("apply");
  });

  it("skips animations instead of queuing when the preference allows it", () => {
    expect(
      decideDirectionRequest({
        ...base,
        animating: true,
        allowSkippingAnimation: true,
      }),
    ).toBe("skip-and-apply");
    expect(
      decideDirectionRequest({
        ...base,
        repeated: true,
        animating: true,
        allowSkippingAnimation: true,
      }),
    ).toBe("skip-and-apply");
  });
});
