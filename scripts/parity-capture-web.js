// Diagnostic only. Evaluate this function in a running Web page with DevTools.
// Replace PARITY_OPTIONS before evaluation. Returned PNGs are actual Canvas output.
async () => {
  const options = PARITY_OPTIONS;
  const api = window.__PARABOX__;
  if (!api) throw new Error('Web game is not ready');
  const canvas = document.querySelector('canvas');
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const directions = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
  const images = [];
  const events = [];
  const frames = [];
  let active = true;
  let action = 'start';
  let previousStateKey = null;
  let previousMotionKey = null;
  let previousAnimT = Number.POSITIVE_INFINITY;
  let motionIndex = 0;
  const sample = (timestamp) => {
    const world = api.world();
    const p = world.findPlayerBlock();
    return { timestamp, action, levelName: world.levelName, moveCount: world.moveCount,
      moving: world.anyBlockMoving, wentToInfZone: world.wentToInfZone, cameraFlipH: world.cameraFlipH,
      camera: { t: world.cameraAnimT, length: world.cameraAnimLength, phase: world.newCamT, moving: world.cameraMoving,
        x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS },
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
    frames.push(frame);
    const stateKey = [frame.levelName, frame.moveCount, frame.player.id,
      frame.player.outer, frame.player.x, frame.player.y, frame.moving].join(':');
    if (options.captureStateChanges && stateKey !== previousStateKey) {
      images.push({ name: 'state-' + String(frames.length - 1).padStart(4, '0'),
        timestamp, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
    }
    previousStateKey = stateKey;
    const phase = frame.player.length > 0 ? frame.player.t / frame.player.length : 1;
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
  const releaseDirections = () => {
    for (const key of Object.values(directions)) {
      window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));
    }
  };
  releaseDirections();
  api.loadLevel(options.level);
  await sleep(300);
  const vector = { L: [-1, 0], R: [1, 0], U: [0, 1], D: [0, -1] };
  for (const direction of options.setupActions ?? options.setup ?? '') {
    if (direction === 'UNDO') api.undo();
    else if (direction === 'REDO') api.redo();
    else if (direction === 'RESTART') api.restart();
    else if (vector[direction]) api.impulse(...vector[direction]);
    else throw new Error('Unknown setup action: ' + direction);
    await sleep(800);
  }
  if (api.world().cameraMoving || api.world().newCamT < 1) {
    throw new Error('Camera setup has not settled');
  }
  await nextFrame();
  const starting = sample(performance.now());
  images.push({ name: 'start', timestamp: performance.now(), dataUrl: canvas.toDataURL('image/png') });
  requestAnimationFrame(record);
  try {
    const sequence = options.events ?? [...(options.sequence ?? '')].map((direction, index) => ({
      at: index * 350, key: directions[direction] ?? direction, duration: 20 }));
    const start = performance.now();
    for (let index = 0; index < sequence.length; index++) {
      const event = sequence[index];
      await sleep(Math.max(0, start + event.at - performance.now()));
      action = String(index).padStart(2, '0') + '-' + event.key.replace('Arrow', '');
      keyEvent(event.type ?? 'keydown', event.key);
      if (event.type !== 'keyup' && event.duration != null) {
        await sleep(event.duration);
        keyEvent('keyup', event.key);
      }
    }
    await sleep(options.settleMs ?? 500);
    await nextFrame();
    images.push({ name: 'end', timestamp: performance.now(), dataUrl: canvas.toDataURL('image/png') });
    return { options, recordedAt: new Date().toISOString(), viewport: { width: innerWidth, height: innerHeight,
      dpr: devicePixelRatio, canvasWidth: canvas.width, canvasHeight: canvas.height },
      starting, ending: sample(performance.now()), events, frames, images };
  } finally {
    active = false;
    releaseDirections();
  }
}
