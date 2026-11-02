import { afterEach, describe, expect, it, vi } from "vitest";
import { createWallShader } from "../src/render/wallRendering";

afterEach(() => vi.unstubAllGlobals());

describe("recursive wall layer programs", () => {
  it("reuses compiled programs as the recursive layer pool grows, with isolated uniforms", () => {
    // Shader source generation only; real WebGL rendering is checked separately.
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    const layers = Array.from({ length: 108 }, () => createWallShader(16));
    try {
      expect(new Set(layers.map(s => s.glProgram)).size).toBe(1);
      expect(new Set(layers.map(s => s.gpuProgram)).size).toBe(1);
      expect(new Set(layers.map(s => s.resources.localUniforms)).size).toBe(108);
      const first = layers[0]!.resources.localUniforms.uniforms;
      const second = layers[1]!.resources.localUniforms.uniforms;
      first.uWallTint[0] = 2;
      first.uTransformMatrix.tx = 7;
      expect(second.uWallTint[0]).toBe(1);
      expect(second.uTransformMatrix.tx).toBe(0);
      // Disposing a layer must not destroy the program used by other layers.
      layers[0]!.destroy();
      expect(layers[1]!.glProgram!.fragment).toContain("finalColor.rgb = min");
    } finally {
      for (const layer of layers.slice(1)) layer.destroy();
    }
  });

  it("separates program variants for different renderer sampler limits", () => {
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    const small = createWallShader(4), large = createWallShader(8);
    try {
      expect(small.glProgram).not.toBe(large.glProgram);
      expect(small.gpuProgram).not.toBe(large.gpuProgram);
      expect(small.glProgram!.fragment).toContain("uTextures[4]");
      expect(large.glProgram!.fragment).toContain("uTextures[8]");
    } finally {
      small.destroy();
      large.destroy();
    }
  });
});
