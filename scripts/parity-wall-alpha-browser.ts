import { Application, BufferImageSource, Graphics, Texture, type WebGLRenderer } from 'pixi.js';
import { createWallShader } from '../src/render/wallRendering';

/** Real GPU regression. Run through the Vite page; never touches game state. */
export async function runWallAlphaRegression() {
  const coverage = [0, 64, 128, 192, 255];
  const cases = [
    { tint: 0.5, expected: [0, 32, 64, 96], scope: 'non-HDR partial coverage' },
    { tint: 1, expected: coverage, scope: 'unit tint and opaque control' },
    { tint: 2, expected: coverage, scope: 'HDR source clamp before coverage' },
  ];
  const app = new Application();
  await app.init({ width: 5, height: 3, resolution: 1, backgroundColor: 0, backgroundAlpha: 1,
    antialias: false, preference: 'webgl', autoStart: false });
  const bytes = new Uint8Array(coverage.flatMap(a => [a, a, a, a]));
  const texture = new Texture({ source: new BufferImageSource({ resource: bytes, width: 5, height: 1,
    alphaMode: 'premultiplied-alpha', scaleMode: 'nearest', autoGenerateMipmaps: false }) });
  const shaders = [];
  try {
    for (const [row, test] of cases.entries()) {
      const graphics = new Graphics();
      const shader = createWallShader(app.renderer.limits.maxBatchableTextures);
      shader.resources.localUniforms.uniforms.uWallTint = new Float32Array([test.tint, test.tint, test.tint]);
      shaders.push(shader);
      graphics.context.customShader = shader;
      graphics.texture(texture, 0xffffff, 0, row, 5, 1);
      app.stage.addChild(graphics);
    }
    app.renderer.render({ container: app.stage });
    const gl = (app.renderer as WebGLRenderer).gl;
    const pixels = new Uint8Array(5 * 3 * 4);
    gl.readPixels(0, 0, 5, 3, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const results = cases.map((test, row) => {
      const rgba = coverage.map((_, x) => Array.from(pixels.slice(((2 - row) * 5 + x) * 4, ((2 - row) * 5 + x) * 4 + 4)));
      return { ...test, rgba, passed: test.expected.every((value, x) => rgba[x]!.every((channel, i) => channel === (i === 3 ? 255 : value))) };
    });
    return { method: 'Actual production shader; nearest premultiplied white texture over opaque black; exact native source-clamp law, no screenshot or AA tolerance',
      width: 5, height: 3, glError: gl.getError(), passed: results.every(r => r.passed), results };
  } finally {
    app.destroy(true, { children: true });
    for (const shader of shaders) shader.destroy();
    texture.destroy(true);
  }
}
