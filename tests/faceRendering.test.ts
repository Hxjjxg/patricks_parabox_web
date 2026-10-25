import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";

function drawFace(block: Block, width: number, height = width, flipH = false) {
  const quads: Array<{ rect: number[]; texture: unknown; alpha: number; color: number }> = [];
  let rect: number[] = [];
  const graphics = { rect: (...coordinates: number[]) => { rect = coordinates; return graphics; },
    fill: (fill: { texture: unknown; alpha: number; color: number }) => { quads.push({ rect, ...fill }); return graphics; } };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } },
    world: { drawStyle: DrawStyle.Normal },
    textures: { eye: "open", eyeSmall: "openSmall", eyeClosed: "closed", eyeClosedSmall: "closedSmall",
      possessEye: "possess", possessEyeSmall: "possessSmall" },
  });
  receiver.drawFace(graphics, block, { x: 10, y: 20, width, height }, false, flipH);
  return quads;
}
function player() {
  const block = new Block(1); block.init(0, 0, new Level(1, 3, 3), new Level(2, 1, 1));
  block.subLevel!.filledWithWalls = true;
  block.isPlayer = true; block.drawIsPlayer = true; block.faceAnimT = 8;
  return block;
}

describe("actual native face rendering", () => {
  it("uses the actual closed-eye texture at its uncollapsed native rectangle", () => {
    const block = player(); block.faceAnimT = 0;
    const quads = drawFace(block, 200);
    expect(quads.map((quad) => quad.texture)).toEqual(["closedSmall", "closedSmall"]);
    expect(quads.map((quad) => quad.rect)).toEqual([[39, 91, 42, 38], [139, 91, 42, 38]]);
  });
  it("chooses the full closed texture after the blink width scale crosses50px", () => {
    const block = player(); block.faceAnimT = 0;
    expect(drawFace(block, 245).map((quad) => quad.texture)).toEqual(["closed", "closed"]);
  });
  it("transfers direct GUI black-eye alpha through the shader x2 multiplier", () => {
    const quads = drawFace(player(), 100);
    expect(quads[0]!.alpha).toBeCloseTo(2 * (-Math.log10(100 / 600 + 15) + 1.5), 6);
    expect(quads[0]!.color).toBe(0);
  });
  it("has no artificial minimum eye size for small recursive players", () => {
    const quads = drawFace(player(), 8);
    expect(quads.every((quad) => quad.rect[2]! <= 2 && quad.rect[3]! <= 2)).toBe(true);
  });
  it("uses the same black alpha and eye rectangle for possessable faces", () => {
    const block = player(); block.isPlayer = false; block.drawIsPlayer = false; block.possessable = true;
    const quads = drawFace(block, 100);
    expect(quads).toHaveLength(2);
    expect(quads.map((quad) => quad.texture)).toEqual(["possessSmall", "possessSmall"]);
    expect(quads.map((quad) => quad.rect)).toEqual([[25, 55, 20, 20], [75, 55, 20, 20]]);
    expect(quads[0]!.color).toBe(0);
  });
  it("mirrors eyes according to parent ticket parity rather than the block's own flip", () => {
    const block = player(); block.flipH = true; block.eyeXOffset = 0.1;
    const normal = drawFace(block, 100, 100, false);
    const mirrored = drawFace(block, 100, 100, true);
    expect(normal[0]!.rect[0]).toBe(40);
    expect(normal[1]!.rect[0]).toBe(85);
    expect(mirrored[0]!.rect[0]).toBe(60);
    expect(mirrored[1]!.rect[0]).toBe(15);
  });
});
