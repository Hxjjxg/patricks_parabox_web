import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";
import type { WallRect } from "../src/render/wallRendering";

type Call = { rect: number[]; color: number; alpha: number };

function harness(misc: number, cameraPhase = 1) {
  const calls: Call[] = [];
  let rect: number[] = [];
  const graphics = {
    rect: (...value: number[]) => { rect = value; return graphics; },
    fill: (style: { color: number; alpha: number }) => { calls.push({ rect, ...style }); return graphics; },
  };
  const block = new Block(51);
  block.subLevel = new Level(1, 1, 1);
  block.flipH = block.fadeFlipH = true;
  block.miscAnimT = misc;
  block.animT = 0; block.animLength = 0.22;
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
    world: { drawStyle: DrawStyle.Normal, cameraAnimT: cameraPhase, cameraAnimLength: 1 },
    scene: {}, maskedScene: () => ({}), nextSceneLayer: () => graphics,
  });
  receiver.drawLevel = () => receiver.effectTickets.push({ ...receiver.currentTicket });
  return { receiver, graphics, block, calls };
}

const size = 245.9999978542328;
const haltedRect = { x: 277.0000010728836, y: 177.0000010728836, width: size, height: size };

describe("actual recursive shine renderer calls", () => {
  // These clocks/rectangles are actual active-instance calls, retained in
  // web-recursive-shine-clock-active-dev/flip/shine-telemetry.json.
  // They establish the source phase behavior, not native/Web image equality.
  it("submits no band during the recorded NORMAL no-band interval", () => {
    const { receiver, graphics, block, calls } = harness(10.090500000004475, 0.28200000524520874);
    receiver.drawFlipShine(graphics, block, { x: 140.83451361559284, y: 362.70827750521664, width: 58.68281281038295, height: 75.6970213729573 }, true, 1);
    expect(calls).toEqual([]);
  });

  it("submits only the recorded one-pixel parity band at the first halted phase", () => {
    const { receiver, graphics, block, calls } = harness(10.456900000004472);
    receiver.drawFlipShine(graphics, block, haltedRect, true, 0);
    receiver.drawFlipShine(graphics, block, haltedRect, false, 1);
    expect(calls).toEqual([{ rect: [522, 177, 1, 245], color: 0xffffff, alpha: Math.fround(0.22) * 2 }]);
  });

  it("naturally submits broad opposite-side bands later at the same camera phase", () => {
    const { receiver, graphics, block, calls } = harness(11.023500000004477);
    receiver.drawFlipShine(graphics, block, haltedRect, true, 0);
    receiver.drawFlipShine(graphics, block, haltedRect, false, 1);
    expect(calls).toEqual([
      { rect: [485, 177, 38, 245], color: 0xffffff, alpha: Math.fround(0.22) * 2 },
      { rect: [277, 177, 37, 245], color: 0xffffff, alpha: Math.fround(0.22) * 2 },
    ]);
  });

  const clippedRect: WallRect = { x: 100.25, y: 200.25, width: 100.5, height: 100.5 };
  const clip: WallRect = { x: 198.75, y: 205.75, width: 2.5, height: 80.5 };

  it("passes inherited ticket clipping through the drawFlipShine wrapper", () => {
    const { receiver, graphics, block, calls } = harness(0.4);
    receiver.drawFlipShine(graphics, block, clippedRect, true, 1, false, clip);
    expect(calls).toEqual([{ rect: [198, 205, 2, 81], color: 0xffffff, alpha: Math.fround(0.22) * 2 }]);
  });

  it("keeps the inherited clip when the effect queue submits the shine", () => {
    const { receiver, block, calls } = harness(0.4);
    receiver.drawScenePass(block, clippedRect, 1, true, clip);
    expect(calls).toEqual([{ rect: [198, 205, 2, 81], color: 0xffffff, alpha: Math.fround(0.22) * 2 }]);
  });
});
