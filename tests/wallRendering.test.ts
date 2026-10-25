import { afterEach, describe, expect, it, vi } from "vitest";
import { Assets, Texture, type Graphics } from "pixi.js";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import type { Block, Level } from "../src/core/model";
import { GameRenderer } from "../src/render/GameRenderer";
import { loadOriginalTextures } from "../src/render/originalTextures";
import { autotileIndex, originalDrawRect, wallTint } from "../src/render/wallRendering";

type Rect = { x: number; y: number; width: number; height: number };
type DrawWall = (graphics: Graphics, level: Level, block: Block, rect: Rect, color: number, flipH: boolean) => void;
const drawWall = (GameRenderer.prototype as unknown as { drawWall: DrawWall }).drawWall;
const cellRect = (GameRenderer.prototype as unknown as { cellRect: (level: Level, x: number, y: number, rect: Rect, flipH: boolean) => Rect }).cellRect;

function wallDraw(rect: Rect, resolution = 1, flipH = false) {
  const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
  const level = world.levels[0]!;
  const block = level.getBlock(0, 4)!;
  const walls = Array.from({ length: 48 }, (_, index) => ({ index, flipped: false, source: { style: { addressMode: "repeat" } } }));
  const wallsFlip = Array.from({ length: 48 }, (_, index) => ({ index, flipped: true, source: { style: { addressMode: "repeat" } } }));
  const wallsBig = Array.from({ length: 13 }, (_, index) => ({ index, big: true, flipped: false, source: { style: { addressMode: "repeat" } } }));
  const wallsBigFlip = Array.from({ length: 13 }, (_, index) => ({ index, big: true, flipped: true, source: { style: { addressMode: "repeat" } } }));
  const commands: unknown[] = [];
  const graphics = {
    rect: (...args: unknown[]) => { commands.push(["rect", ...args]); return graphics; },
    fill: (...args: unknown[]) => { commands.push(["fill", ...args]); return graphics; },
    texture: (...args: unknown[]) => { commands.push(["texture", ...args]); return graphics; },
  };
  drawWall.call({ textures: { walls, wallsFlip, wallsBig, wallsBigFlip }, app: { renderer: { resolution } } }, graphics as unknown as Graphics, level, block, rect, 0xffffff, flipH);
  return { commands, walls, wallsFlip, wallsBig, wallsBigFlip };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("original wall draw contract", () => {
  it.each([false, true])("uses the native four-quadrant large texture path (flip%s)", (flipH) => {
    const result = wallDraw({ x: 10, y: 20, width: 256, height: 300 }, 1, flipH);
    const family = flipH ? result.wallsBigFlip : result.wallsBig;
    const indices = flipH ? [3, 4, 3, 4] : [4, 5, 4, 5];
    expect(result.commands).toEqual(indices.map((index, quadrant) => [
      "texture", family[index], 0xffffff, 10 + quadrant % 2 * 128, 20 + Math.floor(quadrant / 2) * 150, 128, 150,
    ]));
  });

  it.each([1, 2])("uses direct clamped textured quads and shared truncated endpoints at DPR %s", (resolution) => {
    const rect = { x: 154.3, y: 54.6, width: 492 / 9, height: 492 / 9 };
    const { commands, walls } = wallDraw(rect, resolution);
    expect(commands).toEqual([["texture", walls[28], 0xffffff, Math.trunc(rect.x * resolution) / resolution, Math.trunc(rect.y * resolution) / resolution, (Math.trunc((rect.x + rect.width) * resolution) - Math.trunc(rect.x * resolution)) / resolution, (Math.trunc((rect.y + rect.height) * resolution) - Math.trunc(rect.y * resolution)) / resolution]]);
    expect(walls[28]!.source.style.addressMode).toBe("clamp-to-edge");
  });

  it("uses the flipped wall texture family when the camera is mirrored", () => {
    const { commands, wallsFlip } = wallDraw({ x: 1, y: 2, width: 50, height: 50 }, 1, true);
    expect(commands[0]).toEqual(["texture", wallsFlip[36], 0xffffff, 1, 2, 50, 50]);
  });

  it("skips a wall that snaps to zero physical pixels", () => {
    expect(wallDraw({ x: 1.1, y: 2.1, width: 0.1, height: 0.1 }).commands).toEqual([]);
  });

  it("keeps the raw original wall texture so neutral and highlight pixels remain distinct", async () => {
    const loaded = new Map<string, unknown>();
    vi.spyOn(Assets, "load").mockImplementation(async (url) => {
      const key = String(url);
      if (!loaded.has(key)) loaded.set(key, { url: key, source: { style: {} } });
      return loaded.get(key) as Record<string, unknown>;
    });
    vi.spyOn(Texture, "from").mockReturnValue({ normalizedCanvas: true } as unknown as Texture);
    vi.stubGlobal("Image", class { naturalWidth = 1; naturalHeight = 1; decode = async () => {}; });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([193, 193, 193, 255]) }), putImageData() {} }) }) });
    const textures = await loadOriginalTextures();
    expect(textures.walls[47]).toEqual(expect.objectContaining({ url: expect.stringContaining("wall_main_47.png") }));
    expect(Texture.from).not.toHaveBeenCalled();
  });

  it("retains overbright original tint until texture multiplication", () => {
    const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
    const tint = wallTint(world.getDefaultFocusBlock(), (492 / 9) / 600);
    expect(tint[0]).toBeGreaterThan(1);
    const transfer = (value: number) => Math.min(255, Math.round(value * tint[0]!));
    // Live 800x600 original: neutral 216,215,216; bevel 156,158,156; light 255.
    // GPU readback preserves native neutral194 rather than CPU-decoded193.
    expect(transfer(194)).toBe(216);
    expect(Math.abs(transfer(140) - 156)).toBeLessThanOrEqual(1);
    expect(transfer(255)).toBe(255);
    expect(transfer(255)).toBeGreaterThan(transfer(194));
  });

  it.each([1, 2])("partitions shared physical edges at fractional camera scales (DPR %s)", (resolution) => {
    for (const scale of [0.37, 1, 1.03125, 1.5, 3.37]) {
      const x = -74.37;
      const width = 492 / 9 * scale;
      for (let index = 0; index < 8; index++) {
        const left = originalDrawRect({ x: x + index * width, y: 1.5, width, height: width }, resolution);
        const right = originalDrawRect({ x: x + (index + 1) * width, y: 1.5, width, height: width }, resolution);
        expect(left.x + left.width).toBe(right.x);
        expect((left.x * resolution) % 1).toBeCloseTo(0);
      }
    }
  });

  it("mirrors the neighbor mask before choosing a flipped tile", () => {
    const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
    const level = world.levels[0]!;
    const block = level.getBlock(0, 4)!;
    expect(autotileIndex(level, block)).toBe(28);
    expect(autotileIndex(level, block, true)).toBe(36);
  });

  it.each([1, 2])("shares exact grid endpoints at original camera sizes (DPR %s)", (resolution) => {
    const world = parseLevel(getLevelSource("third_puzzle"), "third_puzzle");
    const level = world.levels[0]!;
    for (const [width, height] of [[800, 600], [1001, 733], [1280, 720]]) {
      for (const scale of [0.37, 1, 1.03125, 1.5, 3.37]) {
        const size = Math.min(width!, height!) * 0.82 * scale;
        const board = { x: width! / 2 - size / 2, y: height! / 2 - size / 2, width: size, height: size };
        for (let index = 0; index < 8; index++) {
          const left = originalDrawRect(cellRect(level, index, 8, board, false), resolution);
          const right = originalDrawRect(cellRect(level, index + 1, 8, board, false), resolution);
          expect(left.x + left.width, JSON.stringify({ width, height, scale, index })).toBe(right.x);
        }
      }
    }
  });
});
