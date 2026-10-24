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
  const sample = (timestamp) => {
    const world = api.world();
    const p = world.findPlayerBlock();
    return { timestamp, action, levelName: world.levelName, moveCount: world.moveCount,
      moving: world.anyBlockMoving, wentToInfZone: world.wentToInfZone, cameraFlipH: world.cameraFlipH,
      camera: { t: world.cameraAnimT, length: world.cameraAnimLength, moving: world.cameraMoving,
        x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS },
      player: { id: p.id, x: p.x, y: p.y, outer: p.outerLevel?.id, t: p.animT, length: p.animLength, type: p.animType,
        ox: p.drawXOffset, oy: p.drawYOffset, sx: p.drawXScale, sy: p.drawYScale },
      animated: world.blocks.filter(b => b.animT > 0 || b.drawXOffset !== 0 || b.drawYOffset !== 0).map(b => ({
        id: b.id, x: b.x, y: b.y, outer: b.outerLevel?.id, t: b.animT, length: b.animLength,
        ox: b.drawXOffset, oy: b.drawYOffset, sx: b.drawXScale, sy: b.drawYScale })) };
  };
  let captured = new Set();
  const record = (timestamp) => {
    if (!active) return;
    const frame = sample(timestamp);
    frames.push(frame);
    const phase = frame.player.length > 0 ? frame.player.t / frame.player.length : 1;
    for (const target of [0.25, 0.5, 0.75, 1]) {
      const key = action + '-' + target;
      if (options.captureMotion && action !== 'start' && phase >= target && !captured.has(key)) {
        captured.add(key);
        images.push({ name: key, timestamp, phase, frameIndex: frames.length - 1, dataUrl: canvas.toDataURL('image/png') });
      }
    }
    requestAnimationFrame(record);
  };
  const keyEvent = (type, key) => {
    const timestamp = performance.now();
    window.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true }));
    events.push({ type, key, timestamp, state: sample(performance.now()) });
  };
  for (const key of Object.values(directions)) keyEvent('keyup', key);
  api.loadLevel(options.level);
  await sleep(300);
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
      keyEvent('keydown', event.key);
      if (event.duration != null) {
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
    for (const key of Object.values(directions)) keyEvent('keyup', key);
  }
}
