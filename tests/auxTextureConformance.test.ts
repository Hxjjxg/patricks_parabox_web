/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRgbaPng } from "./helpers/readRgbaPng";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "docs/parity/native-aux-texture-manifest.json"), "utf8")) as {
  textures: Array<{ capture: string; source: string; asset: string; sourceField: string; index: number;
    width: number; height: number; sha256: string; rgbaSha256: string }>;
};
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("native auxiliary GPU texture readback", () => {
  it("covers all 26 WallBig quadrants and 22 GUI, eye, goal and gradient textures", () => {
    expect(manifest.textures).toHaveLength(48);
    expect(new Set(manifest.textures.map((row) => row.asset)).size).toBe(48);
    expect(manifest.textures.filter((row) => row.sourceField === "WallBig")).toHaveLength(13);
    expect(manifest.textures.filter((row) => row.sourceField === "WallBigFlip")).toHaveLength(13);
  });

  for (const row of manifest.textures) {
    it("preserves native source metadata and every RGBA pixel: " + row.asset, () => {
      const folder = join(root, "docs/parity/evidence/original", row.capture);
      const capture = JSON.parse(readFileSync(join(folder, "capture.json"), "utf8"));
      expect(capture).toEqual(expect.objectContaining({ activeColorSpace: "Gamma", graphicsDeviceType: "Direct3D11",
        renderTextureReadWrite: "Linear", glSrgbWriteDuringBlit: false }));
      expect(capture.textures.find((texture: { file: string }) => texture.file === row.source)).toEqual(
        expect.objectContaining({ sourceField: row.sourceField, index: row.index, width: row.width, height: row.height,
          filterMode: "Bilinear", wrapMode: "Clamp" }));
      expect(sha256(readFileSync(join(folder, row.source)))).toBe(row.sha256);
      const texture = readRgbaPng(join(root, "src/assets/textures", row.asset));
      expect([texture.width, texture.height]).toEqual([row.width, row.height]);
      expect(sha256(texture.pixels)).toBe(row.rgbaSha256);
    });
  }
});
