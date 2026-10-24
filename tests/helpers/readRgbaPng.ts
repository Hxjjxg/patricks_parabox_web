/// <reference types="node" />
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/** Minimal RGBA8 decoder for lossless framebuffer/texture regression evidence. */
export function readRgbaPng(path: string): { width: number; height: number; pixels: Uint8Array } {
  const png = readFileSync(path);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`Invalid PNG signature: ${path}`);
  }
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[9] !== 6 || chunk[10] !== 0 || chunk[11] !== 0 || chunk[12] !== 0) {
        throw new Error(`Expected non-interlaced RGBA8 PNG: ${path}`);
      }
    } else if (kind === "IDAT") data.push(chunk);
    offset += length + 12;
    if (kind === "IEND") break;
  }
  const scanlines = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  if (width <= 0 || height <= 0 || scanlines.length !== (stride + 1) * height) {
    throw new Error(`Invalid RGBA scanline dimensions: ${path}`);
  }
  const pixels = new Uint8Array(stride * height);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = scanlines[input++]!;
    if (filter > 4) throw new Error(`Unsupported PNG filter ${filter}: ${path}`);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= 4 ? pixels[index - 4]! : 0;
      const up = y > 0 ? pixels[index - stride]! : 0;
      const corner = x >= 4 && y > 0 ? pixels[index - stride - 4]! : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - corner;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dc = Math.abs(p - corner);
        predictor = dl <= du && dl <= dc ? left : du <= dc ? up : corner;
      }
      pixels[index] = (scanlines[input++]! + predictor) & 255;
    }
  }
  return { width, height, pixels };
}
