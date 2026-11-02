async () => {
  const r = window.__reviewRenderer, a = window.__PARABOX__;
  if (!r) throw new Error('Renderer hook not ready');
  const { createWallShader: legacy } = await import('/docs/parity/evidence/self-recursive-exit-perf-20261102/wallRendering-before.ts');
  const oldProgram = legacy(r.app.renderer.limits.maxBatchableTextures).glProgram;
  const gl = r.app.renderer.gl, frames = [], images = [];
  const capture = name => {
    const w = a.world(), p = w.findPlayerBlock();
    const row = { name, at: performance.now(), moveCount: w.moveCount, player: { x: p.x, y: p.y, outer: p.outerLevel?.id, anim: p.anim, t: p.animT, length: p.animLength },
      camera: { t: w.cameraAnimT, length: w.cameraAnimLength, phase: w.newCamT }, layers: r.sceneLayerCount };
    const shaders = r.sceneLayers.map(g => r.wallShaders.get(g)).filter(Boolean);
    const programs = shaders.map(s => s.glProgram);
    const pixels = () => { const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return bytes; };
    for (const s of shaders) s.glProgram = oldProgram;
    r.app.renderer.render({ container: r.app.stage });
    const before = pixels(); images.push({ name: name + '-before', dataUrl: r.app.canvas.toDataURL('image/png') });
    for (const [i, s] of shaders.entries()) s.glProgram = programs[i];
    r.app.renderer.render({ container: r.app.stage });
    const after = pixels(); images.push({ name: name + '-after', dataUrl: r.app.canvas.toDataURL('image/png') });
    row.differingBytes = after.reduce((n, v, i) => n + Number(v !== before[i]), 0);
    row.comparedBytes = before.length; frames.push(row);
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = async char => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true })); await wait(70);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true })); await wait(650);
  };
  for (const mode of ['push', 'playerExit']) {
    a.loadLevel('infexit_ref_first'); await wait(650);
    for (const char of 'saasdddd') await key(char);
    if (mode === 'playerExit') for (const char of 'wd') await key(char);
    capture(mode + '-boundary');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    const began = performance.now(); let next = 0;
    const phases = [.25, .5, .75];
    await new Promise((resolve, reject) => {
      const sample = () => {
        const p = a.world().findPlayerBlock();
        if (p.animT / p.animLength >= phases[next] && p.moving) capture(mode + '-motion-' + phases[next++]);
        if (performance.now() - began > 70) window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }));
        if (next === phases.length) resolve();
        else if (performance.now() - began > 1800) reject(new Error('Missed motion phases: ' + mode));
        else requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await wait(700); capture(mode + '-settled');
  }
  const report = { method: 'Same fixed Pixi scene submitted synchronously with pre-fix versus cached program; no animation/particle/eye-clock advance between pair; actual canvas PNGs and exact GL byte comparison. Captures perturb frame times and are not performance evidence.',
    viewport: [innerWidth, innerHeight, devicePixelRatio], source: 'working tree wallRendering.ts SHA256 3547e22812ebbdff6e8b56a3204b2a4f411bbb3c322c3268e1f3fdbf799d62ba', frames, images };
  const response = await fetch('http://127.0.0.1:4181/capture/visual-v1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
  return { status: response.status, body: await response.json(), frames };
}
