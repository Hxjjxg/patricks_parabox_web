import {
  Matrix, Shader, UniformGroup,
  colorBit, colorBitGl,
  compileHighShaderGlProgram, compileHighShaderGpuProgram,
  generateTextureBatchBit, generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  localUniformBitGl, localUniformBitGroup2,
  roundPixelsBit, roundPixelsBitGl,
} from "pixi.js";
import type { Block, Level } from "../core/model";

export interface WallRect { x: number; y: number; width: number; height: number }

/** Draw.SetDrawRect snaps both endpoints, rather than rounding each tile width. */
export function originalDrawRect(rect: WallRect, resolution: number): WallRect {
  const x = Math.trunc(rect.x * resolution);
  const y = Math.trunc(rect.y * resolution);
  return {
    x: x / resolution,
    y: y / resolution,
    width: (Math.trunc((rect.x + rect.width) * resolution) - x) / resolution,
    height: (Math.trunc((rect.y + rect.height) * resolution) - y) / resolution,
  };
}

/** ProcessTicket uses the size of one CELL, not the whole containing board. */
export function wallTint(block: Block, cellFractionOfScreen: number, cloneFadeIntensity?:number): Float32Array {
  let saturation = block.color.s;
  let value = (-0.25 * Math.log(cellFractionOfScreen + 0.005) / Math.log(20) + 0.5) * block.color.v * 2;
  if (block.isSomeInfExitBlock) value *= 0.55;
  else {
    const intensity=cloneFadeIntensity ?? (block.subLevel && block.subLevel.getExitBlock() !== block?1:0);
    value += 0.4*intensity;
    saturation *= 1-0.18*intensity;
  }
  const hue = ((block.color.h % 1) + 1) % 1;
  const sector = hue * 6;
  const fraction = sector - Math.floor(sector);
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  return new Float32Array([
    [value, t, p], [q, value, p], [p, value, t],
    [p, q, value], [t, p, value], [value, p, q],
  ][Math.floor(sector) % 6]!);
}

/** Keep the tint above one until AFTER sampling; 8-bit Pixi tint clips bevels. */
export function createWallShader(maxTextures: number): Shader {
  const glLocal = {
    ...localUniformBitGl,
    vertex: {
      ...localUniformBitGl.vertex,
      header: localUniformBitGl.vertex!.header + "\nuniform vec3 uWallTint;",
      main: localUniformBitGl.vertex!.main + "\nvColor.rgb *= uWallTint;",
    },
  };
  const gpuLocal = {
    ...localUniformBitGroup2,
    vertex: {
      ...localUniformBitGroup2.vertex,
      header: localUniformBitGroup2.vertex!.header!.replace("uRound:f32,", "uRound:f32,\nuWallTint:vec3<f32>,"),
      main: localUniformBitGroup2.vertex!.main + "\nvColor = vec4<f32>(vColor.rgb * localUniforms.uWallTint, vColor.a);",
    },
  };
  // Native clamps straight GUI RGB before source-alpha compositing. With
  // premultiplied samples, RGB <= alpha is the equivalent final-fragment bound.
  const glClamp = { name: "native-gui-rgb-clamp", fragment: {
    end: "finalColor.rgb = min(finalColor.rgb, vec3(finalColor.a));",
  } };
  const gpuClamp = { name: "native-gui-rgb-clamp", fragment: {
    end: "finalColor = vec4<f32>(min(finalColor.rgb, vec3<f32>(finalColor.a)), finalColor.a);",
  } };
  return new Shader({
    glProgram: compileHighShaderGlProgram({ name: "original-walls", bits: [colorBitGl, generateTextureBatchBitGl(maxTextures), glLocal, roundPixelsBitGl, glClamp] }),
    gpuProgram: compileHighShaderGpuProgram({ name: "original-walls", bits: [colorBit, generateTextureBatchBit(maxTextures), gpuLocal, roundPixelsBit, gpuClamp] }),
    resources: {
      localUniforms: new UniformGroup({
        uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
        uTransformMatrix: { value: new Matrix(), type: "mat3x3<f32>" },
        uRound: { value: 0, type: "f32" },
        uWallTint: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" },
      }),
      batchSamplers: getBatchSamplersUniformGroup(maxTextures),
    },
  });
}

function isSolid(level: Level, x: number, y: number): boolean {
  if (!level.inBounds(x, y)) return true;
  const block = level.getBlock(x, y);
  return Boolean(block && !block.subLevel);
}

export function autotileIndex(level: Level, block: Block, flipH = false): number {
  const dx = flipH ? -1 : 1;
  const up = isSolid(level, block.x, block.y + 1);
  const down = isSolid(level, block.x, block.y - 1);
  const right = isSolid(level, block.x + dx, block.y);
  const left = isSolid(level, block.x - dx, block.y);
  const topRight = up && right && isSolid(level, block.x + dx, block.y + 1);
  const topLeft = up && left && isSolid(level, block.x - dx, block.y + 1);
  const bottomRight =
    down && right && isSolid(level, block.x + dx, block.y - 1);
  const bottomLeft = down && left && isSolid(level, block.x - dx, block.y - 1);
  const mask =
    Number(topLeft) |
    (Number(up) * 2) |
    (Number(topRight) * 4) |
    (Number(left) * 8) |
    (Number(right) * 16) |
    (Number(bottomLeft) * 32) |
    (Number(down) * 64) |
    (Number(bottomRight) * 128);
  const thresholds: ReadonlyArray<readonly [number, number]> = [
    [0, 47],
    [2, 1],
    [8, 2],
    [10, 3],
    [11, 4],
    [16, 5],
    [18, 6],
    [22, 7],
    [24, 8],
    [26, 9],
    [27, 10],
    [30, 11],
    [31, 12],
    [64, 13],
    [66, 14],
    [72, 15],
    [74, 16],
    [75, 17],
    [80, 18],
    [82, 19],
    [86, 20],
    [88, 21],
    [90, 22],
    [91, 23],
    [94, 24],
    [95, 25],
    [104, 26],
    [106, 27],
    [107, 28],
    [120, 29],
    [122, 30],
    [123, 31],
    [126, 32],
    [127, 33],
    [208, 34],
    [210, 35],
    [214, 36],
    [216, 37],
    [218, 38],
    [219, 39],
    [222, 40],
    [223, 41],
    [248, 42],
    [250, 43],
    [251, 44],
    [254, 45],
    [255, 46],
  ];
  let result = 47;
  for (const [minimum, index] of thresholds) {
    if (mask >= minimum) result = index;
  }
  return result;
}

