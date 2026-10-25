// Diagnostic deterministic input replay. Replace PARITY_OPTIONS before use.
// Requires parity-frame-driver.js on an isolated tab. Real Pixi/Canvas output,
// controlled recorded update deltas; this does not measure natural frame pacing.
async () => {
  const options = PARITY_OPTIONS;
  const api = window.__PARABOX__;
  const driver = window.__parityFrameDriver;
  if (!api || !driver) throw new Error('Isolated replay tab is not ready');
  const all = [
    ...await (await fetch('/tests/fixtures/original-input-boundaries.json')).json(),
    ...await (await fetch('/tests/fixtures/original-history-repeat.json')).json(),
  ];
  const capture = all.find(item => item.id === options.id);
  if (!capture) throw new Error('Unknown native input fixture');
  const canvas = document.querySelector('canvas');
  const bindings = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    undo: 'z', redo: 'x', restart: 'r' };
  const vector = { RIGHT: [1, 0], LEFT: [-1, 0], UP: [0, 1], DOWN: [0, -1] };
  const events = [], frames = [], images = [];
  const sample = () => {
    const world = api.world(), p = world.findPlayerBlock();
    return { timestamp: driver.now, levelName: world.levelName, moveCount: world.moveCount,
      moving: world.anyBlockMoving, player: { id: p.id, x: p.x, y: p.y, outer: p.outerLevel?.id,
        anim: p.anim, t: p.animT, length: p.animLength,
        ox: p.drawXOffset, oy: p.drawYOffset, sx: p.drawXScale, sy: p.drawYScale },
      camera: { x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS,
        t: world.cameraAnimT, phase: world.newCamT },
      cameraFlipH: world.cameraFlipH };
  };
  const keyEvent = (type, key) => {
    window.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true }));
    events.push({ type, key, timestamp: driver.now });
  };
  for (const key of Object.values(bindings)) keyEvent('keyup', key);
  api.loadLevel(capture.level);
  driver.step(.016);
  for (const direction of capture.setup) {
    api.impulse(...vector[direction]);
    for (let i = 0; i < 50; i++) driver.step(.016);
  }
  const starting = sample();
  images.push({ name: 'start', timestamp: driver.now, dataUrl: canvas.toDataURL('image/png') });
  let previous = {}, previousState = null;
  for (const update of capture.updates) {
    for (const [control, key] of Object.entries(bindings)) {
      if (previous[control] && !update.controls[control]) keyEvent('keyup', key);
    }
    for (const [control, key] of Object.entries(bindings)) {
      if (!previous[control] && update.controls[control]) keyEvent('keydown', key);
    }
    driver.step(update.deltaTime);
    const frame = { ...sample(), nativeFrame: update.nativeFrame,
      nativeElapsedMs: update.elapsedMs, nativeDeltaTime: update.deltaTime, expected: update.expected };
    frames.push(frame);
    const state = [frame.moveCount, frame.player.x, frame.player.y, frame.player.anim, frame.moving].join(':');
    if (state !== previousState || frames.length % 4 === 0) {
      images.push({ name: 'native-frame-' + update.nativeFrame, timestamp: driver.now,
        frameIndex: frames.length - 1, nativeFrame: update.nativeFrame, dataUrl: canvas.toDataURL('image/png') });
    }
    previousState = state;
    previous = update.controls;
  }
  for (const key of Object.values(bindings)) keyEvent('keyup', key);
  images.push({ name: 'end', timestamp: driver.now, dataUrl: canvas.toDataURL('image/png') });
  return { options, captureMode: 'actual Canvas, deterministic native update clock', nativeSource: capture.source,
    nativeSourceSha256: capture.sha256, recordedAt: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      canvasWidth: canvas.width, canvasHeight: canvas.height },
    starting, ending: sample(), events, frames, images };
}
