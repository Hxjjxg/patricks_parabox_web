/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRgbaPng } from "./helpers/readRgbaPng";

const original = fileURLToPath(new URL("../docs/parity/evidence/original/gpu-walls-all-20261025/", import.meta.url));
const assets = fileURLToPath(new URL("../src/assets/textures/", import.meta.url));
const capture = JSON.parse(readFileSync(join(original, "capture.json"), "utf8")) as {
  requestId: string;
  activeColorSpace: string;
  graphicsDeviceType: string;
  textures: Array<{ file: string; sourceField: string; index: number; width: number; height: number }>;
};
const manifest = JSON.parse(readFileSync(join(original, "pixel-diff-and-hashes.json"), "utf8")) as {
  textures: Array<{ file: string; sha256: string }>;
};
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("original Direct3D11 wall texture readback", () => {
  it("preserves provenance for all 48 normal and 48 mirrored textures", () => {
    expect(capture.requestId).toBe("gpu-walls-all-20261025");
    expect(capture.activeColorSpace).toBe("Gamma");
    expect(capture.graphicsDeviceType).toBe("Direct3D11");
    expect(capture.textures).toHaveLength(96);
    expect(new Set(capture.textures.map((texture) => texture.file)).size).toBe(96);
  });

  for (const family of ["main", "flip"]) {
    for (let index = 0; index < 48; index++) {
      const file = `wall_${family}_${index}.png`;
      it(`preserves every native RGBA pixel in ${file}`, () => {
        const metadata = capture.textures.find((texture) => texture.file === file);
        expect(metadata).toEqual(expect.objectContaining({
          sourceField: family === "main" ? "WallTiles" : "WallTilesFlip",
          index, width: 200, height: 200,
        }));
        // The original capture and its published hash remain the reference;
        // asset changes may not silently replace that evidence.
        expect(sha256(readFileSync(join(original, file)))).toBe(manifest.textures.find((texture) => texture.file === file)?.sha256);
        const expected = readRgbaPng(join(original, file));
        const observed = readRgbaPng(join(assets, file));
        expect([observed.width, observed.height]).toEqual([expected.width, expected.height]);
        expect(sha256(observed.pixels)).toBe(sha256(expected.pixels));
      });
    }
  }

  it("retains the GPU-decoded neutral and bevel values without a blanket RGB offset", () => {
    const texture = readRgbaPng(join(assets, "wall_main_12.png"));
    const pixel = (x: number, y: number) => Array.from(texture.pixels.subarray((y * texture.width + x) * 4, (y * texture.width + x) * 4 + 4));
    expect(pixel(100, 50)).toEqual([194, 193, 194, 255]);
    expect(pixel(100, 175)).toEqual([140, 142, 140, 255]);
  });
});
