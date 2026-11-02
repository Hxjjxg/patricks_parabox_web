() => {
  if (window.__coreRecursiveRun?.running) throw new Error('Replay already running');
  window.__coreRecursiveRun = { running: true, completed: [], error: null };
  const status = window.__coreRecursiveRun;
  (async () => {
    const plan = [{"name": "enter", "options": {"level": "enter", "setup": "URUULURRRR", "events": [{"at": 0, "key": "ArrowRight", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "exit", "options": {"level": "enter", "setup": "URUULURRRRR", "events": [{"at": 0, "key": "ArrowLeft", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "carry", "options": {"level": "carry", "setup": "LLL", "events": [{"at": 0, "key": "ArrowLeft", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "cycle", "options": {"level": "cycle_line", "setup": "URRURURRDDRRRRU", "events": [{"at": 0, "key": "ArrowUp", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "infexit", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "settleMs": 1000, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "infexit_ref_first", "setup": "DLLDRRRR", "events": [{"at": 0, "key": "ArrowRight", "duration": 40}], "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "infinity", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "infenter_zone_v2", "setup": "DDD", "events": [{"at": 0, "key": "ArrowUp", "duration": 40}], "settleMs": 1000, "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "clone", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "settleMs": 1000, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "clone_first_2", "setup": "DDD", "events": [{"at": 0, "key": "ArrowDown", "duration": 40}], "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "possess", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "settleMs": 1000, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "possess_first", "setup": "LDDL", "events": [{"at": 0, "key": "ArrowLeft", "duration": 40}], "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "flip-first", "options": {"level": "flip_first", "setup": "RDDR", "events": [{"at": 0, "key": "ArrowRight", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "flip", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "1by1_playerr_flip2", "setup": "RR", "events": [{"at": 0, "key": "ArrowDown", "duration": 40}], "settleMs": 1000, "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "infexit-player", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "settleMs": 1000, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "infexit_ref_first", "setup": "DLLDRRRRUR", "events": [{"at": 0, "key": "ArrowRight", "duration": 40}], "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "terminal", "options": {"level": "infenter_poswall_setup", "setup": "LLL", "events": [{"at": 0, "key": "ArrowRight", "duration": 40}], "settleMs": 1000, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}, {"name": "strict-enter", "options": {"expectedViewport": {"width": 800, "height": 600, "dpr": 1}, "captureMotion": true, "captureCameraMotion": true, "captureStateChanges": true, "revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "level": "infenter_zone_v2", "setup": "DD", "events": [{"at": 0, "key": "ArrowDown", "duration": 40}], "settleMs": 1000, "inputMethod": "Synthetic DOM keyboard; debug API setup; natural browser rAF"}}], capture = (// Diagnostic only. Evaluate this function in a running Web page with DevTools.
// Replace PARITY_OPTIONS before evaluation. Returned PNGs are actual Canvas output.
async () => {
  const options = PARITY_OPTIONS;
  const api = window.__PARABOX__;
  if (!api) throw new Error('Web game is not ready');
  const canvas = document.querySelector('canvas');
  if (options.expectedViewport) {
    const expected = options.expectedViewport;
    if (innerWidth !== expected.width || innerHeight !== expected.height ||
        canvas.width !== expected.width * expected.dpr || canvas.height !== expected.height * expected.dpr) {
      throw new Error('Capture viewport/backing dimensions do not match the declared reference');
    }
  }
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const directions = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
  const images = [];
  const events = [];
  const frames = [];
  const setupTimings = [];
  let active = true;
  let action = 'start';
  let previousStateKey = null;
  let previousMotionKey = null;
  let previousAnimT = Number.POSITIVE_INFINITY;
  let motionIndex = 0;
  let cameraIndex = 0;
  let previousCameraT = Number.POSITIVE_INFINITY;
  let previousCameraMoving = false;
  let lastPeriodicCapture = Number.NEGATIVE_INFINITY;
  let previousPauseKey = '', pauseIndex = 0, previousLevelName = null, levelFrame = 0;
  const sample = (timestamp) => {
    const world = api.world();
    const p = world.findPlayerBlock();
    const state = api.getState();
    return { timestamp, action, levelName: world.levelName, moveCount: world.moveCount,
      winning: world.winning, mode: state.mode,
      transition: { active: world.transitioning ?? false, counter: world.transitionCounter ?? 0,
        length: world.transitionLength ?? 0, scene: world.transitionSceneName ?? null },
      session: { mode: state.session.mode, selectedIndex: state.session.selectedIndex,
        selectedOption: state.session.options[state.session.selectedIndex] ?? null },
      moving: world.anyBlockMoving, wentToInfZone: world.wentToInfZone, cameraFlipH: world.cameraFlipH,
      inspection: state.inspection,
      camera: { t: world.cameraAnimT, length: world.cameraAnimLength, phase: world.newCamT, moving: world.cameraMoving,
        x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS },
      pauseCamera: world.pauseCamera?.snapshot() ?? null,
      player: { id: p.id, x: p.x, y: p.y, outer: p.outerLevel ? world.levels.indexOf(p.outerLevel) : -1, outerId: p.outerLevel?.id, t: p.animT, length: p.animLength,
        anim: p.anim, ox: p.drawXOffset, oy: p.drawYOffset, sx: p.drawXScale, sy: p.drawYScale },
      animated: world.blocks.filter(b => b.animT > 0 || b.drawXOffset !== 0 || b.drawYOffset !== 0).map(b => ({
        id: b.id, x: b.x, y: b.y, outer: b.outerLevel?.id, t: b.animT, length: b.animLength,
        ox: b.drawXOffset, oy: b.drawYOffset, sx: b.drawXScale, sy: b.drawYScale })) };
  };
  let captured = new Set();
  const record = (timestamp) => {
    if (!active) return;
    const frame = sample(timestamp);
    const physicalMotionKey = [frame.levelName, frame.player.id,
      frame.player.outer, frame.player.x, frame.player.y, frame.player.anim,
      frame.player.length].join(':');
    if (physicalMotionKey !== previousMotionKey || frame.player.t < previousAnimT) motionIndex++;
    previousMotionKey = physicalMotionKey;
    previousAnimT = frame.player.t;
    frame.motionId = 'motion-' + String(motionIndex).padStart(4, '0') + '-' + frame.player.anim;
    if (frame.camera.moving && (!previousCameraMoving || frame.camera.t < previousCameraT)) cameraIndex++;
    previousCameraMoving = frame.camera.moving;
    previousCameraT = frame.camera.t;
    frame.cameraMotionId = 'camera-' + String(cameraIndex).padStart(4, '0');
    frames.push(frame);
    levelFrame = frame.levelName === previousLevelName ? levelFrame + 1 : 0;
    previousLevelName = frame.levelName;
    if (options.captureLoadedFrames && levelFrame < options.captureLoadedFrames) {
      images.push({name: 'loaded-' + frame.levelName + '-' + String(frames.length - 1).padStart(4, '0'),
        timestamp, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png')});
    }
    const pauseKey = frame.mode + ':' + !!frame.pauseCamera?.cameraUnpause;
    if (pauseKey !== previousPauseKey) pauseIndex++;
    previousPauseKey = pauseKey;
    if (options.capturePauseCamera && frame.pauseCamera && (frame.mode === 'paused' || frame.pauseCamera.cameraUnpause)) {
      for (const target of [0, .033, .067, .1, .167, .25, .5, 1]) {
        const key = 'pause-' + pauseIndex + '-' + target;
        if (frame.pauseCamera.zoomT >= target && !captured.has(key)) {
          captured.add(key);
          images.push({name: key, action, timestamp, phase: frame.pauseCamera.zoomT,
            frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png')});
        }
      }
    }
    if (options.captureEveryMs && timestamp - lastPeriodicCapture >= options.captureEveryMs) {
      lastPeriodicCapture = timestamp;
      images.push({ name: 'sample-' + String(frames.length - 1).padStart(4, '0'),
        timestamp, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
    }
    const stateKey = [frame.levelName, frame.moveCount, frame.winning, frame.mode, frame.session.selectedIndex, frame.player.id,
      frame.player.outer, frame.player.x, frame.player.y, frame.moving].join(':');
    if (options.captureStateChanges && stateKey !== previousStateKey) {
      images.push({ name: 'state-' + String(frames.length - 1).padStart(4, '0'),
        timestamp, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
    }
    previousStateKey = stateKey;
    const phase = frame.player.length > 0 ? frame.player.t / frame.player.length : 1;
    if (options.captureCameraMotion && cameraIndex > 0) {
      for (const target of [0, 0.25, 0.5, 0.75, 1]) {
        const key = frame.cameraMotionId + '-' + target;
        if (frame.camera.phase >= target && !captured.has(key)) {
          captured.add(key);
          images.push({ name: key, action, timestamp, phase: frame.camera.phase,
            frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
        }
      }
    }
    for (const target of [0.25, 0.5, 0.75, 1]) {
      const key = frame.motionId + '-' + target;
      if (options.captureMotion && action !== 'start' && phase >= target && !captured.has(key)) {
        captured.add(key);
        images.push({ name: key, action, timestamp, phase, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
      }
    }
    requestAnimationFrame(record);
  };
  const keyEvent = (type, key) => {
    const timestamp = performance.now();
    window.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true }));
    events.push({ type, key, timestamp, state: sample(performance.now()) });
  };
  const releaseControls = () => {
    for (const key of [...Object.values(directions), 'z', 'x', 'r']) {
      window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));
    }
  };
  releaseControls();
  api.loadLevel(options.level);
  await sleep(300);
  if (api.world().levelName !== options.level) {
    throw new Error('Requested level did not load: ' + options.level + ' → ' + api.world().levelName);
  }
  const settleSetup = async () => {
    const deadline = performance.now() + (options.setupTimeoutMs ?? 10000);
    while (api.world().blocks.some(block => block.moving) || api.world().cameraMoving || api.world().newCamT < 1) {
      if (performance.now() > deadline) throw new Error('Setup did not reach a settled animation state: ' + JSON.stringify({
        state: sample(performance.now()), moving: api.world().blocks.filter(block => block.moving).map(block => ({id:block.id,anim:block.anim,t:block.animT,length:block.animLength})) }));
      await nextFrame();
    }
  };
  await settleSetup();
  const vector = { L: [-1, 0], R: [1, 0], U: [0, 1], D: [0, -1] };
  for (const direction of options.setupActions ?? options.setup ?? '') {
    const began = performance.now();
    if (direction === 'UNDO') api.undo();
    else if (direction === 'REDO') api.redo();
    else if (direction === 'RESTART') api.restart();
    else if (vector[direction]) api.impulse(...vector[direction]);
    else throw new Error('Unknown setup action: ' + direction);
    await sleep(800);
    await settleSetup();
    setupTimings.push({direction, began, ended: performance.now(), state: sample(performance.now())});
  }
  if (api.world().cameraMoving || api.world().newCamT < 1) {
    throw new Error('Camera setup has not settled');
  }
  await nextFrame();
  const starting = sample(performance.now());
  if (starting.levelName !== options.level) throw new Error('Setup changed level before timed capture: ' + starting.levelName);
  const assertStarting = (actual, expected, path = 'starting') => {
    for (const [key, value] of Object.entries(expected)) {
      if (value !== null && typeof value === 'object') assertStarting(actual[key], value, path + '.' + key);
      else if (actual[key] !== value) throw new Error('Native setup mismatch at ' + path + '.' + key + ': expected ' + value + ', actual ' + actual[key]);
    }
  };
  if (options.expectedStarting) assertStarting(starting, options.expectedStarting);
  images.push({ name: 'start', timestamp: performance.now(), dataUrl: canvas.toDataURL('image/png') });
  requestAnimationFrame(record);
  try {
    const sequence = options.events ?? [...(options.sequence ?? '')].map((direction, index) => ({
      at: index * 350, key: directions[direction] ?? direction, duration: 20 }));
    const start = performance.now();
    for (let index = 0; index < sequence.length; index++) {
      const event = sequence[index];
      await sleep(Math.max(0, start + event.at - performance.now()));
      if (event.pointer) {
        const pointer = event.pointer;
        action = String(index).padStart(2, '0') + '-' + pointer.type;
        canvas.dispatchEvent(new PointerEvent(pointer.type, { clientX: pointer.x, clientY: pointer.y,
          button: pointer.button ?? 0, pointerType: 'mouse', bubbles: true, cancelable: true }));
        events.push({ type: pointer.type, x: pointer.x, y: pointer.y, button: pointer.button ?? 0,
          timestamp: performance.now(), state: sample(performance.now()) });
        continue;
      }
      const keys = event.keys ?? [event.key];
      action = String(index).padStart(2, '0') + '-' + keys.map(key => key.replace('Arrow', '')).join('+');
      for (const key of keys) keyEvent(event.type ?? 'keydown', key);
      if (event.type !== 'keyup' && event.duration != null) {
        await sleep(event.duration);
        for (const key of keys) keyEvent('keyup', key);
      }
    }
    await sleep(options.settleMs ?? 500);
    await nextFrame();
    images.push({ name: 'end', timestamp: performance.now(), dataUrl: canvas.toDataURL('image/png') });
    return { options, recordedAt: new Date().toISOString(), viewport: { width: innerWidth, height: innerHeight,
      dpr: devicePixelRatio, canvasWidth: canvas.width, canvasHeight: canvas.height },
      setupTimings, starting, ending: sample(performance.now()), events, frames, images };
  } finally {
    active = false;
    releaseControls();
  }
}
), source = {"revision": "82593337f4fbb5b68f52f9004ee7f0b4bd49c52b", "sha256": {"src/GameController.ts": "bd914add0116a842624417d286cd420eb57cb6f6780d394330f4ce96e0695693", "src/core/movement.ts": "b1907d6fef7a87e06e53570b2001a69039786a65efc0528188ee594205431387", "src/core/animation.ts": "ca1890b2c6376984879e705dfb5d906da515a50799fa4033003c967205e0373e", "src/render/GameRenderer.ts": "7a73ae5de21cc24bd3fa0b9d7aa3b0cde594f220131750aca34428a53c63c030", "src/render/wallRendering.ts": "3547e22812ebbdff6e8b56a3204b2a4f411bbb3c322c3268e1f3fdbf799d62ba", "scripts/parity-capture-web.js": "6ffae31c62be86e57477abdd627fc70c746d51113e5120f7ec70e96867f9a26c"}}, retained = ["enter", "exit", "carry", "cycle", "infexit", "infinity", "clone", "possess", "flip-first", "flip", "infexit-player", "terminal"];
    for (const item of plan) {
      if (retained.includes(item.name)) continue;
      status.current = item.name;
      window.PARITY_OPTIONS = item.options;
      const report = await capture();
      report.source = source;
      report.inputMethod = item.options.inputMethod;
      report.relevantFinalBlocks = window.__PARABOX__.world().blocks.map(b => ({
        id:b.id, x:b.x, y:b.y, outer:b.outerLevel?.id, sub:b.subLevel?.id,
        isPlayer:b.isPlayer, flipH:b.flipH, isInfExit:b.isSomeInfExitBlock
      }));
      const response = await fetch('http://127.0.0.1:4181/capture/recursive-' + item.name, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(report)
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(saved));
      status.completed.push({name:item.name, saved, starting:report.starting, ending:report.ending});
    }
  })().catch(e => { status.error = String(e.stack || e); }).finally(() => { status.running = false; });
  return {started:true};
}