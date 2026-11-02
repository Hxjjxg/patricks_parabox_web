async () => {
  const resource = name => performance.getEntriesByType('resource').map(e => e.name).find(n => new URL(n).pathname === name) ?? name;
  const { GameRenderer } = await import(resource('/src/render/GameRenderer.ts'));
  const { MovementEngine } = await import(resource('/src/core/movement.ts'));
  const api = window.__PARABOX__, originals = [], frames = [], inputs = [], glCalls = [], impulses = [];
  let renderer, active = null, phase = 'setup';
  const hook = (object, key, wrapper) => { const original = object[key]; originals.push(() => object[key] = original); object[key] = wrapper(original); };
  const state = () => {
    const w = api.world(), b = w.blocks.find(b => b.id === 24);
    return { moveCount: w.moveCount, player: api.getState().player,
      box: b ? { id: b.id, x: b.x, y: b.y, outer: b.outerLevel?.id, sub: b.subLevel?.id } : null,
      blocks: w.blocks.length, levels: w.levels.length, phantoms: w.levels.reduce((n, l) => n + l.phantoms.length, 0) };
  };
  hook(GameRenderer.prototype, 'draw', original => function(...args) {
    renderer = this;
    if (active) active.draws++;
    return original.apply(this, args);
  });
  hook(GameRenderer.prototype, 'renderFrame', original => function(...args) {
    const row = { at: performance.now(), raf: args[0], phase, draws: 0, drawLevels: 0, passes: 0,
      layersBefore: this.sceneLayers.length, masksBefore: this.maskPasses.length, ...state() };
    active = row;
    try { return original.apply(this, args); }
    finally {
      row.ms = performance.now() - row.at;
      row.layers = this.sceneLayerCount; row.masks = this.maskPassCount;
      row.newLayers = this.sceneLayers.length - row.layersBefore;
      row.newMasks = this.maskPasses.length - row.masksBefore;
      frames.push(row); active = null;
    }
  });
  for (const [key, counter] of [['drawLevel', 'drawLevels'], ['drawScenePass', 'passes']]) {
    hook(GameRenderer.prototype, key, original => function(...args) { if (active) active[counter]++; return original.apply(this, args); });
  }
  hook(MovementEngine.prototype, 'applyDirectionalInput', original => function(...args) {
    const row = { at: performance.now(), phase, dx: args[0], dy: args[1] };
    try { return original.apply(this, args); } finally { row.ms = performance.now() - row.at; impulses.push(row); }
  });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = async (char, label) => {
    phase = label;
    const row = { char, phase, down: performance.now(), before: state() }; inputs.push(row);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: 'Key' + char.toUpperCase(), bubbles: true }));
    await wait(70);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: 'Key' + char.toUpperCase(), bubbles: true }));
    row.up = performance.now(); await wait(700); row.after = state();
  };
  const pool = () => {
    const shaders = renderer.sceneLayers.map(g => renderer.wallShaders.get(g)).filter(Boolean);
    return { layers: renderer.sceneLayers.length, masks: renderer.maskPasses.length, wallShaders: shaders.length,
      programs: new Set(shaders.map(s => s.glProgram)).size, heap: performance.memory?.usedJSHeapSize };
  };
  try {
    api.reload();
    await wait(50);
    if (!renderer) throw new Error('Active renderer module was not observed; reload the page before profiling');
    const gl = renderer.app.renderer.gl;
    for (const name of ['compileShader', 'linkProgram']) hook(gl, name, original => function(...args) {
      glCalls.push({ name, at: performance.now(), phase }); return original.apply(this, args);
    });
    const initialPool = pool(), repetitions = [];
    for (const mode of ['push', 'playerExit']) {
      api.loadLevel('infexit_ref_first'); await wait(700);
      for (const [index, char] of [...'saasdddd'].entries()) await key(char, mode + ':setup:' + index);
      if (state().moveCount !== 8 || state().box.x !== 6 || state().box.y !== 1) throw new Error('Boundary setup mismatch');
      if (mode === 'playerExit') { await key('w', mode + ':align'); await key('d', mode + ':approach'); }
      phase = mode + ':before'; await wait(700);
      const before = state(), beforePool = pool();
      await key('d', mode + ':crossing');
      phase = mode + ':after'; await wait(700);
      const after = state(), afterPool = pool();
      if (mode === 'push' && (after.box.x !== 2 || after.box.y !== 4)) throw new Error('Box did not cross infinite exit');
      if (mode === 'playerExit' && (after.player.x !== 2 || after.player.y !== 4 || after.box.x !== 6)) throw new Error('Player did not cross with boundary self-reference retained');
      const cycles = [];
      for (let i = 0; i < 12; i++) {
        phase = mode + ':undo:' + i; api.undo(); await wait(350);
        await key('d', mode + ':repeat:' + i);
        cycles.push({ index: i, state: state(), pool: pool() });
      }
      repetitions.push({ mode, before, beforePool, after, afterPool, cycles });
    }
    const sorted = values => [...values].sort((a, b) => a - b);
    const stats = values => { const v = sorted(values); return { count: v.length, median: v[Math.floor(v.length * .5)], p95: v[Math.floor(v.length * .95)], max: v.at(-1) }; };
    return { url: location.href, at: new Date().toISOString(), viewport: [innerWidth, innerHeight, devicePixelRatio],
      inputMethod: 'Synthetic keyboard down/up sampled by normal controller; natural browser rAF; undo through local debug API',
      initialPool, finalPool: pool(), repetitions, frames, inputs, impulses, glCalls,
      summary: { renderFrame: stats(frames.map(f => f.ms)), rafDelta: stats(frames.slice(1).map((f, i) => f.raf - frames[i].raf)),
        impulse: stats(impulses.map(i => i.ms)), maxDrawLevels: Math.max(...frames.map(f => f.drawLevels)),
        maxLayers: Math.max(...frames.map(f => f.layers)), compileCalls: glCalls.filter(c => c.name === 'compileShader').length } };
  } finally {
    for (const restore of originals.reverse()) restore();
  }
}
