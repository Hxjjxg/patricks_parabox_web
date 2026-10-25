import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { flipShineQuad } from "../src/render/flipShineRendering";

const f = Math.fround;
const screenClip = { x: 0, y: 0, width: 800, height: 600 };

// Original Graphics.DrawTexture arguments, not rectangles fitted to PNG pixels.
// flip-recursive-shine-submitted-v1-20261025/shine.json, ordinary block104.
const nativeBands = [
  { frame: 50, misc: 8.8212595, ticket: [454.66666618982947, 463.9999985694885, 54.666666189829506, 54.666666189829506], submitted: [441, 436.666656, 21, 54.3333435] },
  { frame: 52, misc: 8.867028, ticket: [453.46940241761683, 460.40820725285033, 58.857087784216866, 58.857087784216866], submitted: [436, 430.979675, 20, 58.0203247] },
  { frame: 58, misc: 8.976461, ticket: [449.6957405199281, 449.08721296897863, 72.06490131937962, 72.06490131937962], submitted: [420, 413.054749, 20, 71.94525] },
  { frame: 61, misc: 9.029222, ticket: [447.19779964524133, 441.59340856875195, 80.80769349184536, 80.80769349184536], submitted: [411, 401.189575, 19, 79.8104248] },
];

function flipped(misc: number): Block {
  const block = new Block(104);
  block.subLevel = new Level(1, 3, 3);
  block.flipH = true;
  block.miscAnimT = misc;
  return block;
}

describe("recursive native flip-shine submissions", () => {
  for (const sample of nativeBands) {
    for (const clip of [null, screenClip]) it(`preserves fractional queued clamp bounds at native frame ${sample.frame}, parent=${!!clip}`, () => {
      const [cx, cy, width, height] = sample.ticket as [number, number, number, number];
      const rect = { x: cx - width / 2, y: cy - height / 2, width, height };
      const band = flipShineQuad(flipped(sample.misc), rect, 600, true, 1, DrawStyle.Normal, 1, false, 1, clip)!;
      expect(band).not.toBeNull();
      expect([band.rect.x, band.rect.y, band.rect.width, band.rect.height]).toEqual(sample.submitted.map(f));
      expect(band.alpha).toBe(f(0.22) * 2);
    });
  }

  it("floors the self ticket endpoint before stacking local float bounds", () => {
    const rect = { x: 100.25, y: 200.25, width: 100.5, height: 100.5 };
    const band = flipShineQuad(flipped(0.4), rect, 600, true, 1, DrawStyle.Normal, 1, false, 1, screenClip)!;
    expect(band.rect.x + band.rect.width).toBe(200);
    expect(band.rect.y).toBe(200.25);
    expect(band.rect.height).toBe(99.75);
  });

  it("intersects the inherited and self ticket bounds before flooring", () => {
    const rect = { x: 100.25, y: 200.25, width: 100.5, height: 100.5 };
    const clip = { x: 198.75, y: 205.75, width: 2.5, height: 80.5 };
    const band = flipShineQuad(flipped(0.4), rect, 600, true, 1, DrawStyle.Normal, 1, false, 1, clip)!;
    expect(band.rect).toEqual({ x: 198, y: 205, width: 2, height: 81 });
  });

  it("matches the two native halted self1x1 parity bands", () => {
    // frame77 final ordinary pass, block51, BUMP_HALT t0, camera phase1.
    // The same block is submitted at successive depths with opposite parity.
    const size = 245.9999978542328;
    const rect = { x: 400 - size / 2, y: 300 - size / 2, width: size, height: size };
    const block = flipped(9.327032);
    const left = flipShineQuad(block, rect, 600, true, 0, DrawStyle.Normal)!;
    const right = flipShineQuad(block, rect, 600, false, 1, DrawStyle.Normal)!;
    expect(left.rect).toEqual({ x: 277, y: 177, width: 17, height: 245 });
    expect(right.rect).toEqual({ x: 505, y: 177, width: 18, height: 245 });
    expect(left.alpha).toBe(f(0.22) * 2);
    expect(right.alpha).toBe(left.alpha);
  });

  it("can have no band at the same completed camera phase with another misc clock", () => {
    const rect = { x: 277, y: 177, width: 246, height: 246 };
    expect(flipShineQuad(flipped(9.327032), rect, 600, true, 0, DrawStyle.Normal, 1, false, 1)).not.toBeNull();
    expect(flipShineQuad(flipped(10), rect, 600, true, 0, DrawStyle.Normal, 1, false, 1)).toBeNull();
  });

  it("preserves the same submitted physical bounds at resolution two", () => {
    const sample = nativeBands[1]!;
    const [cx, cy, width, height] = sample.ticket as [number, number, number, number];
    const rect = { x: (cx - width / 2) / 2, y: (cy - height / 2) / 2, width: width / 2, height: height / 2 };
    const band = flipShineQuad(flipped(sample.misc), rect, 300, true, 0, DrawStyle.Normal, 2)!;
    expect([band.rect.x, band.rect.y, band.rect.width, band.rect.height].map(v => v * 2)).toEqual(sample.submitted.map(f));
  });

  it("does not submit a band outside the inherited ticket clamp", () => {
    const rect = { x: 100.25, y: 200.25, width: 100.5, height: 100.5 };
    const clip = { x: 300, y: 200, width: 100, height: 100 };
    expect(flipShineQuad(flipped(0.4), rect, 600, true, 1, DrawStyle.Normal, 1, false, 1, clip)).toBeNull();
  });
});
