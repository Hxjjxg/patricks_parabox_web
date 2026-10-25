/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Block, DrawStyle, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";

function glyphs(block: Block) {
  const commands: Array<{ rect: number[]; texture: string; alpha: number }> = [];
  let rect: number[] = [];
  const graphics = { rect: (...numbers: number[]) => { rect = numbers; return graphics; },
    fill: (fill: { texture: string; alpha: number }) => { commands.push({ rect, ...fill }); return graphics; } };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width: 800, height: 600 }, renderer: { resolution: 1 } }, world: { drawStyle: DrawStyle.Normal },
    textures: { infParticle: "solid", infParticleOutline: "outline" },
  });
  receiver.drawInfEffect(graphics, block, { x: 100, y: 200, width: 100, height: 100 });
  return commands;
}

describe("actual original infinity glyph rendering", () => {
  it("draws one centered90percent outline glyph for an infinite-enter box", () => {
    const block = new Block(1); block.isSomeInfEnterBlock = true;
    const commands = glyphs(block);
    expect(commands).toHaveLength(1);
    expect(commands[0]!.texture).toBe("outline");
    expect(commands[0]!.rect).toEqual([105, 205, 89, 89]);
    expect(commands[0]!.alpha).toBeCloseTo(2 * (-Math.log10(100 / 600 + 0.5) + 0.22), 6);
  });
  it("counts exit glyphs by native infExitBlocks position and uses the solid asset", () => {
    const block = new Block(1); const level = new Level(1, 3, 3);
    block.subLevel = level; block.isSomeInfExitBlock = true;
    level.infExitBlocks.push(null, block);
    const commands = glyphs(block);
    expect(commands).toHaveLength(2);
    expect(commands.every((command) => command.texture === "solid")).toBe(true);
    // float(100/3)*1.8 is59.999996; native SetDrawRect truncates the far edge.
    expect(commands[0]!.rect[2]).toBe(59);
    expect(commands[1]!.rect[1]! - commands[0]!.rect[1]!).toBeCloseTo(44.44444, 4);
  });
  it("does not invent glyphs for ordinary boxes", () => {
    expect(glyphs(new Block(1))).toEqual([]);
  });
});


describe("native infinity symbol GPU provenance", () => {
  it.each([
    ["infparticletex_0.png", "infinity_particle.png", "75dc3e6e97e722b3415c0cea45160c2abf1dfd69dfc08a5ffe427b0577516b62"],
    ["infparticleoutlinetex_0.png", "infinity_particle_outline.png", "cdb66c0f6599a297170571b6d7a3e3e6f12cd92ad44dbf89a413e1d531b11374"],
  ])("preserves every source byte of%s", (source, asset, expected) => {
    const original = readFileSync(new URL("../docs/parity/evidence/original/gpu-infinity-effects-20261025/" + source, import.meta.url));
    const observed = readFileSync(new URL("../src/assets/textures/" + asset, import.meta.url));
    expect(createHash("sha256").update(original).digest("hex")).toBe(expected);
    expect(observed.equals(original)).toBe(true);
  });
});
